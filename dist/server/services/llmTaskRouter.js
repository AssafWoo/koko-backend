"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMTaskRouter = void 0;
const ollama_1 = require("ollama");
const ollama = new ollama_1.Ollama();
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
    friendly: {
        model: 'llama3:8b',
        temperature: 0.8,
        num_ctx: 1024,
        num_thread: 2
    }
};
class LLMTaskRouter {
    constructor() {
        this.ollama = new ollama_1.Ollama();
    }
    static getInstance() {
        if (!LLMTaskRouter.instance) {
            LLMTaskRouter.instance = new LLMTaskRouter();
        }
        return LLMTaskRouter.instance;
    }
    async processTask(task, prompt) {
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
        }
        catch (error) {
            console.error(`Error processing task with ${task.type} LLM:`, error);
            throw error;
        }
    }
    getConfigForTask(taskType) {
        switch (taskType) {
            case 'reminder':
            case 'fetch':
                return LLM_CONFIGS.content;
            case 'summary':
                return LLM_CONFIGS.summary;
            case 'learning':
                return LLM_CONFIGS.content;
            default:
                return LLM_CONFIGS.content;
        }
    }
    getSystemPromptForTask(taskType) {
        switch (taskType) {
            case 'reminder':
                return 'You are a task reminder generator. Create clear, actionable reminders.';
            case 'summary':
                return 'You are a content summarizer. Create concise, informative summaries.';
            case 'fetch':
                return 'You are a data fetcher. Extract and organize relevant information.';
            case 'learning':
                return 'You are an educational content generator. Create engaging, informative content.';
            default:
                return 'You are a helpful assistant.';
        }
    }
}
exports.LLMTaskRouter = LLMTaskRouter;
