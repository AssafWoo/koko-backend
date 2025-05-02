import { ContentGenerationService } from '../../src/server/content/ContentGenerationService';
import { eventBus, EVENTS } from '../../src/server/events/EventBus';
import { Task } from '@prisma/client';

// Mock the event bus
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
    const createTestTask = (type: string, description: string): Task => ({
      id: '1',
      description,
      type,
      userId: 'user1',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      scheduledTime: new Date(),
      priority: 1,
      metadata: null,
      frequency: null,
      lastRunAt: null,
      lastResult: null
    });

    it('should generate content for reminder task', async () => {
      const task = createTestTask('reminder', 'Buy groceries');
      
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.CONTENT_GENERATED, {
        taskId: task.id,
        content: expect.stringContaining('Reminder: Buy groceries')
      });
    });

    it('should generate content for notification task', async () => {
      const task = createTestTask('notification', 'Meeting in 5 minutes');
      
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.CONTENT_GENERATED, {
        taskId: task.id,
        content: expect.stringContaining('Notification: Meeting in 5 minutes')
      });
    });

    it('should generate content for alert task', async () => {
      const task = createTestTask('alert', 'System maintenance required');
      
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.CONTENT_GENERATED, {
        taskId: task.id,
        content: expect.stringContaining('Alert: System maintenance required')
      });
    });

    it('should not generate content for non-content task types', async () => {
      const task = createTestTask('other', 'Some task');
      
      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should handle content generation errors', async () => {
      const task = createTestTask('reminder', 'Test task');
      
      // Mock generateContent to throw an error
      jest.spyOn(contentGenerationService as any, 'generateContent')
        .mockRejectedValueOnce(new Error('Content generation failed'));

      await contentGenerationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_ERROR, {
        task,
        error: 'Content generation failed: Content generation failed'
      });
    });
  });
}); 