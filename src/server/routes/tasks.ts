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

    // Handle common time expressions
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('every week') || lowerPrompt.includes('weekly') || lowerPrompt.includes('once a week')) {
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
    // Handle weekly schedules with specific days
    else if (parsedIntent.taskDefinition.schedule.frequency === 'weekly' && parsedIntent.taskDefinition.schedule.day) {
      const dayMap: { [key: string]: number } = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
      };
      
      const dayName = parsedIntent.taskDefinition.schedule.day.toLowerCase();
      const dayNumber = dayMap[dayName];
      
      if (dayNumber !== undefined) {
        parsedIntent.taskDefinition.schedule.day = dayNumber.toString();
        scheduleTime = parsedIntent.taskDefinition.schedule.time;
        scheduleDate = formatDate(now);
        scheduledTime = createDateTime(scheduleTime, scheduleDate);
      }
    }
    // Check for time-of-day keywords
    else if (timeOfDayTime) {
      console.log('Converting time-of-day to specific time:', {
        prompt,
        timeOfDayTime
      });
      scheduleTime = timeOfDayTime;
      scheduleDate = formatDate(now);
      scheduledTime = createDateTime(timeOfDayTime, scheduleDate);
    }
    // If no time-of-day match, check for relative time
    else if (prompt.toLowerCase().includes('in ') && 
            (prompt.toLowerCase().includes('min') || 
             prompt.toLowerCase().includes('hour') ||
             prompt.toLowerCase().includes('half an hour'))) {
      // Use the utility function for relative time
      const calculatedTime: RelativeTimeResult = calculateRelativeTime(currentTime, prompt);
      scheduleTime = calculatedTime.time;
      scheduleDate = calculatedTime.date;
      scheduledTime = createDateTime(calculatedTime.time, calculatedTime.date);
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
          time: scheduleTime
        }
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