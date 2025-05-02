// Mock Ollama
const mockChat = jest.fn().mockResolvedValue({
  message: {
    role: 'assistant',
    content: 'Generated content for your task.'
  }
});

jest.mock('ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    chat: mockChat
  }))
}));

import { generateTaskContent } from '../../src/server/services/llmService';
import { LearningSource, Task, TaskType } from '../../src/server/types';

describe('LLM Service', () => {
  const mockLearningSources: LearningSource[] = [
    {
      name: 'Python Official Documentation',
      url: 'https://docs.python.org/3/',
      description: 'Official Python programming language documentation',
      content_types: ['tutorial', 'reference']
    },
    {
      name: 'Real Python',
      url: 'https://realpython.com/',
      description: 'Python tutorials and articles',
      content_types: ['tutorial', 'article']
    }
  ];

  beforeEach(() => {
    mockChat.mockClear();
  });

  describe('generateTaskContent', () => {
    it('should generate content for a reminder task', async () => {
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

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should generate content for a learning task', async () => {
      const task: Task = {
        id: '2',
        type: 'learning',
        description: 'Learn Python',
        parameters: {
          target: 'Python'
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

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle missing task parameters', async () => {
      const task: Task = {
        id: '3',
        type: 'reminder',
        description: 'Buy groceries',
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

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle error from LLM', async () => {
      const task: Task = {
        id: '4',
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

      // Override the mock to throw an error
      mockChat.mockRejectedValueOnce(new Error('LLM error'));

      await expect(generateTaskContent(task)).rejects.toThrow('Failed to generate task content');
    });
  });
}); 