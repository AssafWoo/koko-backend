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

    it('should generate content for a coffee making learning task', async () => {
      const task: Task = {
        id: '5',
        type: 'learning',
        description: 'Teach me about Coffee making everyday at 9:00',
        parameters: {
          target: 'Coffee making',
          topic: 'Coffee making',
          format: 'article',
          difficulty: 'beginner',
          sources: mockLearningSources
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: 'daily',
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      // Mock a specific response for coffee making content
      mockChat.mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '**Introduction to Coffee Making**\n\nCoffee making is both an art and a science. Let\'s explore the basics of brewing the perfect cup.\n\n**Key Points:**\n1. Choose the right beans\n2. Grind size matters\n3. Water temperature is crucial\n4. Brew time affects flavor\n\n**Real-world Example:**\nA French press requires coarse grounds and 4-minute steep time.\n\n**Fun Fact:** The first coffee house opened in Constantinople in 1475.\n\n**Thought Question:** How does the grind size affect the extraction process?'
        }
      });

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('Coffee making');
      expect(content).toContain('Introduction');
      expect(content).toContain('Key Points');
    });

    it('should generate content for an hourly recurring reminder task', async () => {
      const task: Task = {
        id: '6',
        type: 'reminder',
        description: 'Remind me to check server status every 2 hours',
        parameters: {
          target: 'server status',
          interval: '2h'
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: '2h',
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      // Mock a specific response for server status reminder
      mockChat.mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '**Server Status Check Reminder**\n\nTime to check your server status!\n\n**What to Check:**\n1. Server uptime\n2. Resource usage (CPU, Memory)\n3. Error logs\n4. Active connections\n\n**Action Items:**\n- Review monitoring dashboard\n- Check for any alerts\n- Verify backup status\n\n**Priority:** High - Regular checks help prevent issues'
        }
      });

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('Server Status');
      expect(content).toContain('What to Check');
      expect(content).toContain('Action Items');
    });

    it('should generate content for a minute-based recurring reminder task', async () => {
      const task: Task = {
        id: '7',
        type: 'reminder',
        description: 'Remind me to take a break every 30 minutes',
        parameters: {
          target: 'take a break',
          interval: '30m'
        },
        metadata: null,
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: '30m',
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      // Mock a specific response for break reminder
      mockChat.mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '**Break Time Reminder**\n\nTime to take a short break!\n\n**Why Take a Break:**\n1. Reduce eye strain\n2. Improve focus\n3. Prevent burnout\n4. Boost productivity\n\n**Quick Break Activities:**\n- Stretch your body\n- Look away from the screen\n- Take a short walk\n- Hydrate yourself\n\n**Duration:** 5-10 minutes'
        }
      });

      const content = await generateTaskContent(task);
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('Break Time');
      expect(content).toContain('Why Take a Break');
      expect(content).toContain('Quick Break Activities');
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