import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '@server/middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '@server/prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task } from '@server/types';
import { createTask, getAllTasks, deleteTask, runTask } from '@server/services/taskService';
import { extractTaskIntent } from '@server/utils/llmUtils';
import { normalizeSchedule } from '@server/utils/scheduleUtils';
import { calculateRelativeTime, RelativeTimeResult } from '@server/utils/timeUtils';
import { LLMTaskRouter } from '@server/services/llmTaskRouter';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();
const ollama = new Ollama();
const llmRouter = LLMTaskRouter.getInstance();

// Helper function to convert time-of-day keywords to specific times
const convertTimeOfDayToTime = (timeOfDay: string): string | null => {
  const timeMap: { [key: string]: string } = {
    'night': '23:00',
    'evening': '19:00',
    'afternoon': '16:00',
    'noon': '12:00',
    'morning': '08:00',
    'middle of the night': '03:00'
  };

  // Convert to lowercase and trim for matching
  const normalizedTimeOfDay = timeOfDay.toLowerCase().trim();
  
  // Check for exact matches
  if (timeMap[normalizedTimeOfDay]) {
    return timeMap[normalizedTimeOfDay];
  }

  // Check for partial matches (e.g., "late night", "early morning")
  for (const [key, value] of Object.entries(timeMap)) {
    if (normalizedTimeOfDay.includes(key)) {
      return value;
    }
  }

  return null;
};

// Get all tasks for the authenticated user
router.get('/', authenticateToken, (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('GET /tasks - Request user:', req.user);
    const userId = req.user?.id;
    if (!userId) {
      console.log('Invalid user ID in request');
      res.status(401).json({ message: 'Invalid user ID' });
      return;
    }

    console.log('Fetching tasks for user:', userId);
    const tasks = await getAllTasks(userId);
    console.log('Found tasks:', tasks);
    res.json(tasks);
  } catch (error) {
    console.error('Error in GET /tasks:', error);
    next(error);
  }
}) as RequestHandler);

// Create a new task
router.post('/', authenticateToken, (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prompt } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get current time in HH:mm format
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Extract task intent using LLM
    const parsedIntent = await extractTaskIntent(prompt, currentTime);

    // Check for time-of-day keywords first
    const timeOfDayTime = convertTimeOfDayToTime(prompt);
    if (timeOfDayTime) {
      console.log('Converting time-of-day to specific time:', {
        prompt,
        timeOfDayTime
      });
      parsedIntent.taskDefinition.schedule.time = timeOfDayTime;
    }
    // If no time-of-day match, check for relative time
    else if (prompt.toLowerCase().includes('in ') && 
            (prompt.toLowerCase().includes('min') || 
             prompt.toLowerCase().includes('hour') ||
             prompt.toLowerCase().includes('half an hour'))) {
      // Use the utility function for relative time
      const calculatedTime: RelativeTimeResult = calculateRelativeTime(currentTime, prompt);
      parsedIntent.taskDefinition.schedule = {
        ...parsedIntent.taskDefinition.schedule,
        time: calculatedTime.time,
        date: calculatedTime.date,
        frequency: 'once'
      };
      console.log('Adjusted time for relative schedule:', {
        originalTime: currentTime,
        calculatedTime,
        prompt
      });
    }

    // Process the task with the appropriate LLM
    const tempTask: Task = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt,
      type: parsedIntent.taskDefinition.type,
      source: parsedIntent.taskDefinition.source,
      schedule: {
        ...parsedIntent.taskDefinition.schedule,
        day: parsedIntent.taskDefinition.schedule.day || null,
        date: parsedIntent.taskDefinition.schedule.date || null,
        time: parsedIntent.taskDefinition.schedule.time || null
      },
      action: parsedIntent.taskDefinition.action,
      parameters: parsedIntent.taskDefinition.parameters,
      previewResult: '',
      deliveryMethod: 'in-app',
      description: parsedIntent.taskDefinition.description,
      logs: [],
      status: 'pending',
      lastExecution: null,
      nextExecution: null,
      isActive: true
    };

    const taskContent = await llmRouter.processTask(tempTask, prompt);

    // Create the task in the database
    const task = await createTask({
      ...parsedIntent.taskDefinition,
      prompt,
      previewResult: taskContent,
      schedule: {
        ...parsedIntent.taskDefinition.schedule,
        day: parsedIntent.taskDefinition.schedule.day || null,
        date: parsedIntent.taskDefinition.schedule.date || null,
        time: parsedIntent.taskDefinition.schedule.time || null
      }
    }, userId);

    res.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    next(error);
  }
}) as RequestHandler);

// Run a task
router.post('/:id/run', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    // Run task
    const result = await runTask(id, req.user.id.toString());
    
    if (!result) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
}) as express.RequestHandler);

// Delete a task
router.delete('/:id', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const success = await deleteTask(id, req.user.id.toString());
    
    if (!success) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}) as express.RequestHandler);

// Get task intent
router.post('/intent', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const parsedIntent = await extractTaskIntent(prompt, currentTime);
    res.json(parsedIntent);
  } catch (error) {
    console.error('Error in task intent extraction:', error);
    next(error);
  }
}) as express.RequestHandler);

export default router;