import { NotificationService } from '../../src/server/notifications/NotificationService';
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
}

jest.mock('../../src/server/events/EventBus');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockEventBus: jest.Mocked<typeof eventBus>;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventBus = eventBus as jest.Mocked<typeof eventBus>;
    mockPrisma = {
      user: {
        findUnique: jest.fn()
      }
    };
    notificationService = new NotificationService(mockPrisma);
  });

  describe('handleTaskDue', () => {
    it('should send notification when task is due', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'test',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null
      };

      const user = {
        id: 'user1',
        username: 'testuser'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Simulate task due event
      await notificationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.NOTIFICATION_SEND, {
        userId: user.id,
        message: `Task "${task.description}" is due now!`
      });
    });

    it('should handle missing user', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'test',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Simulate task due event
      await notificationService['handleTaskDue']({ task });

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskCompleted', () => {
    it('should send notification when task is completed', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'test',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.COMPLETED,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null
      };

      const user = {
        id: 'user1',
        username: 'testuser'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Simulate task completed event
      await notificationService['handleTaskCompleted']({ task });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.NOTIFICATION_SEND, {
        userId: user.id,
        message: `Task "${task.description}" has been completed!`
      });
    });
  });

  describe('handleTaskError', () => {
    it('should send notification when task has error', async () => {
      const task: ExtendedTask = {
        id: '1',
        description: 'Test task',
        type: 'test',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.ERROR,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null
      };

      const user = {
        id: 'user1',
        username: 'testuser'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const error = 'Test error';

      // Simulate task error event
      await notificationService['handleTaskError']({ task, error });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.NOTIFICATION_SEND, {
        userId: user.id,
        message: `Error in task "${task.description}": ${error}`
      });
    });
  });
}); 