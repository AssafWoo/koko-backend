import { Router } from 'express';
import { z } from 'zod';
import { Task, Schedule, ReminderParameters, SummaryParameters, FetchParameters, LearningParameters } from '../types';
import { createTask, runTask, simulateTask } from '../services/taskService';
import { createNotificationContent, sendNotification } from '../services/notificationService';

const router = Router();

const taskInputSchema = z.object({
  type: z.enum(['reminder', 'summary', 'fetch', 'learning']),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    timezone: z.string(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    dayOfMonth: z.number().min(1).max(31).optional()
  }),
  parameters: z.union([
    z.object({
      type: z.literal('reminder'),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      tags: z.array(z.string())
    }),
    z.object({
      type: z.literal('summary'),
      sources: z.array(z.string()),
      format: z.enum(['bullet', 'paragraph']),
      length: z.enum(['short', 'medium', 'long'])
    }),
    z.object({
      type: z.literal('fetch'),
      url: z.string().url(),
      selector: z.string(),
      format: z.enum(['text', 'html'])
    }),
    z.object({
      type: z.literal('learning'),
      topic: z.string(),
      level: z.enum(['beginner', 'intermediate', 'advanced']),
      format: z.enum(['article', 'video', 'interactive'])
    })
  ])
});

router.post('/', async (req, res) => {
  try {
    const validatedData = taskInputSchema.parse(req.body);
    const task = await createTask(validatedData);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await runTask(taskId);
    
    // Send notification about task completion
    const notification = createNotificationContent(result.task, 'Task completed successfully', 'success');
    await sendNotification('taskCompleted', notification);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/simulate', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await simulateTask(taskId);
    
    // Send notification about simulation result
    const notification = createNotificationContent(result.task, 'Simulation completed', 'info');
    await sendNotification('simulationCompleted', notification);
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router; 