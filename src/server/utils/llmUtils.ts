import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface TaskIntent {
  type: 'reminder' | 'query' | 'action' | 'generic';
  description: string;
  metadata?: {
    time?: string;
    target?: string;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
}

export const analyzeTaskIntent = async (prompt: string): Promise<TaskIntent> => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a task analysis assistant. Analyze the user's prompt and determine:
          1. The type of task (reminder, query, action, or generic)
          2. The main description of the task
          3. Any relevant metadata (time, target, frequency)
          
          Respond in JSON format with the following structure:
          {
            "type": "reminder|query|action|generic",
            "description": "task description",
            "metadata": {
              "time": "optional time",
              "target": "optional target",
              "frequency": "optional frequency"
            }
          }`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from LLM');
    }

    const intent = JSON.parse(response) as TaskIntent;
    return intent;
  } catch (error) {
    console.error('Error analyzing task intent:', error);
    // Fallback to generic task if LLM analysis fails
    return {
      type: 'generic',
      description: prompt
    };
  }
}; 