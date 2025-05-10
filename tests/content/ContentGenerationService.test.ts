import { ContentGenerationService } from '../../src/server/content/ContentGenerationService';
import { eventBus, EVENTS } from '../../src/server/events/EventBus';
import { Task } from '@prisma/client';

// Define TaskStatus enum locally since it's not exported from @prisma/client
enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// Extend the Task type to include our custom properties
interface ExtendedTask extends Task {
  status: TaskStatus;
  scheduledTime: Date;
  priority: number;
  frequency: string | null;
  lastRunAt: Date | null;
  lastResult: string | null;
}

jest.mock('../../src/server/events/EventBus');

describe('ContentGenerationService', () => {
  let contentGenerationService: ContentGenerationService;
  let mockEventBus: jest.Mocked<typeof eventBus>;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventBus = eventBus as jest.Mocked<typeof eventBus>;
    mockPrisma = {};
    contentGenerationService = new ContentGenerationService(mockPrisma);
  });

  describe('handleTaskDue', () => {
    it('should generate content for reminder task', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test reminder',
        type: 'reminder',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null,
        frequency: null,
        lastRunAt: null,
        lastResult: null
      };

      // Simulate task due event
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.CONTENT_GENERATED, {
        taskId: task.id,
        content: `Reminder: ${task.description}`
      });
    });

    it('should generate content for notification task', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test notification',
        type: 'notification',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null,
        frequency: null,
        lastRunAt: null,
        lastResult: null
      };

      // Simulate task due event
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.CONTENT_GENERATED, {
        taskId: task.id,
        content: `Notification: ${task.description}`
      });
    });

    it('should not generate content for non-content task types', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'other',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null,
        frequency: null,
        lastRunAt: null,
        lastResult: null
      };

      // Simulate task due event
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should handle content generation errors', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'reminder',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null,
        frequency: null,
        lastRunAt: null,
        lastResult: null
      };

      // Mock generateContent to throw an error
      jest.spyOn(contentGenerationService as any, 'generateContent')
        .mockRejectedValueOnce(new Error('Content generation failed'));

      // Simulate task due event
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_ERROR, {
        task,
        error: 'Content generation failed: Content generation failed'
      });
    });
  });
}); 