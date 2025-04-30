"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const taskService_1 = require("@server/services/taskService");
const notificationService_1 = require("@server/services/notificationService");
const router = express_1.default.Router();
const learningSourceSchema = zod_1.z.object({
    name: zod_1.z.string(),
    url: zod_1.z.string().url(),
    description: zod_1.z.string(),
    content_types: zod_1.z.array(zod_1.z.string())
});
const taskInputSchema = zod_1.z.object({
    type: zod_1.z.enum(['reminder', 'summary', 'fetch', 'learning']),
    source: zod_1.z.string().nullable(),
    schedule: zod_1.z.object({
        frequency: zod_1.z.enum(['once', 'daily', 'weekly', 'monthly', 'hourly', 'every_x_minutes', 'continuous']),
        time: zod_1.z.string().nullable(),
        day: zod_1.z.string().nullable(),
        date: zod_1.z.string().nullable(),
        interval: zod_1.z.number().optional()
    }).nullable(),
    action: zod_1.z.string(),
    parameters: zod_1.z.union([
        zod_1.z.object({
            type: zod_1.z.literal('reminder'),
            target: zod_1.z.string(),
            priority: zod_1.z.enum(['low', 'medium', 'high']).optional()
        }),
        zod_1.z.object({
            type: zod_1.z.literal('summary'),
            target: zod_1.z.string(),
            source: zod_1.z.string().optional(),
            format: zod_1.z.enum(['short', 'detailed']).optional()
        }),
        zod_1.z.object({
            type: zod_1.z.literal('fetch'),
            target: zod_1.z.string(),
            url: zod_1.z.string().url(),
            selector: zod_1.z.string()
        }),
        zod_1.z.object({
            type: zod_1.z.literal('learning'),
            topic: zod_1.z.string(),
            format: zod_1.z.enum(['article_link', 'summary', 'facts']),
            content_types: zod_1.z.array(zod_1.z.string()),
            difficulty: zod_1.z.enum(['beginner', 'intermediate', 'advanced']),
            sources: zod_1.z.array(learningSourceSchema),
            summary_length: zod_1.z.enum(['short', 'medium', 'detailed']).optional(),
            include_links: zod_1.z.boolean().optional()
        })
    ]),
    description: zod_1.z.string(),
    deliveryMethod: zod_1.z.enum(['in-app', 'email', 'slack']).optional()
});
router.post('/', async (req, res) => {
    try {
        const validatedData = taskInputSchema.parse(req.body);
        const userId = req.user?.id?.toString();
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const task = await (0, taskService_1.createTask)({
            ...validatedData,
            prompt: validatedData.description,
            previewResult: validatedData.description,
            schedule: validatedData.schedule || {
                frequency: 'once',
                time: null,
                day: null,
                date: null
            }
        }, userId);
        res.json(task);
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: 'An unknown error occurred' });
        }
    }
});
router.post('/:id/run', async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user?.id?.toString();
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const result = await (0, taskService_1.runTask)(taskId, userId);
        if (!result) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        // Send notification about task completion
        const notification = (0, notificationService_1.createNotificationContent)(result, 'Task completed successfully', 'success');
        await (0, notificationService_1.sendNotification)('taskCompleted', notification);
        res.json(result);
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: 'An unknown error occurred' });
        }
    }
});
exports.default = router;
