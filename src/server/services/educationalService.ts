import { Ollama } from 'ollama';
import type { LearningSource } from '../types';
import { LearningParameters } from '../types/index';

const ollama = new Ollama();

export async function generateEducationalContent(
  topic: string,
  format: 'summary' | 'facts' | 'article_link',
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  sources: LearningSource[]
): Promise<string> {
  try {
    // Create a teacher-like prompt
    const teacherPrompt = `You are a friendly and engaging teacher explaining ${topic} to a ${difficulty} student.
    Your goal is to make the content interesting, easy to understand, and memorable.
    Use analogies, examples, and a conversational tone.
    Format the content as a lesson with:
    1. A brief introduction
    2. Key points or facts
    3. A real-world example or analogy
    4. A fun fact or interesting tidbit
    5. A thought-provoking question to encourage further learning

    Make it feel like a personal conversation with the student.`;

    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: teacherPrompt
        },
        {
          role: 'user',
          content: `Please teach me about ${topic} in a ${difficulty} level.`
        }
      ]
    });

    let content = response.message.content;

    // Add source links if available
    if (sources.length > 0) {
      content += '\n\n📚 Want to learn more? Check out these resources:\n';
      sources.forEach(source => {
        content += `- ${source.name}: ${source.url}\n`;
      });
    }

    return content;
  } catch (error) {
    console.error('Error generating educational content:', error);
    throw error;
  }
}

export async function generateInteractiveQuestion(
  topic: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): Promise<string> {
  try {
    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `You are a teacher creating an interactive question about ${topic} for a ${difficulty} student.
          The question should be thought-provoking but not too difficult.
          Include a hint if the student gets stuck.`
        },
        {
          role: 'user',
          content: `Generate an interactive question about ${topic} for a ${difficulty} student.`
        }
      ]
    });

    return response.message.content;
  } catch (error) {
    console.error('Error generating interactive question:', error);
    throw error;
  }
}

export const generateQuiz = async (topic: string, difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): Promise<string> => {
  try {
    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `You are a helpful teacher creating a quiz about ${topic} for a ${difficulty} student.
          Create a quiz with 5 multiple-choice questions.
          Each question should have 4 options (A, B, C, D).
          Include the correct answer at the end.
          Make the questions engaging and educational.`
        },
        {
          role: 'user',
          content: `Please create a ${difficulty} level quiz about ${topic}.`
        }
      ]
    });

    return response.message.content || 'No quiz generated';
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new Error('Failed to generate quiz');
  }
};

export const generateExplanation = async (topic: string, concept: string, difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): Promise<string> => {
  try {
    const response = await ollama.chat({
      model: 'llama3:8b',
      messages: [
        {
          role: 'system',
          content: `You are a helpful teacher explaining ${concept} in the context of ${topic} to a ${difficulty} student.
          Your explanation should be clear, engaging, and include examples.
          Use analogies and real-world applications where appropriate.
          Break down complex ideas into simpler parts.`
        },
        {
          role: 'user',
          content: `Please explain ${concept} in the context of ${topic} at a ${difficulty} level.`
        }
      ]
    });

    return response.message.content || 'No explanation generated';
  } catch (error) {
    console.error('Error generating explanation:', error);
    throw new Error('Failed to generate explanation');
  }
}; 