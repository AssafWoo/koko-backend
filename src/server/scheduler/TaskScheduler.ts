import { eventBus, EVENTS, TaskEvent } from '../events/EventBus';
import { TaskRepository } from '../repository/TaskRepository';
import { Task as PrismaTask, TaskStatus } from '@prisma/client';
import { Task as TaskType, Schedule } from '@server/types';
import { createNotificationContent, sendNotification } from '@server/services/notificationService';

export class TaskScheduler {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute

  constructor(private taskRepository: TaskRepository) {}

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('[TaskScheduler] Starting task scheduler...');

    // Initial check
    await this.checkTasks();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkTasks().catch(error => {
        console.error('[TaskScheduler] Error in task scheduler:', error);
      });
    }, this.CHECK_INTERVAL_MS);
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[TaskScheduler] Task scheduler stopped');
  }

  private async checkTasks(): Promise<void> {
    try {
      const now = new Date();
      console.log(`[TaskScheduler] Checking tasks at ${now.toISOString()}`);

      // Get pending tasks
      const pendingTasks = await this.taskRepository.findPendingTasks();
      console.log(`[TaskScheduler] Found ${pendingTasks.length} pending tasks`);

      // Process each task
      for (const task of pendingTasks) {
        await this.processTask(task);
      }
    } catch (error) {
      console.error('[TaskScheduler] Error checking tasks:', error);
    }
  }

  private async processTask(prismaTask: PrismaTask): Promise<void> {
    try {
      console.log(`[TaskScheduler] Processing task ${prismaTask.id}: ${prismaTask.description}`);
      
      // Convert Prisma task to our Task type
      const task: TaskType = {
        ...prismaTask,
        type: prismaTask.type as TaskType['type'],
        schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata) as Schedule : undefined
      };
      
      // Update task status to processing
      await this.taskRepository.updateTaskStatus(task.id, TaskStatus.PROCESSING);

      // Send notification that task is starting
      const startNotification = createNotificationContent(
        task,
        `Task "${task.description}" is starting`,
        'info'
      );
      await sendNotification('taskStarted', startNotification);

      // Emit task due event
      const taskEvent: TaskEvent = { task };
      eventBus.emit(EVENTS.TASK_DUE, taskEvent);

      // Execute task based on type
      let result: string;
      switch (task.type) {
        case 'reminder':
          result = await this.executeReminderTask(task);
          break;
        case 'summary':
          result = await this.executeSummaryTask(task);
          break;
        case 'fetch':
          result = await this.executeFetchTask(task);
          break;
        case 'learning':
          result = await this.executeLearningTask(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Save task result
      await this.taskRepository.saveTaskResult(task.id, result);

      // Update task status to completed
      await this.taskRepository.updateTaskStatus(task.id, TaskStatus.COMPLETED);

      // Send completion notification
      const completionNotification = createNotificationContent(
        task,
        `Task "${task.description}" completed successfully`,
        'success'
      );
      await sendNotification('taskCompleted', completionNotification);

      // Emit task completed event
      eventBus.emit(EVENTS.TASK_COMPLETED, taskEvent);

      // Handle recurring tasks
      if (task.schedule?.frequency !== 'once') {
        await this.scheduleNextOccurrence(task);
      }

    } catch (error: any) {
      console.error(`[TaskScheduler] Error processing task ${prismaTask.id}:`, error);

      // Update task status to error
      await this.taskRepository.updateTaskStatus(prismaTask.id, TaskStatus.ERROR);

      // Send error notification
      const errorNotification = createNotificationContent(
        {
          ...prismaTask,
          type: prismaTask.type as TaskType['type'],
          schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata) as Schedule : undefined
        },
        `Error in task "${prismaTask.description}": ${error?.message || 'Unknown error'}`,
        'error'
      );
      await sendNotification('taskError', errorNotification);

      // Emit task error event
      eventBus.emit(EVENTS.TASK_ERROR, {
        task: {
          ...prismaTask,
          type: prismaTask.type as TaskType['type'],
          schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata) as Schedule : undefined
        },
        error: error?.message || 'Unknown error'
      });
    }
  }

  private async executeReminderTask(task: TaskType): Promise<string> {
    // Implement reminder task execution
    return `Reminder executed: ${task.description}`;
  }

  private async executeSummaryTask(task: TaskType): Promise<string> {
    // Implement summary task execution
    return `Summary generated: ${task.description}`;
  }

  private async executeFetchTask(task: TaskType): Promise<string> {
    // Implement fetch task execution
    return `Content fetched: ${task.description}`;
  }

  private async executeLearningTask(task: TaskType): Promise<string> {
    // Implement learning task execution
    return `Learning content generated: ${task.description}`;
  }

  private async scheduleNextOccurrence(task: TaskType): Promise<void> {
    try {
      const nextScheduledTime = this.calculateNextScheduledTime(task);
      if (nextScheduledTime) {
        const { id, createdAt, updatedAt, ...taskData } = task;
        await this.taskRepository.createTask({
          ...taskData,
          status: TaskStatus.PENDING,
          scheduledTime: nextScheduledTime
        });
        console.log(`[TaskScheduler] Scheduled next occurrence for task ${task.id} at ${nextScheduledTime.toISOString()}`);
      }
    } catch (error) {
      console.error(`[TaskScheduler] Error scheduling next occurrence for task ${task.id}:`, error);
    }
  }

  private calculateNextScheduledTime(task: TaskType): Date | null {
    if (!task.schedule) return null;

    const now = new Date();
    const { frequency, interval } = task.schedule;

    switch (frequency) {
      case 'daily':
        return new Date(now.setDate(now.getDate() + 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + 7));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      case 'hourly':
        return new Date(now.setHours(now.getHours() + 1));
      case 'every_x_minutes':
        return new Date(now.setMinutes(now.getMinutes() + (interval || 5)));
      default:
        return null;
    }
  }
} 