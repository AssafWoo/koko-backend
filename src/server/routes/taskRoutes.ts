import express from 'express';
import { z } from 'zod';
import { Task, Schedule, ReminderParameters, SummaryParameters, FetchParameters, LearningParameters, LearningSource } from '@server/types';
import { createTask, runTask } from '@server/services/taskService';
import { createNotificationContent, sendNotification } from '@server/services/notificationService';

const router = express.Router();

const learningSourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string(),
  content_types: z.array(z.string())
});

const taskInputSchema = z.object({
  type: z.enum(['reminder', 'summary', 'fetch', 'learning']),
  source: z.string().nullable(),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'hourly', 'every_x_minutes', 'continuous']),
    time: z.string().nullable(),
    day: z.string().nullable(),
    date: z.string().nullable(),
    interval: z.number().optional()
  }).nullable(),
  action: z.string(),
  parameters: z.union([
    z.object({
      type: z.literal('reminder'),
      target: z.string(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    }),
    z.object({
      type: z.literal('summary'),
      target: z.string(),
      source: z.string().optional(),
      format: z.enum(['short', 'detailed']).optional()
    }),
    z.object({
      type: z.literal('fetch'),
      target: z.string(),
      url: z.string().url(),
      selector: z.string()
    }),
    z.object({
      type: z.literal('learning'),
      topic: z.string(),
      format: z.enum(['article_link', 'summary', 'facts']),
      content_types: z.array(z.string()),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      sources: z.array(learningSourceSchema),
      summary_length: z.enum(['short', 'medium', 'detailed']).optional(),
      include_links: z.boolean().optional()
    })
  ]),
  description: z.string(),
  deliveryMethod: z.enum(['in-app', 'email', 'slack']).optional()
});

router.post('/', async (req, res) => {
  try {
    const validatedData = taskInputSchema.parse(req.body);
    const userId = req.user?.id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const task = await createTask(validatedData, userId);
    res.json(task);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
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
    const result = await runTask(taskId, userId);
    
    if (!result) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Send notification about task completion
    const notification = createNotificationContent(result, 'Task completed successfully', 'success');
    await sendNotification('taskCompleted', notification);
    
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'An unknown error occurred' });
    }
  }
});

export default router; 