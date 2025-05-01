import { Task, Schedule, TaskType } from '@server/types/index';
import { PrismaClient } from '@prisma/client';
import { generateContent } from './contentGenerator.js';
import { calculateNextExecutionTime, calculateRelativeTime } from '@server/utils/timeUtils.js';
import { normalizeSchedule } from '@server/utils/scheduleUtils';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface TaskInput {
  type: TaskType;
  source: string | null;
  schedule: Schedule;
  action: string;
  parameters: any;
  prompt: string;
  previewResult: string;
  description?: string;
  deliveryMethod?: 'in-app' | 'email' | 'slack';
}

export const createTask = async (taskInput: TaskInput, userId: string): Promise<Task> => {
  // Get current time in HH:mm format
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  console.log('Processing task with prompt:', taskInput.prompt);
  console.log('Current time:', currentTime);
  
  // Check if the prompt contains relative time and adjust the schedule accordingly
  const prompt = taskInput.prompt?.toLowerCase() || '';
  const hasRelativeTime = prompt.includes('in ') && (
    prompt.includes('min') || 
    prompt.includes('hour') ||
    prompt.includes('half an hour')
  );

  if (hasRelativeTime) {
    console.log('Detected relative time in prompt');
    const calculatedTime = calculateRelativeTime(currentTime, prompt);
    console.log('Calculated time:', calculatedTime);
    
    taskInput.schedule = {
      ...taskInput.schedule,
      time: calculatedTime.time,
      date: calculatedTime.date,
      frequency: 'once'
    };
  }

  // Create the task object
  const task: Task = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prompt: taskInput.prompt,
    type: taskInput.type,
    source: taskInput.source,
    schedule: {
      ...taskInput.schedule,
      day: taskInput.schedule.frequency === 'weekly' ? (taskInput.schedule.day || '0') : taskInput.schedule.day
    },
    action: taskInput.action,
    parameters: taskInput.parameters,
    previewResult: taskInput.previewResult,
    deliveryMethod: taskInput.deliveryMethod || 'in-app',
    description: taskInput.description || taskInput.previewResult,
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

  return task;
};

export const getAllTasks = async (userId: string): Promise<Task[]> => {
  const tasks = await prisma.task.findMany({
    where: { userId }
  });

  return tasks.map(task => {
    if (!task.metadata) throw new Error('Task metadata is missing');
    return JSON.parse(task.metadata);
  });
};

export const getTask = async (id: string, userId: string): Promise<Task | undefined> => {
  const task = await prisma.task.findFirst({
    where: { id, userId }
  });

  if (!task || !task.metadata) return undefined;
  return JSON.parse(task.metadata);
};

export const deleteTask = async (id: string, userId: string): Promise<boolean> => {
  const task = await prisma.task.findFirst({
    where: { id, userId }
  });

  if (!task) return false;

  // Instead of deleting, mark as inactive
  const metadata = JSON.parse(task.metadata || '{}');
  await prisma.task.update({
    where: { id },
    data: {
      metadata: JSON.stringify({
        ...metadata,
        isActive: false,
        status: 'deleted'
      })
    }
  });

  return true;
};

export const updateTaskStatus = async (
  id: string,
  userId: string,
  status: Task['status'],
  previewResult?: string
): Promise<void> => {
  const task = await getTask(id, userId);
  if (!task) return;

  const updatedTask = {
    ...task,
    status,
    previewResult: previewResult || task.previewResult
  };

  await prisma.task.update({
    where: { id },
    data: {
      metadata: JSON.stringify(updatedTask)
    }
  });
};

export const runTask = async (id: string, userId: string): Promise<Task | undefined> => {
  const task = await getTask(id, userId);
  if (!task) return undefined;

  await updateTaskStatus(id, userId, 'running', `Task started at ${new Date().toISOString()}`);
  
  try {
    let result = '';
    
    switch (task.type) {
      case 'summary':
        result = await generateContent('facts', task.parameters);
        break;

      case 'reminder':
        result = `Reminder: ${task.description}`;
        break;

      case 'fetch':
        result = `Fetched content from: ${(task.parameters as any).target}`;
        break;

      case 'learning':
        result = await generateContent('learning', task.parameters);
        break;
    }
    
    task.previewResult = result;
    
    // For recurring tasks, set status to 'recurring' instead of 'completed'
    const isRecurring = task.schedule?.frequency && task.schedule.frequency !== 'once';
    const nextExecution = isRecurring && task.schedule ? calculateNextExecutionTime({
      frequency: task.schedule.frequency === 'continuous' ? 'hourly' : task.schedule.frequency,
      time: task.schedule.time,
      day: task.schedule.day,
      date: task.schedule.date,
      interval: task.schedule.interval
    }, new Date()) : null;
    
    await updateTaskStatus(
      id, 
      userId, 
      isRecurring ? 'recurring' : 'completed', 
      result
    );
    
    // Update next execution time for recurring tasks
    if (isRecurring && task.schedule) {
      await prisma.task.update({
        where: { id },
        data: { 
          metadata: JSON.stringify({
            ...task,
            nextExecution
          })
        }
      });
    }
    
    return getTask(id, userId);
  } catch (error) {
    const errorMessage = `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    await updateTaskStatus(id, userId, 'failed', errorMessage);
    return getTask(id, userId);
  }
};

export const updateTask = async (
  id: string,
  userId: string,
  updates: {
    description?: string;
    schedule?: {
      time?: string | null;
      day?: string | null;
      frequency?: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly' | 'every_x_minutes' | 'continuous';
    };
    type?: TaskType;
  }
): Promise<Task | undefined> => {
  const task = await getTask(id, userId);
  if (!task) return undefined;

  const updatedTask: Task = {
    ...task,
    updatedAt: new Date().toISOString(),
    description: updates.description ?? task.description,
    type: updates.type ?? task.type,
    schedule: updates.schedule ? {
      ...task.schedule,
      time: updates.schedule.time ?? task.schedule?.time ?? null,
      day: updates.schedule.day ?? task.schedule?.day ?? null,
      frequency: updates.schedule.frequency ?? task.schedule?.frequency ?? 'once',
      date: task.schedule?.date ?? null,
      interval: task.schedule?.interval
    } : task.schedule
  };

  await prisma.task.update({
    where: { id },
    data: {
      description: updatedTask.description,
      type: updatedTask.type,
      metadata: JSON.stringify(updatedTask)
    }
  });

  return updatedTask;
}; 