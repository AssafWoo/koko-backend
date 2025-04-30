"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerScheduler = exports.startTaskScheduler = void 0;
const client_1 = require("@prisma/client");
const notificationRoutes_js_1 = require("@server/routes/notificationRoutes.js");
const notificationService_js_1 = require("./notificationService.js");
const contentGenerator_js_1 = require("./contentGenerator.js");
const timeUtils_js_1 = require("@server/utils/timeUtils.js");
const date_fns_1 = require("date-fns");
const prisma = new client_1.PrismaClient();
const checkInterval = 10000; // Check every 10 seconds for more precise timing
const maxConcurrentTasks = 10; // Maximum number of tasks to process concurrently
const executionWindow = 30; // 30-second window for task execution
const taskQueue = [];
const processingLocks = new Set();
const metadataCache = new Map();
// Helper function to calculate task priority
const calculateTaskPriority = (task, taskObj) => {
    let priority = 0;
    // Higher priority for overdue tasks
    const now = new Date();
    const scheduledTime = new Date(taskObj.schedule?.date || now);
    scheduledTime.setHours(parseInt(taskObj.schedule?.time?.split(':')[0] || '0'));
    scheduledTime.setMinutes(parseInt(taskObj.schedule?.time?.split(':')[1] || '0'));
    // Calculate how overdue the task is
    const secondsOverdue = (0, date_fns_1.differenceInSeconds)(now, scheduledTime);
    if (secondsOverdue > 0) {
        priority += Math.min(1000 + secondsOverdue, 2000); // Cap at 2000
    }
    // Priority based on task type
    switch (taskObj.type) {
        case 'reminder':
            priority += 100;
            break;
        case 'learning':
            priority += 150; // Increased priority for learning tasks
            break;
        case 'summary':
            priority += 50;
            break;
        case 'fetch':
            priority += 20;
            break;
    }
    // Priority based on frequency
    switch (taskObj.schedule?.frequency) {
        case 'hourly':
            priority += 200;
            break;
        case 'every_x_minutes':
            priority += 150;
            break;
        case 'daily':
            priority += 100;
            break;
        case 'weekly':
            priority += 50;
            break;
        case 'monthly':
            priority += 25;
            break;
    }
    return priority;
};
// Process a single task
const processTaskDue = async (task, taskObj, now) => {
    if (processingLocks.has(task.id)) {
        return;
    }
    const metadata = JSON.parse(task.metadata || '{}');
    if (metadata.status === 'completed' && metadata.schedule?.frequency === 'once') {
        return;
    }
    processingLocks.add(task.id);
    try {
        // Update task status to running
        await prisma.task.update({
            where: { id: task.id },
            data: {
                metadata: JSON.stringify({
                    ...metadata,
                    status: 'running',
                    lastExecution: now.toISOString()
                })
            }
        });
        // Generate content based on task type
        let content = '';
        if (taskObj.type === 'summary') {
            content = await (0, contentGenerator_js_1.generateContent)('facts', taskObj.parameters);
        }
        else if (taskObj.type === 'learning') {
            content = await (0, contentGenerator_js_1.generateContent)('learning', taskObj.parameters);
        }
        // Create notification content
        let notification;
        if (taskObj.type === 'summary') {
            notification = (0, notificationService_js_1.createNotificationContent)(taskObj, `New summary about ${taskObj.parameters.target || 'your topic'} has been generated! Click to view.`, 'info');
            notification.actions = [{
                    label: 'View Content',
                    url: `/tasks/${task.id}`
                }];
        }
        else if (taskObj.type === 'learning') {
            const learningParams = taskObj.parameters;
            notification = (0, notificationService_js_1.createNotificationContent)(taskObj, `New learning content about ${learningParams.topic || 'your topic'} is ready! Click to view.`, 'info');
            notification.actions = [{
                    label: 'View Content',
                    url: `/tasks/${task.id}`
                }];
        }
        else {
            notification = (0, notificationService_js_1.createNotificationContent)(taskObj, content || `Time for: ${taskObj.description}`, 'info');
        }
        // Send notification for task starting
        (0, notificationRoutes_js_1.sendNotificationToClients)(JSON.stringify({
            type: 'task_started',
            content: notification
        }));
        // Calculate next execution time for recurring tasks
        let nextExecution = null;
        if (metadata.schedule?.frequency !== 'once') {
            nextExecution = (0, timeUtils_js_1.calculateNextExecutionTime)(metadata.schedule, now);
        }
        // Update task status based on frequency
        const newStatus = metadata.schedule?.frequency === 'once' ? 'completed' : 'recurring';
        await prisma.task.update({
            where: { id: task.id },
            data: {
                metadata: JSON.stringify({
                    ...metadata,
                    status: newStatus,
                    lastExecution: now.toISOString(),
                    nextExecution: nextExecution,
                    previewResult: content || taskObj.description
                })
            }
        });
        // Send notification for task completion
        (0, notificationRoutes_js_1.sendNotificationToClients)(JSON.stringify({
            type: 'task_completed',
            content: notification
        }));
        console.log(`Successfully processed task ${task.id} at ${(0, timeUtils_js_1.formatTime)(now)}`);
    }
    catch (error) {
        console.error(`Failed to process task ${task.id}:`, error);
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                taskId: task.id,
                taskTime: taskObj.schedule?.time,
                currentTime: (0, timeUtils_js_1.formatTime)(now)
            });
        }
        await prisma.task.update({
            where: { id: task.id },
            data: {
                metadata: JSON.stringify({
                    ...metadata,
                    status: 'failed',
                    lastExecution: now.toISOString()
                })
            }
        });
    }
    finally {
        processingLocks.delete(task.id);
    }
};
// Process tasks from the queue
const processTaskQueue = async () => {
    const now = new Date();
    // Sort tasks by priority and scheduled time
    taskQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });
    // Process tasks that are within their execution window
    const tasksToProcess = taskQueue.filter(item => {
        const secondsUntilWindow = (0, date_fns_1.differenceInSeconds)(item.executionWindow.start, now);
        const secondsAfterWindow = (0, date_fns_1.differenceInSeconds)(now, item.executionWindow.end);
        const isInWindow = secondsUntilWindow <= 0 && secondsAfterWindow <= 0;
        console.log(`Task ${item.task.id} window check:`, {
            secondsUntilWindow,
            secondsAfterWindow,
            isInWindow,
            start: item.executionWindow.start.toISOString(),
            end: item.executionWindow.end.toISOString(),
            current: now.toISOString()
        });
        return isInWindow;
    }).slice(0, maxConcurrentTasks);
    console.log(`Processing ${tasksToProcess.length} tasks from queue`);
    // Remove processed tasks from queue
    taskQueue.splice(0, tasksToProcess.length);
    await Promise.all(tasksToProcess.map(({ task, taskObj }) => processTaskDue(task, taskObj, now)));
};
// Main scheduler function
const runScheduler = async () => {
    try {
        console.log('Running scheduler at:', new Date().toISOString());
        const tasks = await prisma.task.findMany({
            where: {
                metadata: {
                    contains: '"status":"pending"'
                }
            }
        });
        if (tasks.length === 0) {
            console.log('No pending tasks found');
            return;
        }
        console.log(`Found ${tasks.length} pending tasks`);
        const now = new Date();
        const currentTime = (0, timeUtils_js_1.formatTime)(now);
        // Clear the queue and repopulate with due tasks
        taskQueue.length = 0;
        for (const task of tasks) {
            try {
                let metadata = metadataCache.get(task.id);
                if (!metadata) {
                    metadata = JSON.parse(task.metadata || '{}');
                    metadataCache.set(task.id, metadata);
                }
                if (metadata.status !== 'pending') {
                    console.log(`Task ${task.id} is not pending, status: ${metadata.status}`);
                    continue;
                }
                const schedule = metadata.schedule;
                console.log(`Checking task ${task.id}:`, {
                    scheduledTime: schedule?.time,
                    currentTime,
                    frequency: schedule?.frequency,
                    date: schedule?.date
                });
                if (schedule?.time && (0, timeUtils_js_1.isTaskDue)(schedule.time, currentTime, schedule.frequency, metadata.lastExecution, schedule.interval, schedule.date)) {
                    console.log(`Task ${task.id} is due, adding to queue`);
                    const taskObj = {
                        id: task.id,
                        createdAt: task.createdAt.toISOString(),
                        updatedAt: task.updatedAt.toISOString(),
                        prompt: metadata.prompt || '',
                        type: metadata.type || 'reminder',
                        source: metadata.source || null,
                        schedule: metadata.schedule || null,
                        action: metadata.action || '',
                        parameters: {
                            ...metadata.parameters,
                            format: metadata.parameters.format || 'summary',
                            content_types: metadata.parameters.content_types || ['text'],
                            difficulty: metadata.parameters.level || 'beginner',
                            sources: metadata.parameters.sources || []
                        },
                        previewResult: metadata.previewResult || '',
                        deliveryMethod: metadata.deliveryMethod || 'in-app',
                        description: metadata.description || '',
                        logs: metadata.logs || [],
                        status: metadata.status,
                        lastExecution: metadata.lastExecution || null,
                        nextExecution: (0, timeUtils_js_1.calculateNextExecutionTime)(metadata.schedule, new Date()) || null,
                        isActive: true
                    };
                    const scheduledTime = new Date(now);
                    scheduledTime.setHours(parseInt(schedule.time.split(':')[0]));
                    scheduledTime.setMinutes(parseInt(schedule.time.split(':')[1]));
                    // Calculate execution window
                    const executionWindowStart = (0, date_fns_1.addSeconds)(scheduledTime, -executionWindow);
                    const executionWindowEnd = (0, date_fns_1.addSeconds)(scheduledTime, executionWindow);
                    console.log(`Task ${task.id} execution window:`, {
                        start: executionWindowStart.toISOString(),
                        end: executionWindowEnd.toISOString(),
                        current: now.toISOString()
                    });
                    taskQueue.push({
                        task,
                        taskObj,
                        priority: calculateTaskPriority(task, taskObj),
                        scheduledTime,
                        executionWindow: {
                            start: executionWindowStart,
                            end: executionWindowEnd
                        }
                    });
                }
                else {
                    console.log(`Task ${task.id} is not due yet`);
                }
            }
            catch (error) {
                console.error(`Error processing task ${task.id}:`, error);
            }
        }
        console.log(`Queue size before processing: ${taskQueue.length}`);
        // Process the task queue
        await processTaskQueue();
        console.log('Scheduler run completed');
    }
    catch (error) {
        console.error('Error in task scheduler main loop:', error);
    }
};
let schedulerInterval = null;
const startSchedulerInterval = () => {
    if (!schedulerInterval) {
        schedulerInterval = setInterval(runScheduler, checkInterval);
        console.log('Task scheduler started with interval:', checkInterval, 'ms');
    }
};
const startTaskScheduler = () => {
    console.log('Starting task scheduler...');
    startSchedulerInterval();
};
exports.startTaskScheduler = startTaskScheduler;
// Export a function to manually trigger a scheduler run
const triggerScheduler = () => {
    runScheduler();
};
exports.triggerScheduler = triggerScheduler;
