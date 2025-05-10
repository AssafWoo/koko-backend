import { eventBus, EVENTS, TaskEvent } from '../events/EventBus';
import { TaskRepository } from '../repository/TaskRepository';
import { Task as PrismaTask, TaskStatus } from '@prisma/client';
import { Task as TaskType, Schedule } from '@server/types';
import { createNotificationContent, sendNotification } from '../services/notificationService';

export class TaskScheduler {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 10000; // Check every 10 seconds for more precise timing

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
      
      // Log details of each pending task
      for (const task of pendingTasks) {
        console.log(`[TaskScheduler] Pending task details:`, {
          id: task.id,
          description: task.description,
          scheduledTime: task.scheduledTime,
          frequency: task.frequency,
          metadata: task.metadata ? JSON.parse(task.metadata) : null
        });
      }

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
      console.log(`[TaskScheduler] Current task metadata:`, prismaTask.metadata);
      
      // Convert Prisma task to our Task type
      const task: TaskType = {
        ...prismaTask,
        type: prismaTask.type as TaskType['type'],
        schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata).schedule : undefined
      };
      
      console.log(`[TaskScheduler] Task schedule:`, task.schedule);
      
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

      // For recurring tasks, schedule the next occurrence before marking as completed
      if (task.schedule?.frequency !== 'once' && task.schedule) {
        console.log(`[TaskScheduler] Scheduling next occurrence for recurring task ${task.id}`);
        console.log(`[TaskScheduler] Current task schedule:`, task.schedule);
        
        const nextScheduledTime = this.calculateNextScheduledTime(task);
        console.log(`[TaskScheduler] Calculated next scheduled time: ${nextScheduledTime?.toISOString()}`);
        
        if (nextScheduledTime) {
          // Parse existing metadata
          const existingMetadata = task.metadata ? JSON.parse(task.metadata) : {};
          console.log(`[TaskScheduler] Existing metadata:`, existingMetadata);
          
          // Create new task with updated metadata
          const nextTaskData = {
            description: task.description,
            type: task.type,
            userId: task.userId,
            status: TaskStatus.PENDING,
            scheduledTime: nextScheduledTime,
            frequency: task.schedule.frequency,
            priority: task.priority,
            lastRunAt: null,
            lastResult: null,
            metadata: JSON.stringify({
              ...existingMetadata,
              schedule: {
                frequency: task.schedule.frequency,
                interval: task.schedule.interval,
                time: nextScheduledTime.toTimeString().slice(0, 5),
                date: nextScheduledTime.toISOString().split('T')[0]
              }
            })
          };
          
          console.log(`[TaskScheduler] Creating next task with data:`, nextTaskData);
          
          const nextTask = await this.taskRepository.createTask(nextTaskData);
          console.log(`[TaskScheduler] Successfully created next occurrence task:`, {
            id: nextTask.id,
            description: nextTask.description,
            scheduledTime: nextTask.scheduledTime,
            frequency: nextTask.frequency,
            metadata: nextTask.metadata
          });
        } else {
          console.log(`[TaskScheduler] Failed to calculate next scheduled time for task ${task.id}`);
        }
      }

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

    } catch (error: any) {
      console.error(`[TaskScheduler] Error processing task ${prismaTask.id}:`, error);

      // Update task status to error
      await this.taskRepository.updateTaskStatus(prismaTask.id, TaskStatus.ERROR);

      // Send error notification
      const errorNotification = createNotificationContent(
        {
          ...prismaTask,
          type: prismaTask.type as TaskType['type'],
          schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata).schedule : undefined
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
          schedule: prismaTask.metadata ? JSON.parse(prismaTask.metadata).schedule : undefined
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
    if (!task.schedule) {
      console.log(`[TaskScheduler] No schedule found for task ${task.id}`);
      return null;
    }

    const baseTime = task.scheduledTime || new Date();
    const { frequency, interval } = task.schedule;
    console.log(`[TaskScheduler] Calculating next time for frequency: ${frequency}, interval: ${interval}`);

    try {
      switch (frequency) {
        case 'every_x_minutes':
          if (!interval) {
            console.log(`[TaskScheduler] No interval specified for every_x_minutes task`);
            return null;
          }
          const nextTime = new Date(baseTime);
          nextTime.setMinutes(baseTime.getMinutes() + interval);
          console.log(`[TaskScheduler] Next time for every_x_minutes: ${nextTime.toISOString()}`);
          return nextTime;
        
        case 'daily':
          const nextDay = new Date(baseTime);
          nextDay.setDate(baseTime.getDate() + 1);
          console.log(`[TaskScheduler] Next time for daily: ${nextDay.toISOString()}`);
          return nextDay;
        
        case 'weekly':
          const nextWeek = new Date(baseTime);
          nextWeek.setDate(baseTime.getDate() + 7);
          console.log(`[TaskScheduler] Next time for weekly: ${nextWeek.toISOString()}`);
          return nextWeek;
        
        case 'monthly':
          const nextMonth = new Date(baseTime);
          nextMonth.setMonth(baseTime.getMonth() + 1);
          console.log(`[TaskScheduler] Next time for monthly: ${nextMonth.toISOString()}`);
          return nextMonth;
        
        case 'hourly':
          const nextHour = new Date(baseTime);
          nextHour.setHours(baseTime.getHours() + 1);
          console.log(`[TaskScheduler] Next time for hourly: ${nextHour.toISOString()}`);
          return nextHour;
        
        case 'multiple_times':
          if (task.schedule.timesPerHour) {
            const minutesBetween = Math.floor(60 / task.schedule.timesPerHour);
            const nextTime = new Date(baseTime);
            nextTime.setMinutes(baseTime.getMinutes() + minutesBetween);
            return nextTime;
          }
          if (task.schedule.timesPerDay) {
            const hoursBetween = Math.floor(24 / task.schedule.timesPerDay);
            const nextTime = new Date(baseTime);
            nextTime.setHours(baseTime.getHours() + hoursBetween);
            return nextTime;
          }
          if (task.schedule.timesPerWeek) {
            const daysBetween = Math.floor(7 / task.schedule.timesPerWeek);
            const nextTime = new Date(baseTime);
            nextTime.setDate(baseTime.getDate() + daysBetween);
            return nextTime;
          }
          if (task.schedule.timesPerMonth) {
            const daysBetween = Math.floor(30 / task.schedule.timesPerMonth);
            const nextTime = new Date(baseTime);
            nextTime.setDate(baseTime.getDate() + daysBetween);
            return nextTime;
          }
          return null;
        
        case 'once':
          if (task.schedule.date) {
            const [year, month, day] = task.schedule.date.split('-').map(Number);
            const time = task.schedule.time || '00:00';
            const [hours, minutes] = time.split(':').map(Number);
            return new Date(year, month - 1, day, hours, minutes);
          }
          return null;
        
        default:
          console.log(`[TaskScheduler] Unknown frequency: ${frequency}`);
          return null;
      }
    } catch (error) {
      console.error(`[TaskScheduler] Error calculating next scheduled time:`, error);
      return null;
    }
  }
} 