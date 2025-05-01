"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTask = exports.updateTaskStatus = exports.deleteTask = exports.getTask = exports.getAllTasks = exports.createTask = void 0;
const client_1 = require("@prisma/client");
const contentGenerator_js_1 = require("./contentGenerator.js");
const timeUtils_js_1 = require("@server/utils/timeUtils.js");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
const createTask = async (taskInput, userId) => {
    // Get current time in HH:mm format
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    console.log('Processing task with prompt:', taskInput.prompt);
    console.log('Current time:', currentTime);
    // Check if the prompt contains relative time and adjust the schedule accordingly
    const prompt = taskInput.prompt?.toLowerCase() || '';
    const hasRelativeTime = prompt.includes('in ') && (prompt.includes('min') ||
        prompt.includes('hour') ||
        prompt.includes('half an hour'));
    if (hasRelativeTime) {
        console.log('Detected relative time in prompt');
        const calculatedTime = (0, timeUtils_js_1.calculateRelativeTime)(currentTime, prompt);
        console.log('Calculated time:', calculatedTime);
        taskInput.schedule = {
            ...taskInput.schedule,
            time: calculatedTime.time,
            date: calculatedTime.date,
            frequency: 'once'
        };
    }
    // Create the task object
    const task = {
        id: crypto_1.default.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prompt: taskInput.prompt,
        type: taskInput.type,
        source: taskInput.source,
        schedule: taskInput.schedule,
        action: taskInput.action,
        parameters: taskInput.parameters,
        previewResult: taskInput.previewResult,
        deliveryMethod: taskInput.deliveryMethod || 'in-app',
        description: taskInput.description || taskInput.previewResult,
        logs: [],
        status: 'pending',
        lastExecution: null,
        nextExecution: null,
        isActive: true
    };
    // Save task to database
    await prisma.task.create({
        data: {
            id: task.id,
            description: task.description,
            type: task.type,
            userId,
            metadata: JSON.stringify(task)
        }
    });
    return task;
};
exports.createTask = createTask;
const getAllTasks = async (userId) => {
    const tasks = await prisma.task.findMany({
        where: {
            userId,
            metadata: {
                path: ['isActive'],
                equals: "true"
            }
        }
    });
    return tasks.map(task => {
        if (!task.metadata)
            throw new Error('Task metadata is missing');
        return JSON.parse(task.metadata);
    });
};
exports.getAllTasks = getAllTasks;
const getTask = async (id, userId) => {
    const task = await prisma.task.findFirst({
        where: { id, userId }
    });
    if (!task || !task.metadata)
        return undefined;
    return JSON.parse(task.metadata);
};
exports.getTask = getTask;
const deleteTask = async (id, userId) => {
    const task = await prisma.task.findFirst({
        where: { id, userId }
    });
    if (!task)
        return false;
    
    // Instead of deleting, mark as inactive
    const metadata = JSON.parse(task.metadata || '{}');
    await prisma.task.update({
        where: { id },
        data: {
            metadata: JSON.stringify({
                ...metadata,
                isActive: false,
                status: 'deleted'
            })
        }
    });
    return true;
};
exports.deleteTask = deleteTask;
const updateTaskStatus = async (id, userId, status, previewResult) => {
    const task = await (0, exports.getTask)(id, userId);
    if (!task)
        return;
    const updatedTask = {
        ...task,
        status,
        previewResult: previewResult || task.previewResult
    };
    await prisma.task.update({
        where: { id },
        data: {
            metadata: JSON.stringify(updatedTask)
        }
    });
};
exports.updateTaskStatus = updateTaskStatus;
const runTask = async (id, userId) => {
    const task = await (0, exports.getTask)(id, userId);
    if (!task)
        return undefined;
    await (0, exports.updateTaskStatus)(id, userId, 'running', `Task started at ${new Date().toISOString()}`);
    try {
        let result = '';
        switch (task.type) {
            case 'summary':
                result = await (0, contentGenerator_js_1.generateContent)('facts', task.parameters);
                break;
            case 'reminder':
                result = `Reminder: ${task.description}`;
                break;
            case 'fetch':
                result = `Fetched content from: ${task.parameters.target}`;
                break;
            case 'learning':
                result = await (0, contentGenerator_js_1.generateContent)('learning', task.parameters);
                break;
        }
        task.previewResult = result;
        // For recurring tasks, set status to 'recurring' instead of 'completed'
        const isRecurring = task.schedule?.frequency && task.schedule.frequency !== 'once';
        const nextExecution = isRecurring && task.schedule ? (0, timeUtils_js_1.calculateNextExecutionTime)({
            frequency: task.schedule.frequency === 'continuous' ? 'hourly' : task.schedule.frequency,
            time: task.schedule.time,
            day: task.schedule.day,
            date: task.schedule.date,
            interval: task.schedule.interval
        }, new Date()) : null;
        await (0, exports.updateTaskStatus)(id, userId, isRecurring ? 'recurring' : 'completed', result);
        // Update next execution time for recurring tasks
        if (isRecurring && task.schedule) {
            await prisma.task.update({
                where: { id },
                data: {
                    metadata: JSON.stringify({
                        ...task,
                        nextExecution
                    })
                }
            });
        }
        return (0, exports.getTask)(id, userId);
    }
    catch (error) {
        const errorMessage = `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        await (0, exports.updateTaskStatus)(id, userId, 'failed', errorMessage);
        return (0, exports.getTask)(id, userId);
    }
};
exports.runTask = runTask;
