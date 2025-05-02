import { EventEmitter } from 'events';
import { Task } from '@prisma/client';

// Define event types for better type safety
export type TaskEvent = {
  task: Task;
};

export type ContentEvent = {
  taskId: string;
  content: string;
};

export type NotificationEvent = {
  userId: string;
  message: string;
};

// Create a singleton instance
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}

// Export a singleton instance
export const eventBus = EventBus.getInstance();

// Export event names as constants to avoid typos
export const EVENTS = {
  TASK_DUE: 'task.due',
  TASK_COMPLETED: 'task.completed',
  CONTENT_GENERATED: 'content.generated',
  NOTIFICATION_SEND: 'notification.send',
  TASK_ERROR: 'task.error'
} as const; 