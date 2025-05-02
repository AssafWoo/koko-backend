import { TaskScheduler } from '../../src/server/scheduler/TaskScheduler';
import { TaskRepository } from '../../src/server/repository/TaskRepository';
import { Task, Schedule } from '../../src/server/types';
import { TaskStatus } from '@prisma/client';

jest.mock('../../src/server/repository/TaskRepository');
jest.mock('../../src/server/services/notificationService', () => ({
  createNotificationContent: jest.fn(),
  sendNotification: jest.fn()
}));

describe('Schedule Patterns', () => {
  let taskScheduler: TaskScheduler;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockTaskRepository = new TaskRepository({} as any) as jest.Mocked<TaskRepository>;
    taskScheduler = new TaskScheduler(mockTaskRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateNextScheduledTime', () => {
    const baseTask: Task = {
      id: '1',
      description: 'Test task',
      type: 'reminder',
      metadata: null,
      userId: 'user1',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      scheduledTime: new Date(),
      frequency: null,
      lastRunAt: null,
      lastResult: null,
      priority: 0
    };

    it('should calculate next time for daily tasks', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'daily',
          time: '09:00',
          day: null,
          date: null
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getDate()).toBe(new Date().getDate() + 1);
    });

    it('should calculate next time for weekly tasks', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'weekly',
          time: '09:00',
          day: '1', // Monday
          date: null
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getDate()).toBe(new Date().getDate() + 7);
    });

    it('should calculate next time for monthly tasks', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'monthly',
          time: '09:00',
          day: null,
          date: '15'
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getMonth()).toBe((new Date().getMonth() + 1) % 12);
    });

    it('should calculate next time for hourly tasks', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'hourly',
          time: '09:00',
          day: null,
          date: null
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getHours()).toBe((new Date().getHours() + 1) % 24);
    });

    it('should calculate next time for tasks with multiple times per day', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'multiple_times',
          time: '09:00',
          day: null,
          date: null,
          timesPerDay: 2
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getHours()).toBe((new Date().getHours() + 12) % 24); // 24/2 = 12 hours between executions
    });

    it('should calculate next time for tasks with multiple times per week', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'multiple_times',
          time: '09:00',
          day: null,
          date: null,
          timesPerWeek: 3
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getDate()).toBe(new Date().getDate() + Math.floor(7/3)); // 7/3 ≈ 2.33 days between executions
    });

    it('should calculate next time for tasks with multiple times per month', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'multiple_times',
          time: '09:00',
          day: null,
          date: null,
          timesPerMonth: 4
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getDate()).toBe(new Date().getDate() + Math.floor(30/4)); // 30/4 = 7.5 days between executions
    });

    it('should calculate next time for tasks with multiple times per hour', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'multiple_times',
          time: '09:00',
          day: null,
          date: null,
          timesPerHour: 2
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getMinutes()).toBe((new Date().getMinutes() + 30) % 60); // 60/2 = 30 minutes between executions
    });

    it('should handle "tomorrow" scheduling', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'once',
          time: '09:00',
          day: null,
          date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getDate()).toBe(new Date().getDate() + 1);
    });

    it('should handle relative time scheduling (in X minutes)', () => {
      const task: Task = {
        ...baseTask,
        schedule: {
          frequency: 'once',
          time: new Date(new Date().getTime() + 30 * 60000).toISOString().split('T')[1].slice(0, 5),
          day: null,
          date: new Date().toISOString().split('T')[0]
        }
      };

      const nextTime = taskScheduler['calculateNextScheduledTime'](task);
      expect(nextTime).toBeDefined();
      expect(nextTime?.getMinutes()).toBe((new Date().getMinutes() + 30) % 60);
    });
  });
}); 