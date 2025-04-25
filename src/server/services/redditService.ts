import fetch from 'node-fetch';
import { Ollama } from 'ollama';

const ollama = new Ollama();

export async function summarizeReddit(subreddit: string): Promise<string> {
  try {
    // Fetch top posts from Reddit
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/top/.json?limit=3&t=day`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from Reddit: ${response.statusText}`);
    }

    const data = await response.json();
    const posts = data.data.children.map((post: any) => post.data.title);

    // Create a prompt for summarization
    const summaryPrompt = `Summarize these Reddit post titles from r/${subreddit} into one coherent paragraph:
${posts.join('\n')}

Summary:`;

    // Get summary from Ollama
    const ollamaResponse = await ollama.chat({
      model: 'llama2',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes Reddit posts into concise, coherent paragraphs.'
        },
        {
          role: 'user',
          content: summaryPrompt
        }
      ]
    });

    return ollamaResponse.message.content;
  } catch (error) {
    console.error('Error in summarizeReddit:', error);
    throw error;
  }
} 