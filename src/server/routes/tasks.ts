import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma, Task as PrismaTask, TaskStatus } from '@prisma/client';
import { authenticateToken } from '@server/middleware/auth';
import { Ollama } from 'ollama';
import { intentPrompt } from '@server/prompts/intentPrompt';
import { RequestHandler } from 'express';
import { Task as AppTask, TaskType, Schedule } from '@server/types';
import { TaskRepository } from '@server/repository/TaskRepository';
import { extractTaskIntent } from '@server/utils/llmUtils';
import { normalizeSchedule } from '@server/utils/scheduleUtils';
import { calculateRelativeTime, RelativeTimeResult, formatDate } from '@server/utils/timeUtils';
import { LLMTaskRouter } from '@server/services/llmTaskRouter';
import crypto from 'crypto';
import { eventBus, EVENTS, TaskEvent } from '@server/events/EventBus';
import { createNotificationContent, sendNotification } from '@server/services/notificationService';

// Extend the Task type to include our custom properties
interface ExtendedTask extends AppTask {
  status: TaskStatus;
  scheduledTime: Date;
  priority: number;
  frequency: string | null;
  lastRunAt: Date | null;
  lastResult: string | null;
}

const router = express.Router();
const prisma = new PrismaClient();
const ollama = new Ollama();
const llmRouter = LLMTaskRouter.getInstance();
const taskRepository = new TaskRepository(prisma);

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

// Helper function to create a Date object from time and date strings
const createDateTime = (time: string, date: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const dateTime = new Date(year, month - 1, day, hours, minutes);
  return dateTime;
};

// Helper function to get date for 'this' or 'next' day reference
const getDayReferenceDate = (dayName: string, reference: 'this' | 'next'): Date => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return new Date();

  const now = new Date();
  const currentDay = now.getDay();
  let daysToAdd = targetDay - currentDay;
  
  if (reference === 'next') {
    daysToAdd = daysToAdd <= 0 ? daysToAdd + 7 : daysToAdd;
  } else if (reference === 'this') {
    daysToAdd = daysToAdd < 0 ? daysToAdd + 7 : daysToAdd;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysToAdd);
  return targetDate;
};

// Helper function to check for day references in prompt
const extractDayReference = (prompt: string): { day: string | null; reference: 'this' | 'next' | null } => {
  const lowerPrompt = prompt.toLowerCase();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (const day of days) {
    if (lowerPrompt.includes(`this ${day}`)) {
      return { day, reference: 'this' };
    }
    if (lowerPrompt.includes(`next ${day}`)) {
      return { day, reference: 'next' };
    }
  }
  
  return { day: null, reference: null };
};

