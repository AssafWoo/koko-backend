import { eventBus, EVENTS, TaskEvent, NotificationEvent } from '../events/EventBus';
import { PrismaClient } from '@prisma/client';

export class NotificationService {
  constructor(private prisma: PrismaClient) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for task due events
    eventBus.on(EVENTS.TASK_DUE, this.handleTaskDue.bind(this));
    
    // Listen for task completed events
    eventBus.on(EVENTS.TASK_COMPLETED, this.handleTaskCompleted.bind(this));
    
    // Listen for task error events
    eventBus.on(EVENTS.TASK_ERROR, this.handleTaskError.bind(this));
  }

  private async handleTaskDue(event: TaskEvent) {
    const { task } = event;
    
    // Get user preferences for notifications
    const user = await this.prisma.user.findUnique({
      where: { id: task.userId }
    });

    if (!user) {
      console.error(`User not found for task ${task.id}`);
      return;
    }

    // Create notification content
    const notification: NotificationEvent = {
      userId: user.id,
      message: `Task "${task.description}" is due now!`
    };

    // Emit notification event
    eventBus.emit(EVENTS.NOTIFICATION_SEND, notification);
  }

  private async handleTaskCompleted(event: TaskEvent) {
    const { task } = event;
    
    const user = await this.prisma.user.findUnique({
      where: { id: task.userId }
    });

    if (!user) {
      console.error(`User not found for task ${task.id}`);
      return;
    }

    const notification: NotificationEvent = {
      userId: user.id,
      message: `Task "${task.description}" has been completed!`
    };

    eventBus.emit(EVENTS.NOTIFICATION_SEND, notification);
  }

  private async handleTaskError(event: TaskEvent & { error: string }) {
    const { task, error } = event;
    
    const user = await this.prisma.user.findUnique({
      where: { id: task.userId }
    });

    if (!user) {
      console.error(`User not found for task ${task.id}`);
      return;
    }

    const notification: NotificationEvent = {
      userId: user.id,
      message: `Error in task "${task.description}": ${error}`
    };

    eventBus.emit(EVENTS.NOTIFICATION_SEND, notification);
  }
} 