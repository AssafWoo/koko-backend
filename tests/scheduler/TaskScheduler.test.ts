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
          type: 'test',
          userId: 'user1',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: TaskStatus.PENDING,
          scheduledTime: new Date(),
          priority: 0,
          metadata: null
        }
      ];

      mockTaskRepository.findPendingTasks.mockResolvedValue(mockTasks as any);

      await taskScheduler.start();

      expect(mockTaskRepository.findPendingTasks).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_DUE, { task: mockTasks[0] });
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_COMPLETED, { task: mockTasks[0] });
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
        type: 'test',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: TaskStatus.PENDING,
        scheduledTime: new Date(),
        priority: 0,
        metadata: null
      };

      await taskScheduler['processTask'](task as any);

      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(task.id, TaskStatus.PROCESSING);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_DUE, { task });
      expect(mockTaskRepository.updateTaskStatus).toHaveBeenCalledWith(task.id, TaskStatus.COMPLETED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_COMPLETED, { task });
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
        metadata: null
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
  });
}); 