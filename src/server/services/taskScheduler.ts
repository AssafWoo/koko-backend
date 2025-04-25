import { PrismaClient } from '@prisma/client';
import { sendNotificationToClients } from '../routes/notificationRoutes.js';
import { createNotificationContent } from './notificationService.js';
import { Task, SummaryParameters, LearningParameters } from '../types/index.js';
import { generateContent } from './contentGenerator.js';
import { formatTime, isTaskDue } from '../utils/timeUtils.js';
import { addSeconds, differenceInSeconds } from 'date-fns';

const prisma = new PrismaClient();
const checkInterval = 5000; // Check every 10 seconds for more precise timing
const maxConcurrentTasks = 10; // Maximum number of tasks to process concurrently
const executionWindow = 10; // 30-second window for task execution

// Task queue with priority
interface TaskQueueItem {
  task: any;
  taskObj: Task;
  priority: number;
  scheduledTime: Date;
  executionWindow: {
    start: Date;
    end: Date;
  };
}

const taskQueue: TaskQueueItem[] = [];
const processingLocks = new Set<string>();
const metadataCache = new Map<string, any>();

// Helper function to calculate task priority
const calculateTaskPriority = (task: any, taskObj: Task): number => {
  let priority = 0;
  
  // Higher priority for overdue tasks
  const now = new Date();
  const scheduledTime = new Date(taskObj.schedule?.date || now);
  scheduledTime.setHours(parseInt(taskObj.schedule?.time?.split(':')[0] || '0'));
  scheduledTime.setMinutes(parseInt(taskObj.schedule?.time?.split(':')[1] || '0'));
  
  // Calculate how overdue the task is
  const secondsOverdue = differenceInSeconds(now, scheduledTime);
  if (secondsOverdue > 0) {
    priority += Math.min(1000 + secondsOverdue, 2000); // Cap at 2000
  }
  
  // Priority based on task type
  switch (taskObj.type) {
    case 'reminder':
      priority += 100;
      break;
    case 'summary':
      priority += 50;
      break;
    case 'learning':
      priority += 30;
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
const processTaskDue = async (task: any, taskObj: Task, now: Date) => {
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
      content = await generateContent('facts', taskObj.parameters);
    } else if (taskObj.type === 'learning') {
      content = await generateContent('learning', taskObj.parameters);
    }

    // Create notification content
    let notification;
    if (taskObj.type === 'summary') {
      notification = createNotificationContent(
        taskObj,
        `New summary about ${(taskObj.parameters as SummaryParameters).target || 'your topic'} has been generated! Click to view.`,
        'info'
      );
      notification.actions = [{
        label: 'View Content',
        url: `/tasks/${task.id}`
      }];
    } else if (taskObj.type === 'learning') {
      const learningParams = taskObj.parameters as LearningParameters;
      notification = createNotificationContent(
        taskObj,
        `New learning content about ${learningParams.topic || 'your topic'} is ready! Click to view.`,
        'info'
      );
      notification.actions = [{
        label: 'View Content',
        url: `/tasks/${task.id}`
      }];
    } else {
      notification = createNotificationContent(
        taskObj,
        content || `Time for: ${taskObj.description}`,
        'info'
      );
    }

    // Send notification for task starting
    sendNotificationToClients(JSON.stringify({
      type: 'task_started',
      content: notification
    }));

    // Calculate next execution time for recurring tasks
    let nextExecution = null;
    if (metadata.schedule?.frequency !== 'once') {
      nextExecution = calculateNextExecutionTime(metadata.schedule, now);
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
    sendNotificationToClients(JSON.stringify({
      type: 'task_completed',
      content: notification
    }));

    console.log(`Successfully processed task ${task.id} at ${formatTime(now)}`);
  } catch (error) {
    console.error(`Failed to process task ${task.id}:`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        taskId: task.id,
        taskTime: taskObj.schedule?.time,
        currentTime: formatTime(now)
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
  } finally {
    processingLocks.delete(task.id);
  }
};

// Helper function to calculate next execution time
const calculateNextExecutionTime = (schedule: Task['schedule'], currentTime: Date): string => {
  if (!schedule) return null;
  
  const nextTime = new Date(currentTime);
  
  switch (schedule.frequency) {
    case 'hourly':
      nextTime.setHours(nextTime.getHours() + 1);
      break;
    case 'daily':
      nextTime.setDate(nextTime.getDate() + 1);
      break;
    case 'weekly':
      nextTime.setDate(nextTime.getDate() + 7);
      break;
    case 'monthly':
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
    case 'every_x_minutes':
      if (schedule.interval) {
        nextTime.setMinutes(nextTime.getMinutes() + schedule.interval);
      }
      break;
  }
  
  return nextTime.toISOString();
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
    const secondsUntilWindow = differenceInSeconds(item.executionWindow.start, now);
    const secondsAfterWindow = differenceInSeconds(now, item.executionWindow.end);
    return secondsUntilWindow <= 0 && secondsAfterWindow <= 0;
  }).slice(0, maxConcurrentTasks);
  
  // Remove processed tasks from queue
  taskQueue.splice(0, tasksToProcess.length);
  
  await Promise.all(tasksToProcess.map(({ task, taskObj }) => 
    processTaskDue(task, taskObj, now)
  ));
};

// Main scheduler function
const runScheduler = async () => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        metadata: {
          contains: '"status":"pending"'
        }
      }
    });
    
    if (tasks.length === 0) {
      return;
    }

    const now = new Date();
    const currentTime = formatTime(now);

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
          continue;
        }

        const schedule = metadata.schedule;
        if (schedule?.time && isTaskDue(
          schedule.time,
          currentTime,
          schedule.frequency,
          metadata.lastExecution,
          schedule.interval,
          schedule.date
        )) {
          const taskObj: Task = {
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
            isActive: true
          };

          const scheduledTime = new Date(now);
          scheduledTime.setHours(parseInt(schedule.time.split(':')[0]));
          scheduledTime.setMinutes(parseInt(schedule.time.split(':')[1]));
          
          // Calculate execution window
          const executionWindowStart = addSeconds(scheduledTime, -executionWindow);
          const executionWindowEnd = addSeconds(scheduledTime, executionWindow);
          
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
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
      }
    }

    // Process the task queue
    await processTaskQueue();
    
  } catch (error) {
    console.error('Error in task scheduler main loop:', error);
  }
};

let schedulerInterval: NodeJS.Timeout | null = null;

const startSchedulerInterval = () => {
  if (!schedulerInterval) {
    schedulerInterval = setInterval(runScheduler, checkInterval);
    console.log('Task scheduler started with interval:', checkInterval, 'ms');
  }
};

export const startTaskScheduler = () => {
  console.log('Starting task scheduler...');
  startSchedulerInterval();
};

// Export a function to manually trigger a scheduler run
export const triggerScheduler = () => {
  runScheduler();
}; 