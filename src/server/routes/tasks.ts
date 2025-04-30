import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '@server/middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '@server/prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task } from '@server/types';
import { createTask, getAllTasks, deleteTask, runTask } from '@server/services/taskService';
import { extractTaskIntent } from '@server/utils/llmUtils';
import { normalizeSchedule, calculateRelativeTime } from '@server/utils/scheduleUtils';
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
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    console.log('POST /tasks - Request user:', req.user);
    console.log('POST /tasks - Request body:', req.body);
    
    const userId = req.user?.id?.toString();
    if (!userId) {
      console.log('Invalid user ID in request');
      res.status(401).json({ message: 'Invalid user ID' });
      return;
    }

    const { prompt } = req.body;
    if (!prompt) {
      console.log('No prompt provided');
      res.status(400).json({ message: 'Prompt is required' });
      return;
    }

    // Get current time in HH:mm format
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;
    console.log('Current time:', currentTime);

    // Use Mistral for intent analysis
    console.log('Analyzing intent with Mistral for prompt:', prompt);
    const intentResponse = await llmRouter.processTask(
      { type: 'intent' } as any,
      intentPrompt.replace('{USER_PROMPT}', prompt).replace('{CURRENT_TIME}', currentTime)
    );

    console.log('Mistral response:', intentResponse);
    let parsedIntent;
    try {
      parsedIntent = JSON.parse(intentResponse);
    } catch (error) {
      console.error('Error parsing intent response:', error);
      res.status(500).json({ message: 'Failed to parse task intent' });
      return;
    }

    // Check for time-of-day keywords in the prompt
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
            (prompt.toLowerCase().includes('min') || prompt.toLowerCase().includes('hour'))) {
      // Use the utility function for relative time
      const calculatedTime = calculateRelativeTime(currentTime, prompt);
      parsedIntent.taskDefinition.schedule.time = calculatedTime;
      console.log('Adjusted time for relative schedule:', {
        originalTime: currentTime,
        calculatedTime,
        prompt
      });
    }

    // Calculate the execution date based on the time
    const calculateExecutionDate = (time: string): string => {
      const now = new Date();
      const [hours, minutes] = time.split(':').map(Number);
      const executionDate = new Date(now);
      executionDate.setHours(hours, minutes, 0, 0);
      
      // If the time has already passed today, set it for tomorrow
      if (executionDate < now) {
        executionDate.setDate(executionDate.getDate() + 1);
      }
      
      return executionDate.toISOString().split('T')[0];
    };

    // Process the task with the appropriate LLM
    const taskContent = await llmRouter.processTask(
      parsedIntent.taskDefinition,
      prompt
    );

    // Create the task with the generated content
    const task = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: prompt,
      type: parsedIntent.taskDefinition.type,
      source: parsedIntent.taskDefinition.source || null,
      schedule: {
        frequency: parsedIntent.taskDefinition.schedule.frequency,
        time: parsedIntent.taskDefinition.schedule.time || null,
        day: parsedIntent.taskDefinition.schedule.day || null,
        date: parsedIntent.taskDefinition.schedule.frequency === 'once' ? 
          calculateExecutionDate(parsedIntent.taskDefinition.schedule.time) : 
          parsedIntent.taskDefinition.schedule.date || null,
        interval: parsedIntent.taskDefinition.schedule.interval
      },
      action: parsedIntent.taskDefinition.action,
      parameters: {
        type: parsedIntent.taskDefinition.type,
        ...parsedIntent.taskDefinition.parameters
      },
      previewResult: parsedIntent.taskDefinition.description,
      deliveryMethod: parsedIntent.taskDefinition.deliveryMethod || 'in-app',
      description: parsedIntent.taskDefinition.description,
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

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    next(error);
  }
});

// Run a task
router.post('/:id/run', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    // Run task
    const result = await runTask(id, req.user.id);
    
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
    
    const success = await deleteTask(id, req.user.id);
    
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