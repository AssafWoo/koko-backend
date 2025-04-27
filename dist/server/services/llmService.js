"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFriendlyMessage = generateFriendlyMessage;
exports.summarizeLearningContent = summarizeLearningContent;
const ollama_1 = require("ollama");
const ollama = new ollama_1.Ollama();
async function generateFriendlyMessage(task, result) {
    try {
        let taskTarget = '';
        switch (task.type) {
            case 'reminder':
                taskTarget = task.parameters?.target || task.action;
                break;
            case 'summary':
                taskTarget = task.parameters?.target || task.action;
                break;
            case 'fetch':
                taskTarget = task.parameters?.target || task.action;
                break;
            case 'learning':
                taskTarget = task.parameters?.topic || task.action;
                break;
            default:
                taskTarget = task.action;
        }
        const response = await ollama.chat({
            model: 'llama2',
            messages: [
                {
                    role: 'system',
                    content: 'You are a friendly assistant that generates very short, concise messages (6-10 words max). Keep it simple and direct.'
                },
                {
                    role: 'user',
                    content: `Generate a very short friendly message for a ${task.type} task about ${taskTarget} with result: ${result}`
                }
            ]
        });
        return response.message.content;
    }
    catch (error) {
        console.error('Error generating friendly message:', error);
        return result;
    }
}
async function summarizeLearningContent(topic, sources, format = 'summary') {
    try {
        // Create a prompt that combines information from sources with LLM knowledge
        const sourceInfo = sources.map(source => `Source: ${source.name}\nDescription: ${source.description}\nContent Types: ${source.content_types.join(', ')}\nURL: ${source.url}`).join('\n\n');
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
            model: 'llama2',
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
    }
    catch (error) {
        console.error('Error summarizing learning content:', error);
        return "Unable to generate summary at this time.";
    }
}
