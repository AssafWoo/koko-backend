import { createNotificationContent, sendNotification } from '../../src/server/services/notificationService';
import { notificationManager } from '../../src/server/services/notificationManager';
import { Task } from '../../src/server/types';

// Mock the notification manager
jest.mock('../../src/server/services/notificationManager', () => ({
  notificationManager: {
    sendNotification: jest.fn(),
    getClientCount: jest.fn().mockReturnValue(1)
  }
}));

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotificationContent', () => {
    it('should create notification content for a reminder task', () => {
      const task: Task = {
        id: '1',
        type: 'reminder',
        description: 'Buy groceries',
        parameters: {
          target: 'groceries'
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: null,
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      const content = createNotificationContent(task, 'Time to buy groceries!', 'info');

      expect(content).toMatchObject({
        title: expect.stringContaining('Buy groceries'),
        message: expect.stringContaining('Time to buy groceries!'),
        type: 'info',
        metadata: {
          taskId: task.id,
          taskType: task.type,
          taskDescription: task.description
        }
      });
    });

    it('should create notification content for a learning task', () => {
      const task: Task = {
        id: '2',
        type: 'learning',
        description: 'Learn Python',
        parameters: {
          target: 'Python',
          topic: 'Python Basics',
          format: 'article',
          difficulty: 'beginner'
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: null,
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      const content = createNotificationContent(task, 'New Python lesson available!', 'info');

      expect(content).toMatchObject({
        title: expect.stringContaining('Learn Python'),
        message: expect.stringContaining('New Python lesson available!'),
        type: 'info',
        metadata: {
          taskId: task.id,
          taskType: task.type,
          taskDescription: task.description
        }
      });
    });

    it('should create notification content for a summary task', () => {
      const task: Task = {
        id: '3',
        type: 'summary',
        description: 'Summarize meeting notes',
        parameters: {
          target: 'meeting notes',
          format: 'bullet points'
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: null,
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      const content = createNotificationContent(task, 'Meeting summary ready!', 'success');

      expect(content).toMatchObject({
        title: expect.stringContaining('Summarize meeting notes'),
        message: expect.stringContaining('Meeting summary ready!'),
        type: 'success',
        metadata: {
          taskId: task.id,
          taskType: task.type,
          taskDescription: task.description
        }
      });
    });
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const content = {
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const,
        metadata: {
          taskId: '1',
          taskType: 'test',
          timestamp: new Date().toISOString()
        }
      };

      await sendNotification('test', content);

      expect(notificationManager.sendNotification).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify({
          type: 'test',
          content
        }))
      );
    });

    it('should handle notification sending errors gracefully', async () => {
      const content = {
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const,
        metadata: {
          taskId: '1',
          taskType: 'test',
          timestamp: new Date().toISOString()
        }
      };

      // Mock notificationManager to throw an error
      (notificationManager.sendNotification as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to send notification');
      });

      // Should not throw error
      await expect(sendNotification('test', content)).resolves.not.toThrow();
    });
  });
}); 