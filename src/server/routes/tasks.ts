import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '../prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task } from '../types';
import { createTask, getAllTasks, deleteTask, runTask } from '../services/taskService';
import { extractTaskIntent } from '../utils/llmUtils';
import { normalizeSchedule } from '../utils/scheduleUtils';
import { LLMTaskRouter } from '../services/llmTaskRouter';

const router = express.Router();
const prisma = new PrismaClient();
const ollama = new Ollama();
const llmRouter = LLMTaskRouter.getInstance();

// Helper function to calculate relative time
const calculateRelativeTime = (currentTime: string, relativeTime: string): string => {
  // Parse relative time (e.g., "in 1 min", "in 5 minutes", "in 2 hours")
  const match = relativeTime.match(/in (\d+) (min|mins|minute|minutes|hour|hours)/i);
  if (!match) return currentTime;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  // Create a new Date object with the current time
  const now = new Date();
  const [hours, minutes] = currentTime.split(':').map(Number);
  
  // Set the time to the current time
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMilliseconds(0);

  // Add the relative time
  if (unit.startsWith('min')) {
    now.setMinutes(now.getMinutes() + amount);
  } else if (unit.startsWith('hour')) {
    now.setHours(now.getHours() + amount);
  }

  // Format the time in 24-hour format
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
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

    // Process the task with the appropriate LLM
    const taskContent = await llmRouter.processTask(
      parsedIntent.taskDefinition,
      prompt
    );

    // Create the task with the generated content
    const task = {
      ...parsedIntent.taskDefinition,
      userId,
      content: taskContent,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save task to database (implement your database logic here)
    // const savedTask = await Task.create(task);

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