import { Ollama } from 'ollama';
import { Task, TaskType } from '@server/types';

const ollama = new Ollama();

// LLM Model configurations for different tasks
const LLM_CONFIGS = {
  intent: {
    model: 'mistral:instruct',
    temperature: 0.1,
    num_ctx: 4096,
    num_thread: 8
  },
  content: {
    model: 'llama3:8b',
    temperature: 0.7,
    num_ctx: 2048,
    num_thread: 4
  },
  summary: {
    model: 'llama3:8b',
    temperature: 0.5,
    num_ctx: 2048,
    num_thread: 4
  },
  learning: {
    model: 'llama3:8b',
    temperature: 0.8,
    num_ctx: 4096,
    num_thread: 4
  },
  friendly: {
    model: 'llama3:8b',
    temperature: 0.8,
    num_ctx: 1024,
    num_thread: 2
  }
};

export class LLMTaskRouter {
  private static instance: LLMTaskRouter;
  private ollama: Ollama;

  private constructor() {
    this.ollama = new Ollama();
  }

  public static getInstance(): LLMTaskRouter {
    if (!LLMTaskRouter.instance) {
      LLMTaskRouter.instance = new LLMTaskRouter();
    }
    return LLMTaskRouter.instance;
  }

  async processTask(task: Task, prompt: string): Promise<string> {
    const config = this.getConfigForTask(task.type);
    
    try {
      const response = await this.ollama.chat({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPromptForTask(task.type)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature: config.temperature,
          num_ctx: config.num_ctx,
          num_thread: config.num_thread
        }
      });

      return response.message.content;
    } catch (error) {
      console.error(`Error processing task with ${task.type} LLM:`, error);
      throw error;
    }
  }

  private getConfigForTask(taskType: TaskType) {
    switch (taskType) {
      case 'reminder':
      case 'fetch':
        return LLM_CONFIGS.content;
      case 'summary':
        return LLM_CONFIGS.summary;
      case 'learning':
        return LLM_CONFIGS.learning;
      default:
        return LLM_CONFIGS.content;
    }
  }

  private getSystemPromptForTask(taskType: TaskType): string {
    switch (taskType) {
      case 'reminder':
        return 'You are a task reminder generator. Create clear, actionable reminders.';
      case 'summary':
        return 'You are a content summarizer. Create concise, informative summaries.';
      case 'fetch':
        return 'You are a data fetcher. Extract and organize relevant information.';
      case 'learning':
        return `You are an expert educator creating engaging, informative content.
Your goal is to make the content interesting, easy to understand, and memorable.
Format the content as a lesson with:
1. A brief introduction
2. Key points or facts
3. A real-world example or analogy
4. A fun fact or interesting tidbit
5. A thought-provoking question to encourage further learning

Make it feel like a personal conversation with the student.`;
      default:
        return 'You are a helpful assistant.';
    }
  }
} 