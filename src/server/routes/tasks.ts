import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '../prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task } from '../types';
import { createTask, getAllTasks, deleteTask } from '../services/taskService';

const router = Router();
const prisma = new PrismaClient();
const ollama = new Ollama();

// Helper function to calculate relative time
const calculateRelativeTime = (currentTime: string, relativeTime: string): string => {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const now = new Date();
  now.setHours(hours);
  now.setMinutes(minutes);

  // Parse relative time (e.g., "in 1 min", "in 5 minutes", "in 2 hours")
  const match = relativeTime.match(/in (\d+) (min|mins|minute|minutes|hour|hours)/i);
  if (!match) return currentTime;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('min')) {
    now.setMinutes(now.getMinutes() + amount);
  } else if (unit.startsWith('hour')) {
    now.setHours(now.getHours() + amount);
  }

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
router.post('/', authenticateToken, (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('POST /tasks - Request user:', req.user);
    console.log('POST /tasks - Request body:', req.body);
    
    const userId = req.user?.id;
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

    // Use Mistral to analyze the intent
    console.log('Analyzing intent with Mistral for prompt:', prompt);
    const response = await ollama.chat({
      model: 'mistral:instruct',
      messages: [
        {
          role: 'system',
          content: intentPrompt
            .replace('{USER_PROMPT}', prompt)
            .replace('{CURRENT_TIME}', currentTime)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      format: 'json',
      options: {
        temperature: 0.1,
        num_ctx: 4096,
        num_thread: 8
      }
    });

    console.log('Mistral response:', response.message.content);

    let parsedIntent;
    try {
      parsedIntent = JSON.parse(response.message.content);
    } catch (error) {
      console.error('Failed to parse Mistral response:', error);
      res.status(400).json({
        error: 'Failed to parse task definition',
        success: false,
        details: 'Invalid JSON response from LLM',
        rawResponse: response.message.content
      });
      return;
    }

    if (!parsedIntent.taskDefinition) {
      res.status(400).json({
        error: 'Invalid task definition',
        success: false,
        details: 'Missing task definition in response',
        rawResponse: response.message.content
      });
      return;
    }

    const taskDefinition = parsedIntent.taskDefinition;

    // Check if the prompt contains relative time and adjust the schedule accordingly
    if (prompt.toLowerCase().includes('in ') && (prompt.toLowerCase().includes('min') || prompt.toLowerCase().includes('hour'))) {
      const calculatedTime = calculateRelativeTime(currentTime, prompt);
      taskDefinition.schedule.time = calculatedTime;
      console.log('Adjusted time for relative schedule:', {
        originalTime: currentTime,
        calculatedTime,
        prompt
      });
    }

    // Validate and set default values for schedule
    const schedule = taskDefinition.schedule || {};
    if (!schedule.time) {
      schedule.time = currentTime;
    }
    if (!schedule.date && schedule.frequency === 'once') {
      schedule.date = new Date().toISOString().split('T')[0];
    }

    // Create the task according to the Task interface
    const task: Task = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      prompt,
      type: taskDefinition.type,
      source: taskDefinition.source,
      schedule: {
        ...schedule,
        time: schedule.time || null,
        day: schedule.day || null,
        date: schedule.date || null,
        interval: schedule.interval || null
      },
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

    // Save to database
    const dbTask = await prisma.task.create({
      data: {
        id: task.id,
        description: task.description,
        type: task.type,
        userId,
        metadata: JSON.stringify(task)
      }
    });

    console.log('Created task:', dbTask);
    res.status(201).json({
      success: true,
      task,
      parsedIntent
    });
  } catch (error) {
    console.error('Error in POST /tasks:', error);
    next(error);
  }
}) as RequestHandler);

// Delete a task
router.delete('/:id', authenticateToken, (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('DELETE /tasks/:id - Request user:', req.user);
    const userId = req.user?.id;
    if (!userId) {
      console.log('Invalid user ID in request');
      res.status(401).json({ message: 'Invalid user ID' });
      return;
    }

    const taskId = req.params.id;
    const success = await deleteTask(taskId, userId);

    if (!success) {
      console.log('Task not found or not owned by user');
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    console.log('Deleted task:', taskId);
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /tasks/:id:', error);
    next(error);
  }
}) as RequestHandler);

export default router; 