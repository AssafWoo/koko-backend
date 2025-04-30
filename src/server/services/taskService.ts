import { Task, Schedule } from '../types/index';
import { PrismaClient } from '@prisma/client';
import { generateContent } from './contentGenerator';
import { calculateNextExecutionTime } from '../utils/timeUtils';
import { normalizeSchedule } from '../utils/scheduleUtils';

const prisma = new PrismaClient();

export const createTask = async (taskDefinition: {
  type: Task['type'];
  source: string | null;
  schedule: Task['schedule'];
  action: string;
  parameters: Task['parameters'];
  description: string;
  deliveryMethod?: Task['deliveryMethod'];
}, userId: string): Promise<Task> => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentDate = now.toISOString().split('T')[0];

  // Normalize schedule
  const schedule = taskDefinition.schedule ? normalizeSchedule(taskDefinition.schedule as Partial<Schedule>, currentTime, currentDate, '') : null;

  const task: Task = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prompt: '',
    type: taskDefinition.type,
    source: taskDefinition.source,
    schedule: schedule as Task['schedule'],
    action: taskDefinition.action,
    parameters: taskDefinition.parameters,
    previewResult: taskDefinition.description,
    deliveryMethod: taskDefinition.deliveryMethod || 'in-app',
    description: taskDefinition.description,
    logs: [],
    status: 'pending',
    lastExecution: null,
    nextExecution: null,
    isActive: true
  };

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

  await prisma.task.delete({
    where: { id }
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