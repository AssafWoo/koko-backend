import { LLMTaskRouter } from '../../src/server/services/llmTaskRouter';
import { Task, TaskType } from '../../src/server/types';

describe('LLMTaskRouter', () => {
  let router: LLMTaskRouter;

  beforeEach(() => {
    router = LLMTaskRouter.getInstance();
  });

  const testCases: { type: TaskType; prompt: string; description: string }[] = [
    {
      type: 'reminder',
      prompt: 'Remind me to buy groceries tomorrow at 5 PM',
      description: 'should generate a reminder task'
    },
    {
      type: 'summary',
      prompt: 'Summarize the key points about climate change',
      description: 'should generate a summary'
    },
    {
      type: 'fetch',
      prompt: 'Get me the latest news about AI developments',
      description: 'should fetch information'
    },
    {
      type: 'learning',
      prompt: 'Teach me about photosynthesis',
      description: 'should create educational content'
    }
  ];

  testCases.forEach(({ type, prompt, description }) => {
    it(`${description}`, async () => {
      const task: Task = {
        id: '1',
        description: 'Test task',
        type,
        metadata: null,
        userId: 'test-user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'PENDING',
        scheduledTime: new Date(),
        frequency: null,
        lastRunAt: null,
        lastResult: null,
        priority: 1
      };

      const result = await router.processTask(task, prompt);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000); // Increased timeout for LLM responses
  });

  it('should handle invalid task gracefully', async () => {
    const task: Task = {
      id: '1',
      description: 'Test error task',
      type: 'reminder',
      metadata: null,
      userId: 'test-user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'ERROR', // Set status to ERROR to test error handling
      scheduledTime: new Date(),
      frequency: null,
      lastRunAt: null,
      lastResult: null,
      priority: 1
    };

    const result = await router.processTask(task, 'test prompt');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result).toContain('error'); // The response should mention error handling
  });
}); 