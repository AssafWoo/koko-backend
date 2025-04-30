import { Ollama } from 'ollama';
import { intentPrompt } from '../prompts/intentPrompt';
import { Task, ReminderParameters, SummaryParameters, FetchParameters, LearningParameters } from '../types';

const ollama = new Ollama();

export interface TaskIntent {
  taskDefinition: {
    type: Task['type'];
    source: string | null;
    schedule: {
      frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly' | 'every_x_minutes';
      interval?: number;
      time: string;
      day?: string;
      date?: string;
    };
    action: string;
    parameters: ReminderParameters | SummaryParameters | FetchParameters | LearningParameters;
    description: string;
    deliveryMethod: Task['deliveryMethod'];
  };
}

export const extractTaskIntent = async (prompt: string, currentTime: string): Promise<TaskIntent> => {
  const response = await ollama.chat({
    model: 'mistral:instruct',
    messages: [
      {
        role: 'system',
        content: intentPrompt
          .replace('{USER_PROMPT}', prompt)
          .replace('{CURRENT_TIME}', currentTime)
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    format: 'json',
    options: {
      temperature: 0.1,
      num_ctx: 2048,
      num_thread: 4
    }
  });

  return cleanAndParseLLMResponse(response.message.content);
};

export const cleanAndParseLLMResponse = (responseContent: string): TaskIntent => {
  // Clean up the response to ensure valid JSON
  const cleanedResponse = responseContent.trim();
  
  // Try to fix common JSON issues
  let fixedResponse = cleanedResponse;
  
  // Add missing closing braces if needed
  if (!cleanedResponse.endsWith('}')) {
    const openBraces = (cleanedResponse.match(/{/g) || []).length;
    const closeBraces = (cleanedResponse.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      fixedResponse = cleanedResponse + '}'.repeat(openBraces - closeBraces);
    }
  }
  
  // Add missing commas if needed
  fixedResponse = fixedResponse.replace(/"\s*}\s*"/g, '", "');
  
  try {
    return JSON.parse(fixedResponse);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse LLM response: ${errorMessage}\nRaw response: ${responseContent}`);
  }
}; 