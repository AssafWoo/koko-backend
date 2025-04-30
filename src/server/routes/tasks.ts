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

const router = express.Router();
const prisma = new PrismaClient();
const ollama = new Ollama();

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
router.post('/', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Received task creation request:', {
      body: req.body,
      user: req.user
    });

    const { prompt } = req.body;
    
    if (!req.user?.id) {
      console.log('No user ID found in request');
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!prompt) {
      console.log('No prompt provided');
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Get current time in HH:mm format with proper timezone handling
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDate = now.toISOString().split('T')[0];
    
    // Extract task intent using LLM
    const parsedIntent = await extractTaskIntent(prompt, currentTime);
    const taskDefinition = parsedIntent.taskDefinition;

    // Normalize schedule
    const schedule = normalizeSchedule(taskDefinition.schedule, currentTime, currentDate, prompt);

    // Create the task
    const task = await createTask({
      type: taskDefinition.type,
      source: null,
      schedule,
      action: taskDefinition.action,
      parameters: taskDefinition.parameters || {},
      description: taskDefinition.description,
      deliveryMethod: 'in-app'
    }, req.user.id);

    console.log('Task created successfully:', task);
    res.status(201).json({
      success: true,
      task,
      parsedIntent
    });
  } catch (error) {
    console.error('Error in task creation:', error);
    next(error);
  }
}) as express.RequestHandler);

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