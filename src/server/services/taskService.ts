import { Task } from '../types/index';
import { PrismaClient } from '@prisma/client';
import { generateContent } from './contentGenerator';
import { calculateNextExecutionTime } from '../utils/timeUtils';

const prisma = new PrismaClient();


export const createTask = async (taskDefinition: {
  type: Task['type'];
  source: string | null;
  schedule: Task['schedule'];
  action: string;
  parameters: Task['parameters'];
  description: string;
  deliveryMethod?: Task['deliveryMethod'];
}, userId: number): Promise<Task> => {
  // Validate and set default values for schedule
  const schedule: Task['schedule'] = {
    frequency: taskDefinition.schedule?.frequency || 'once',
    time: taskDefinition.schedule?.time || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    day: taskDefinition.schedule?.day || null,
    date: taskDefinition.schedule?.date || (taskDefinition.schedule?.frequency === 'once' ? new Date().toISOString().split('T')[0] : null),
    interval: taskDefinition.schedule?.interval
  };

  const task: Task = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prompt: '',
    type: taskDefinition.type,
    source: taskDefinition.source,
    schedule,
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

export const getTask = async (id: string, userId: number): Promise<Task | undefined> => {
  const dbTask = await prisma.task.findFirst({
    where: { 
      id,
      userId
    }
  });

  if (!dbTask) return undefined;

  return JSON.parse(dbTask.metadata || '{}');
};

export const getAllTasks = async (userId: number): Promise<Task[]> => {
  const dbTasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return dbTasks.map(dbTask => JSON.parse(dbTask.metadata || '{}'));
};

export const updateTaskStatus = async (id: string, userId: number, status: Task['status'], logMessage?: string): Promise<Task | undefined> => {
  const dbTask = await prisma.task.findFirst({
    where: { 
      id,
      userId
    }
  });

  if (!dbTask) return undefined;

  const task = JSON.parse(dbTask.metadata || '{}');
  task.status = status;
  task.lastExecution = new Date().toISOString();
  
  if (logMessage) {
    task.logs.push({
      timestamp: new Date().toISOString(),
      message: logMessage
    });
  }

  await prisma.task.update({
    where: { id },
    data: { metadata: JSON.stringify(task) }
  });

  return task;
};

export const deleteTask = async (id: string, userId: number): Promise<boolean> => {
  try {
    const task = await prisma.task.findFirst({
      where: { 
        id,
        userId
      }
    });

    if (!task) return false;

    await prisma.task.delete({
      where: { id }
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const runTask = async (id: string, userId: number): Promise<Task | undefined> => {
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
        result = `Learning content prepared for: ${(task.parameters as any).topic}`;
        break;
    }
    
    task.previewResult = result;
    
    // For recurring tasks, set status to 'recurring' instead of 'completed'
    const isRecurring = task.schedule?.frequency && task.schedule.frequency !== 'once';
    const nextExecution = isRecurring ? calculateNextExecutionTime(task.schedule, new Date()) : null;
    
    await updateTaskStatus(
      id, 
      userId, 
      isRecurring ? 'recurring' : 'completed', 
      result
    );
    
    // Update next execution time for recurring tasks
    if (isRecurring) {
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