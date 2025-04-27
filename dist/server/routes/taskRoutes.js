"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const taskService_1 = require("../services/taskService");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
const taskInputSchema = zod_1.z.object({
    type: zod_1.z.enum(['reminder', 'summary', 'fetch', 'learning']),
    schedule: zod_1.z.object({
        frequency: zod_1.z.enum(['once', 'daily', 'weekly', 'monthly']),
        startTime: zod_1.z.string().datetime(),
        endTime: zod_1.z.string().datetime().optional(),
        timezone: zod_1.z.string(),
        daysOfWeek: zod_1.z.array(zod_1.z.number().min(0).max(6)).optional(),
        dayOfMonth: zod_1.z.number().min(1).max(31).optional()
    }),
    parameters: zod_1.z.union([
        zod_1.z.object({
            type: zod_1.z.literal('reminder'),
            description: zod_1.z.string(),
            priority: zod_1.z.enum(['low', 'medium', 'high']),
            tags: zod_1.z.array(zod_1.z.string())
        }),
        zod_1.z.object({
            type: zod_1.z.literal('summary'),
            sources: zod_1.z.array(zod_1.z.string()),
            format: zod_1.z.enum(['bullet', 'paragraph']),
            length: zod_1.z.enum(['short', 'medium', 'long'])
        }),
        zod_1.z.object({
            type: zod_1.z.literal('fetch'),
            url: zod_1.z.string().url(),
            selector: zod_1.z.string(),
            format: zod_1.z.enum(['text', 'html'])
        }),
        zod_1.z.object({
            type: zod_1.z.literal('learning'),
            topic: zod_1.z.string(),
            level: zod_1.z.enum(['beginner', 'intermediate', 'advanced']),
            format: zod_1.z.enum(['article', 'video', 'interactive'])
        })
    ])
});
router.post('/', async (req, res) => {
    try {
        const validatedData = taskInputSchema.parse(req.body);
        const task = await (0, taskService_1.createTask)(validatedData);
        res.json(task);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:id/run', async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await (0, taskService_1.runTask)(taskId);
        // Send notification about task completion
        const notification = (0, notificationService_1.createNotificationContent)(result.task, 'Task completed successfully', 'success');
        await (0, notificationService_1.sendNotification)('taskCompleted', notification);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:id/simulate', async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await (0, taskService_1.simulateTask)(taskId);
        // Send notification about simulation result
        const notification = (0, notificationService_1.createNotificationContent)(result.task, 'Simulation completed', 'info');
        await (0, notificationService_1.sendNotification)('simulationCompleted', notification);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