// Helper function to check for specific day of week in prompt
const extractDayOfWeek = (prompt: string): string | null => {
  const lowerPrompt = prompt.toLowerCase();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (const day of days) {
    if (lowerPrompt.includes(day)) {
      return day;
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
    const tasks = await prisma.task.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
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

    let scheduledTime: Date | null = null;
    let scheduleTime: string | null = null;
    let scheduleDate: string | null = null;

    // Check for time-of-day keywords first
    const timeOfDayTime = convertTimeOfDayToTime(prompt);
    const lowerPrompt = prompt.toLowerCase();

    // Check for day references (this/next day)
    const dayReference = extractDayReference(prompt);
    if (dayReference.day && dayReference.reference) {
      const targetDate = getDayReferenceDate(dayReference.day, dayReference.reference);
      scheduleDate = formatDate(targetDate);
      scheduleTime = timeOfDayTime || currentTime;
      scheduledTime = createDateTime(scheduleTime, scheduleDate);
      parsedIntent.taskDefinition.schedule = {
        ...parsedIntent.taskDefinition.schedule,
        frequency: 'once',
        time: scheduleTime,
        date: scheduleDate
      };
    }
    // Handle weekly recurring tasks with specific day
    else if (lowerPrompt.includes('every') && lowerPrompt.includes('week')) {
      const dayOfWeek = extractDayOfWeek(prompt);
      if (dayOfWeek) {
        const targetDate = getDayReferenceDate(dayOfWeek, 'this');
        scheduleDate = formatDate(targetDate);
        scheduleTime = timeOfDayTime || currentTime;
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'weekly',
          time: scheduleTime,
          date: scheduleDate,
          day: dayOfWeek
        };
      }
    }
    // Handle common time expressions
    else if (lowerPrompt.includes('every week') || lowerPrompt.includes('weekly') || lowerPrompt.includes('once a week')) {
      parsedIntent.taskDefinition.schedule.frequency = 'weekly';
      scheduleTime = parsedIntent.taskDefinition.schedule.time || currentTime;
      scheduleDate = formatDate(now);
      scheduledTime = createDateTime(scheduleTime, scheduleDate);
    }
    else if (lowerPrompt.includes('every day') || lowerPrompt.includes('daily') || 
             lowerPrompt.includes('once a day') || lowerPrompt.includes('everyday')) {
      parsedIntent.taskDefinition.schedule.frequency = 'daily';
      scheduleTime = parsedIntent.taskDefinition.schedule.time || currentTime;
      scheduleDate = formatDate(now);
      scheduledTime = createDateTime(scheduleTime, scheduleDate);
    }
    else if (lowerPrompt.includes('every hour') || lowerPrompt.includes('hourly') || 
             lowerPrompt.includes('once an hour')) {
      parsedIntent.taskDefinition.schedule.frequency = 'hourly';
      scheduleTime = parsedIntent.taskDefinition.schedule.time || currentTime;
      scheduleDate = formatDate(now);
      scheduledTime = createDateTime(scheduleTime, scheduleDate);
    }
    // Handle multiple times per period
    else if (lowerPrompt.includes('times a day') || lowerPrompt.includes('times per day')) {
      const timesMatch = lowerPrompt.match(/(\d+)\s*times?\s*a\s*day/);
      if (timesMatch) {
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'multiple_times',
          timesPerDay: parseInt(timesMatch[1]),
          time: currentTime
        };
        scheduleTime = currentTime;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    else if (lowerPrompt.includes('times a week') || lowerPrompt.includes('times per week')) {
      const timesMatch = lowerPrompt.match(/(\d+)\s*times?\s*a\s*week/);
      if (timesMatch) {
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'multiple_times',
          timesPerWeek: parseInt(timesMatch[1]),
          time: currentTime
        };
        scheduleTime = currentTime;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    else if (lowerPrompt.includes('times a month') || lowerPrompt.includes('times per month')) {
      const timesMatch = lowerPrompt.match(/(\d+)\s*times?\s*a\s*month/);
      if (timesMatch) {
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'multiple_times',
          timesPerMonth: parseInt(timesMatch[1]),
          time: currentTime
        };
        scheduleTime = currentTime;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    else if (lowerPrompt.includes('times an hour') || lowerPrompt.includes('times per hour')) {
      const timesMatch = lowerPrompt.match(/(\d+)\s*times?\s*an?\s*hour/);
      if (timesMatch) {
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'multiple_times',
          timesPerHour: parseInt(timesMatch[1]),
          time: currentTime
        };
        scheduleTime = currentTime;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    // Handle minute-based intervals
    else if (lowerPrompt.includes('every') && (lowerPrompt.includes('min') || lowerPrompt.includes('mint'))) {
      const minutesMatch = lowerPrompt.match(/every\s+(\d+)\s*(?:min|mint)(?:ute)?s?/i);
      if (minutesMatch) {
        parsedIntent.taskDefinition.schedule = {
          ...parsedIntent.taskDefinition.schedule,
          frequency: 'every_x_minutes',
          interval: parseInt(minutesMatch[1]),
          time: currentTime
        };
        scheduleTime = currentTime;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    // Handle "tomorrow" specifically
    else if (lowerPrompt.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      parsedIntent.taskDefinition.schedule = {
        ...parsedIntent.taskDefinition.schedule,
        frequency: 'once',
        time: currentTime,
        date: formatDate(tomorrow)
      };
      scheduleTime = currentTime;
      scheduleDate = formatDate(tomorrow);
      scheduledTime = createDateTime(scheduleTime, scheduleDate);
    }
    // Handle relative time (in X minutes/hours)
    else if (prompt.toLowerCase().includes('in ') && 
            (prompt.toLowerCase().includes('min') || 
             prompt.toLowerCase().includes('hour') ||
             prompt.toLowerCase().includes('half an hour'))) {
      const calculatedTime = calculateRelativeTime(currentTime, prompt);
      scheduleTime = calculatedTime.time;
      scheduleDate = calculatedTime.date;
      scheduledTime = createDateTime(calculatedTime.time, calculatedTime.date);
      parsedIntent.taskDefinition.schedule = {
        ...parsedIntent.taskDefinition.schedule,
        time: calculatedTime.time,
        date: calculatedTime.date,
        frequency: 'once'
      };
    }

    if (!scheduledTime || !scheduleTime || !scheduleDate) {
      throw new Error('Could not determine scheduled time for task');
    }

    // Process the task with the appropriate LLM
    const tempTask: AppTask = {
      id: crypto.randomUUID(),
      description: parsedIntent.taskDefinition.description,
      type: parsedIntent.taskDefinition.type,
      metadata: JSON.stringify({
        prompt,
        schedule: {
          ...parsedIntent.taskDefinition.schedule,
          day: parsedIntent.taskDefinition.schedule.day || null,
          date: scheduleDate,
          time: scheduleTime
        },
        action: parsedIntent.taskDefinition.action,
        parameters: parsedIntent.taskDefinition.parameters,
        previewResult: '',
        deliveryMethod: 'in-app'
      }),
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: TaskStatus.PENDING,
      scheduledTime: new Date(scheduledTime),
      frequency: parsedIntent.taskDefinition.schedule.frequency || null,
      lastRunAt: null,
      lastResult: null,
      priority: 0
    };

    const taskContent = await llmRouter.processTask(tempTask, prompt);

    // Create the task in the database
    const taskData = {
      description: parsedIntent.taskDefinition.description,
      type: parsedIntent.taskDefinition.type,
      metadata: JSON.stringify({
        prompt,
        previewResult: taskContent,
        schedule: {
          ...parsedIntent.taskDefinition.schedule,
          day: parsedIntent.taskDefinition.schedule.day || null,
          date: scheduleDate,
          time: scheduleTime,
          interval: parsedIntent.taskDefinition.schedule.interval || null,
          frequency: parsedIntent.taskDefinition.schedule.frequency || null
        },
        status: 'PENDING',
        lastExecution: null
      }),
      userId: userId,
      scheduledTime: new Date(scheduledTime),
      frequency: parsedIntent.taskDefinition.schedule.frequency || null,
      priority: 0,
      status: TaskStatus.PENDING,
      lastRunAt: null,
      lastResult: null
    };

    const task = await taskRepository.createTask(taskData);
    console.log('Created task with metadata:', task.metadata);
    res.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    next(error);
  }
}) as RequestHandler);

// Run a task
router.post('/:id/run', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  let taskWithRequiredFields: AppTask | null = null;
  const { id } = req.params;

  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    // Get the task
    const task = await taskRepository.getTaskById(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Update status to processing
    await taskRepository.updateTaskStatus(id, TaskStatus.PROCESSING);
    
    // Process the task
    const metadata = task.metadata ? JSON.parse(task.metadata) : {};
    if (!task) {
      throw new Error('Task not found');
    }

    // Convert Prisma task to AppTask
    const taskType = task.type as TaskType;
    taskWithRequiredFields = {
      id: task.id,
      description: task.description,
      type: taskType,
      metadata: task.metadata,
      userId: task.userId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      status: 'PENDING',
      scheduledTime: new Date(),
      lastRunAt: null,
      priority: 0,
      frequency: null,
      lastResult: null,
      parameters: metadata.parameters || {},
      schedule: metadata.schedule
    };

    // Send notification that task is starting
    const startNotification = createNotificationContent(
      taskWithRequiredFields,
      `Task "${task.description}" is starting`,
      'info'
    );
    await sendNotification('taskStarted', startNotification);

    // Emit task due event
    const taskEvent: TaskEvent = { task: taskWithRequiredFields };
    eventBus.emit(EVENTS.TASK_DUE, taskEvent);

    // Process the task with the appropriate parameters
    const result = await llmRouter.processTask(taskWithRequiredFields, metadata.prompt || task.description);
    
    // Save the result
    const updatedTask = await taskRepository.saveTaskResult(id, result);
    if (!updatedTask) {
      throw new Error('Failed to update task result');
    }

    // Send notification that task is completed
    const completeNotification = createNotificationContent(
      taskWithRequiredFields,
      `Task "${task.description}" completed successfully`,
      'success'
    );
    await sendNotification('taskCompleted', completeNotification);

    // Emit task completed event
    eventBus.emit(EVENTS.TASK_COMPLETED, taskEvent);

    res.json(updatedTask);
  } catch (error: any) {
    if (taskWithRequiredFields) {
      // Update task status to error
      await taskRepository.updateTaskStatus(id, TaskStatus.ERROR);

      // Send error notification
      const errorNotification = createNotificationContent(
        taskWithRequiredFields,
        `Error in task "${taskWithRequiredFields.description}": ${error?.message || 'Unknown error'}`,
        'error'
      );
      await sendNotification('taskError', errorNotification);

      // Emit task error event
      eventBus.emit(EVENTS.TASK_ERROR, {
        task: taskWithRequiredFields,
        error: error?.message || 'Unknown error'
      });
    }

    next(error);
  }
}) as RequestHandler);

// Delete a task
router.delete('/:id', authenticateToken, (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const task = await taskRepository.deleteTask(id);
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

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
}) as RequestHandler);

export default router;