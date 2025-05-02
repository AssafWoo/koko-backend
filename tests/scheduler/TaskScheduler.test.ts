import { TaskScheduler } from '../../src/server/scheduler/TaskScheduler';
import { TaskRepository } from '../../src/server/repository/TaskRepository';
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

jest.mock('../../src/server/repository/TaskRepository');
jest.mock('../../src/server/events/EventBus');

describe('TaskScheduler', () => {
  let taskScheduler: TaskScheduler;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockEventBus: jest.Mocked<typeof eventBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockTaskRepository = new TaskRepository({} as any) as jest.Mocked<TaskRepository>;
    mockEventBus = eventBus as jest.Mocked<typeof eventBus>;
    taskScheduler = new TaskScheduler(mockTaskRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start the scheduler and check tasks immediately', async () => {
      const mockTasks: ExtendedTask[] = [
        {
          id: '1',
          description: 'Test task',
          type: 'reminder',
          userId: 'user1',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: TaskStatus.PENDING,
          scheduledTime: new Date(),
          priority: 0,
          metadata: JSON.stringify({
            schedule: {
              frequency: 'once',
              time: '12:00',
              date: new Date().toISOString().split('T')[0]
            }
          }),
          frequency: 'once',
          lastRunAt: null,
          lastResult: null
        }
      ];

      mockTaskRepository.findPendingTasks.mockResolvedValue(mockTasks as any);
      mockTaskRepository.updateTaskStatus.mockResolvedValue(mockTasks[0] as any);
      mockTaskRepository.createTask.mockImplementation((data) => Promise.resolve({
        ...data,
        id: 'next-task-id',
        description: data.description || 'Test Task',
        type: data.type || 'reminder',
        metadata: data.metadata || null,
        userId: data.userId || 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: data.scheduledTime || new Date(),
        frequency: data.frequency || null,
        lastRunAt: data.lastRunAt || null,
        lastResult: data.lastResult || null,
        priority: data.priority || 0
      }));

      await taskScheduler.start();

      expect(mockTaskRepository.findPendingTasks).toHaveBeenCalled();
      const expectedTask = {
        ...mockTasks[0],
        schedule: JSON.parse(mockTasks[0].metadata!).schedule
      };
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_DUE, { task: expectedTask });
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(mockTasks[0].id, TaskStatus.COMPLETED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_COMPLETED, { task: expectedTask });
    });

    it('should not start if already running', async () => {
      await taskScheduler.start();
      await taskScheduler.start();

      expect(mockTaskRepository.findPendingTasks).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', async () => {
      await taskScheduler.start();
      taskScheduler.stop();

      jest.advanceTimersByTime(60000);
      expect(mockTaskRepository.findPendingTasks).toHaveBeenCalledTimes(1);
    });

    it('should not stop if not running', () => {
      taskScheduler.stop();
      expect(mockTaskRepository.findPendingTasks).not.toHaveBeenCalled();
    });
  });

  describe('processTask', () => {
    it('should handle task processing successfully', async () => {
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
        metadata: JSON.stringify({
          schedule: {
            frequency: 'once',
            time: '12:00',
            date: new Date().toISOString().split('T')[0]
          }
        }),
        frequency: 'once',
        lastRunAt: null,
        lastResult: null
      };

      mockTaskRepository.updateTaskStatus.mockResolvedValue(task as any);

      await taskScheduler['processTask'](task as any);

      const expectedTask = {
        ...task,
        schedule: JSON.parse(task.metadata!).schedule
      };
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(task.id, TaskStatus.PROCESSING);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_DUE, { task: expectedTask });
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(task.id, TaskStatus.COMPLETED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_COMPLETED, { task: expectedTask });
    });

    it('should handle task processing errors', async () => {
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
        metadata: null,
        frequency: null,
        lastRunAt: null,
        lastResult: null
      };

      const error = new Error('Test error');
      mockTaskRepository.updateTaskStatus.mockRejectedValueOnce(error);

      await taskScheduler['processTask'](task as any);

      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(task.id, TaskStatus.ERROR);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_ERROR, {
        task,
        error: 'Test error'
      });
    });

    describe('Recurring Tasks', () => {
      const createMockTask = (frequency: string, interval?: number): ExtendedTask => {
        const schedule = {
          frequency,
          interval,
          time: '12:00',
          date: new Date().toISOString().split('T')[0]
        };
        
        return {
          id: 'test-task-id',
          description: 'Test Task',
          type: 'reminder',
          userId: 'test-user-id',
          status: TaskStatus.PENDING,
          scheduledTime: new Date(),
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          frequency,
          lastRunAt: null,
          lastResult: null,
          metadata: JSON.stringify({
            schedule,
            customField: 'test'
          })
        };
      };

      beforeEach(() => {
        mockTaskRepository.updateTaskStatus.mockImplementation((id, status) => 
          Promise.resolve({ id, status } as any)
        );
        mockTaskRepository.createTask.mockImplementation((data) => 
          Promise.resolve({
            ...data,
            id: 'next-task-id',
            description: data.description || 'Test Task',
            type: data.type || 'reminder',
            metadata: data.metadata || null,
            userId: data.userId || 'test-user-id',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: TaskStatus.PENDING,
            scheduledTime: data.scheduledTime || new Date(),
            frequency: data.frequency || null,
            lastRunAt: data.lastRunAt || null,
            lastResult: data.lastResult || null,
            priority: data.priority || 0
          })
        );
      });

      it('should create next occurrence for every_x_minutes task', async () => {
        const mockTask = createMockTask('every_x_minutes', 2);
        await taskScheduler['processTask'](mockTask as any);

        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            frequency: 'every_x_minutes',
            status: TaskStatus.PENDING,
            metadata: expect.stringContaining('"interval":2')
          })
        );
      });

      it('should create next occurrence for daily task', async () => {
        const mockTask = createMockTask('daily');
        await taskScheduler['processTask'](mockTask as any);

        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
          frequency: 'daily',
          status: TaskStatus.PENDING
        }));
      });

      it('should create next occurrence for weekly task', async () => {
        const mockTask = createMockTask('weekly');
        await taskScheduler['processTask'](mockTask as any);

        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
          frequency: 'weekly',
          status: TaskStatus.PENDING
        }));
      });

      it('should create next occurrence for monthly task', async () => {
        const mockTask = createMockTask('monthly');
        await taskScheduler['processTask'](mockTask as any);

        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
          frequency: 'monthly',
          status: TaskStatus.PENDING
        }));
      });

      it('should create next occurrence for hourly task', async () => {
        const mockTask = createMockTask('hourly');
        await taskScheduler['processTask'](mockTask as any);

        expect(mockTaskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
          frequency: 'hourly',
          status: TaskStatus.PENDING
        }));
      });

      it('should not create next occurrence for one-time task', async () => {
        const mockTask = createMockTask('once');
        await taskScheduler['processTask'](mockTask as any);
        expect(mockTaskRepository.createTask).not.toHaveBeenCalled();
      });

      it('should handle task with missing schedule metadata', async () => {
        const mockTask = {
          ...createMockTask('every_x_minutes', 2),
          metadata: null
        };
        await taskScheduler['processTask'](mockTask as any);
        expect(mockTaskRepository.createTask).not.toHaveBeenCalled();
      });

      it('should handle task with invalid frequency', async () => {
        const mockTask = createMockTask('invalid_frequency' as any);
        await taskScheduler['processTask'](mockTask as any);
        expect(mockTaskRepository.createTask).not.toHaveBeenCalled();
      });

      it('should preserve task metadata when creating next occurrence', async () => {
        const mockTask = createMockTask('every_x_minutes', 2);
        const customMetadata = {
          customField: 'test',
          schedule: {
            frequency: 'every_x_minutes',
            interval: 2,
            time: '12:00',
            date: new Date().toISOString().split('T')[0]
          }
        };
        mockTask.metadata = JSON.stringify(customMetadata);
        await taskScheduler['processTask'](mockTask as any);

        const createdTask = mockTaskRepository.createTask.mock.calls[0][0];
        expect(createdTask.metadata).not.toBeNull();
        const createdMetadata = JSON.parse(createdTask.metadata!);
        expect(createdMetadata.customField).toBe('test');
        expect(createdMetadata.schedule.interval).toBe(2);
      });
    });
  });
}); 