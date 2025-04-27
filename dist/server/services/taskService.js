"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTask = exports.deleteTask = exports.updateTaskStatus = exports.getAllTasks = exports.getTask = exports.createTask = void 0;
const client_1 = require("@prisma/client");
const contentGenerator_1 = require("./contentGenerator");
const timeUtils_1 = require("../utils/timeUtils");
const prisma = new client_1.PrismaClient();
const createTask = async (taskDefinition, userId) => {
    // Validate and set default values for schedule
    const schedule = {
        frequency: taskDefinition.schedule?.frequency || 'once',
        time: taskDefinition.schedule?.time || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        day: taskDefinition.schedule?.day || null,
        date: taskDefinition.schedule?.date || (taskDefinition.schedule?.frequency === 'once' ? new Date().toISOString().split('T')[0] : null),
        interval: taskDefinition.schedule?.interval
    };
    const task = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        prompt: '',
        type: taskDefinition.type,
        source: taskDefinition.source,
        schedule,
        action: taskDefinition.action,
        parameters: taskDefinition.parameters,
        previewResult: taskDefinition.description,
        deliveryMethod: taskDefinition.deliveryMethod || 'in-app',
        description: taskDefinition.description,
        logs: [],
        status: 'pending',
        lastExecution: null,
        isActive: true
    };
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
const getTask = async (id, userId) => {
    const dbTask = await prisma.task.findFirst({
        where: {
            id,
            userId
        }
    });
    if (!dbTask)
        return undefined;
    return JSON.parse(dbTask.metadata || '{}');
};
exports.getTask = getTask;
const getAllTasks = async (userId) => {
    const dbTasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });
    return dbTasks.map(dbTask => JSON.parse(dbTask.metadata || '{}'));
};
exports.getAllTasks = getAllTasks;
const updateTaskStatus = async (id, userId, status, logMessage) => {
    const dbTask = await prisma.task.findFirst({
        where: {
            id,
            userId
        }
    });
    if (!dbTask)
        return undefined;
    const task = JSON.parse(dbTask.metadata || '{}');
    task.status = status;
    task.lastExecution = new Date().toISOString();
    if (logMessage) {
        task.logs.push({
            timestamp: new Date().toISOString(),
            message: logMessage
        });
    }
    await prisma.task.update({
        where: { id },
        data: { metadata: JSON.stringify(task) }
    });
    return task;
};
exports.updateTaskStatus = updateTaskStatus;
const deleteTask = async (id, userId) => {
    try {
        const task = await prisma.task.findFirst({
            where: {
                id,
                userId
            }
        });
        if (!task)
            return false;
        await prisma.task.delete({
            where: { id }
        });
        return true;
    }
    catch (error) {
        return false;
    }
};
exports.deleteTask = deleteTask;
const runTask = async (id, userId) => {
    const task = await (0, exports.getTask)(id, userId);
    if (!task)
        return undefined;
    await (0, exports.updateTaskStatus)(id, userId, 'running', `Task started at ${new Date().toISOString()}`);
    try {
        let result = '';
        switch (task.type) {
            case 'summary':
                result = await (0, contentGenerator_1.generateContent)('facts', task.parameters);
                break;
            case 'reminder':
                result = `Reminder: ${task.description}`;
                break;
            case 'fetch':
                result = `Fetched content from: ${task.parameters.target}`;
                break;
            case 'learning':
                result = `Learning content prepared for: ${task.parameters.topic}`;
                break;
        }
        task.previewResult = result;
        // For recurring tasks, set status to 'recurring' instead of 'completed'
        const isRecurring = task.schedule?.frequency && task.schedule.frequency !== 'once';
        const nextExecution = isRecurring ? (0, timeUtils_1.calculateNextExecutionTime)(task.schedule, new Date()) : null;
        await (0, exports.updateTaskStatus)(id, userId, isRecurring ? 'recurring' : 'completed', result);
        // Update next execution time for recurring tasks
        if (isRecurring) {
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
