import { Ollama } from 'ollama';
import type { 
  Task, 
  TaskType,
  LearningSource, 
  LearningParameters,
  ReminderParameters,
  SummaryParameters,
  FetchParameters 
} from '@server/types';

const ollama = new Ollama();

export const generateTaskContent = async (task: Task): Promise<string> => {
  try {
    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `Generate high-quality content for task:
Type: ${task.type}
Description: ${task.description}
Parameters: ${JSON.stringify(task.parameters)}

Guidelines:
1. Relevance: Match task purpose
2. Quality: Clear language, examples, consistent tone
3. Structure: Logical flow, proper formatting
4. Engagement: Interesting, active voice, actionable

Generate content following these guidelines.`
        },
        {
          role: 'user',
          content: `Please generate content for this task: ${task.description}`
        }
      ]
    });

    return response.message.content || 'No content generated';
  } catch (error) {
    console.error('Error generating task content:', error);
    throw new Error('Failed to generate task content');
  }
};

export const generateTaskSummary = async (task: Task): Promise<string> => {
  try {
    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `Create concise summary for task:
Type: ${task.type}
Description: ${task.description}
Parameters: ${JSON.stringify(task.parameters)}

Guidelines:
1. Key Points: Main ideas, critical info
2. Clarity: Simple language, explain complex
3. Structure: Logical flow, transitions
4. Length: Concise, essential info only

Create summary following these guidelines.`
        },
        {
          role: 'user',
          content: `Please summarize this task: ${task.description}`
        }
      ]
    });

    return response.message.content || 'No summary generated';
  } catch (error) {
    console.error('Error generating task summary:', error);
    throw new Error('Failed to generate task summary');
  }
};

export async function generateFriendlyMessage(task: Task, result: string): Promise<string> {
  try {
    let taskTarget = '';
    switch (task.type) {
      case 'reminder':
        taskTarget = (task.parameters as ReminderParameters)?.target || task.description;
        break;
      case 'summary':
        taskTarget = (task.parameters as SummaryParameters)?.target || task.description;
        break;
      case 'fetch':
        taskTarget = (task.parameters as FetchParameters)?.target || task.description;
        break;
      case 'learning':
        taskTarget = (task.parameters as LearningParameters)?.topic || task.description;
        break;
      default:
        taskTarget = task.description;
    }

    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `Generate friendly notification:
Type: ${task.type}
Target: ${taskTarget}
Result: ${result}

Guidelines:
1. Length: 6-10 words
2. Tone: Friendly, positive, clear
3. Content: Key info, active voice
4. Style: Simple, memorable

Generate short, friendly message.`
        },
        {
          role: 'user',
          content: `Generate a very short friendly message for a ${task.type} task about ${taskTarget} with result: ${result}`
        }
      ]
    });
    return response.message.content;
  } catch (error) {
    console.error('Error generating friendly message:', error);
    return result;
  }
}

export async function summarizeLearningContent(
  topic: string,
  sources: LearningSource[],
  format: 'summary' | 'facts' | 'article_link' = 'summary'
): Promise<string> {
  try {
    // Create a prompt that combines information from sources with LLM knowledge
    const sourceInfo = sources.map(source => 
      `Source: ${source.name}\nDescription: ${source.description}\nContent Types: ${source.content_types.join(', ')}\nURL: ${source.url}`
    ).join('\n\n');

    if (format === 'article_link') {
      // For article_link format, just return the first relevant source URL with a description
      const relevantSource = sources[0];
      if (!relevantSource) {
        return "No relevant articles found.";
      }
      return `Today's Resource: ${relevantSource.name}\nDescription: ${relevantSource.description}\nDirect Link: ${relevantSource.url}`;
    }

    const prompt = format === 'summary' 
      ? `Create a comprehensive summary about ${topic} that combines information from these sources with your knowledge. 
         Focus on the most interesting and educational aspects. Include key points and interesting facts.
         Format the response in a clear, engaging way with bullet points and emojis where appropriate.
         
         Sources:
         ${sourceInfo}
         
         Summary:`
      : `Generate interesting facts about ${topic} that combine information from these sources with your knowledge.
         Make the facts engaging and educational. Include surprising or little-known information.
         Format each fact with an emoji and keep them concise but informative.
         
         Sources:
         ${sourceInfo}
         
         Facts:`;

    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator who creates engaging, accurate, and informative content about various topics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return response.message.content;
  } catch (error) {
    console.error('Error summarizing learning content:', error);
    return "Unable to generate summary at this time.";
  }
}