import { eventBus, EVENTS, TaskEvent, ContentEvent } from '../events/EventBus';
import { PrismaClient } from '@prisma/client';

export class ContentGenerationService {
  constructor(private prisma: PrismaClient) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for task due events that require content generation
    eventBus.on(EVENTS.TASK_DUE, this.handleTaskDue.bind(this));
  }

  private async handleTaskDue(event: TaskEvent) {
    const { task } = event;

    // Check if this task type requires content generation
    if (!this.requiresContentGeneration(task.type)) {
      return;
    }

    try {
      // Generate content based on task type
      const content = await this.generateContent(task);

      // Emit content generated event
      const contentEvent: ContentEvent = {
        taskId: task.id,
        content
      };

      eventBus.emit(EVENTS.CONTENT_GENERATED, contentEvent);
    } catch (error: any) {
      // Emit error event if content generation fails
      eventBus.emit(EVENTS.TASK_ERROR, {
        task,
        error: `Content generation failed: ${error?.message || 'Unknown error'}`
      });
    }
  }

  private requiresContentGeneration(taskType: string): boolean {
    // Add logic to determine if a task type requires content generation
    const typesRequiringContent = ['reminder', 'notification', 'alert'];
    return typesRequiringContent.includes(taskType);
  }

  private async generateContent(task: any): Promise<string> {
    // Add your content generation logic here
    // This is a placeholder implementation
    switch (task.type) {
      case 'reminder':
        return `Reminder: ${task.description}`;
      case 'notification':
        return `Notification: ${task.description}`;
      case 'alert':
        return `Alert: ${task.description}`;
      default:
        return task.description;
    }
  }
} 