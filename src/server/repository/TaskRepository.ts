import { PrismaClient, Prisma, Task, TaskStatus } from '@prisma/client';
import { Task as TaskType, Schedule } from '@server/types';

export class TaskRepository {
  constructor(private prisma: PrismaClient) {}

  async findPendingTasks(): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
        scheduledTime: {
          lte: new Date()
        }
      },
      orderBy: {
        scheduledTime: 'asc'
      }
    });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status }
    });
  }

  async saveTaskResult(taskId: string, result: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const metadata = task.metadata ? JSON.parse(task.metadata) : {};
    const updatedMetadata = {
      ...metadata,
      previewResult: result,
      lastExecution: new Date().toISOString()
    };

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        lastResult: result,
        lastRunAt: new Date(),
        metadata: JSON.stringify(updatedMetadata)
      }
    });
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    return this.prisma.task.findUnique({
      where: { id: taskId }
    });
  }

  async createTask(taskData: Omit<TaskType, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const { schedule, user, userId, ...rest } = taskData;
    return this.prisma.task.create({
      data: {
        ...rest,
        metadata: taskData.metadata,
        user: {
          connect: {
            id: userId
          }
        }
      }
    });
  }

  async deleteTask(taskId: string): Promise<Task> {
    return this.prisma.task.delete({
      where: { id: taskId }
    });
  }
} 