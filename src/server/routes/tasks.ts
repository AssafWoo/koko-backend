import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '../prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task } from '../types';
import { createTask, getAllTasks, deleteTask, runTask } from '../services/taskService';

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
    
    // Use Mistral to analyze the intent with optimized parameters
    console.log('Analyzing intent for prompt:', prompt);
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
        num_ctx: 2048,
        num_thread: 4
      }
    });

    console.log('Mistral response:', response.message.content);
    
    let parsedIntent;
    try {
      // Clean up the response to ensure valid JSON
      const cleanedResponse = response.message.content.trim();
      
      // Try to fix common JSON issues
      let fixedResponse = cleanedResponse;
      
      // Add missing closing braces if needed
      if (!cleanedResponse.endsWith('}')) {
        const openBraces = (cleanedResponse.match(/{/g) || []).length;
        const closeBraces = (cleanedResponse.match(/}/g) || []).length;
        if (openBraces > closeBraces) {
          fixedResponse = cleanedResponse + '}'.repeat(openBraces - closeBraces);
        }
      }
      
      // Add missing commas if needed
      fixedResponse = fixedResponse.replace(/"\s*}\s*"/g, '", "');
      
      console.log('Cleaned response:', fixedResponse);
      parsedIntent = JSON.parse(fixedResponse);
    } catch (error) {
      console.error('Failed to parse Mistral response:', error);
      console.error('Raw response:', response.message.content);
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
      taskDefinition.schedule.date = currentDate;
      taskDefinition.schedule.frequency = 'once'; // Force one-time for relative time tasks
      console.log('Adjusted time for relative schedule:', {
        originalTime: currentTime,
        calculatedTime,
        currentDate,
        frequency: 'once',
        prompt
      });
    }

    // Validate and set default values for schedule
    const schedule = taskDefinition.schedule || {};
    if (!schedule.time) {
      schedule.time = currentTime;
    }
    if (!schedule.date && schedule.frequency === 'once') {
      schedule.date = currentDate;
    }

    // Create the task
    const task = await createTask({
      type: taskDefinition.type,
      source: null,
      schedule: {
        ...schedule,
        time: schedule.time || null,
        day: schedule.day || null,
        date: schedule.date || null,
        interval: schedule.interval || null
      },
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

// Get task intent
router.post('/intent', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `Extract task details from user prompts:

1. Task Type:
   - reminder: time-based notifications
   - summary: content summarization
   - learning: educational content
   - fetch: data retrieval

2. Schedule:
   - Frequency (once/daily/weekly/monthly/hourly)
   - Time (24h format)
   - Day (weekly tasks)
   - Date (one-time tasks)
   - Interval (recurring)

3. Parameters:
   - Reminders: description, priority
   - Summaries: target, format, length
   - Learning: topic, level
   - Fetch: url, selector

4. Details:
   - Description
   - Delivery method
   - Source (if any)

Return structured JSON matching task schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      format: 'json',
      options: {
        temperature: 0.1,
        num_ctx: 2048,
        num_thread: 4
      }
    });

    console.log('Mistral response:', response.message.content);
    
    let parsedIntent;
    try {
      // Clean up the response to ensure valid JSON
      const cleanedResponse = response.message.content.trim();
      
      // Try to fix common JSON issues
      let fixedResponse = cleanedResponse;
      
      // Add missing closing braces if needed
      if (!cleanedResponse.endsWith('}')) {
        const openBraces = (cleanedResponse.match(/{/g) || []).length;
        const closeBraces = (cleanedResponse.match(/}/g) || []).length;
        if (openBraces > closeBraces) {
          fixedResponse = cleanedResponse + '}'.repeat(openBraces - closeBraces);
        }
      }
      
      // Add missing commas if needed
      fixedResponse = fixedResponse.replace(/"\s*}\s*"/g, '", "');
      
      console.log('Cleaned response:', fixedResponse);
      parsedIntent = JSON.parse(fixedResponse);
    } catch (error) {
      console.error('Failed to parse Mistral response:', error);
      console.error('Raw response:', response.message.content);
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
      taskDefinition.schedule.date = currentDate;
      taskDefinition.schedule.frequency = 'once'; // Force one-time for relative time tasks
      console.log('Adjusted time for relative schedule:', {
        originalTime: currentTime,
        calculatedTime,
        currentDate,
        frequency: 'once',
        prompt
      });
    }

    // Validate and set default values for schedule
    const schedule = taskDefinition.schedule || {};
    if (!schedule.time) {
      schedule.time = currentTime;
    }
    if (!schedule.date && schedule.frequency === 'once') {
      schedule.date = currentDate;
    }

    // Create the task
    const task = await createTask({
      type: taskDefinition.type,
      source: null,
      schedule: {
        ...schedule,
        time: schedule.time || null,
        day: schedule.day || null,
        date: schedule.date || null,
        interval: schedule.interval || null
      },
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

export default router;