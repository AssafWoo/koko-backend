"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = exports.generateLearning = exports.generateFacts = void 0;
const ollama_1 = require("ollama");
const ollama = new ollama_1.Ollama();
const generateFacts = async (topic, count = 2, format = 'bullet') => {
    try {
        const response = await ollama.chat({
            model: 'llama3:8b',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant providing ${count} interesting facts about ${topic}. Focus on lesser-known, fascinating facts. Keep the response concise and limit to 4 paragraphs maximum.`
                },
                {
                    role: 'user',
                    content: `Please provide ${count} interesting facts about ${topic}. ${format === 'bullet'
                        ? 'Format each fact as a bullet point starting with •'
                        : 'Format as a cohesive paragraph'}. Keep it concise and limit to 4 paragraphs maximum.`
                }
            ]
        });
        return response.message.content || 'No facts generated';
    }
    catch (error) {
        console.error('Error generating facts:', error);
        throw new Error('Failed to generate facts');
    }
};
exports.generateFacts = generateFacts;
const generateLearning = async (parameters) => {
    try {
        const { topic, format, difficulty, sources } = parameters;
        const response = await ollama.chat({
            model: 'llama3:8b',
            messages: [
                {
                    role: 'system',
                    content: `You are a teacher explaining ${topic} to a ${difficulty} student. Format as:
          1. Brief intro (1-2 sentences)
          2. 2-3 key points
          3. One practical example
          4. One fun fact
          Keep it concise and conversational. Limit to 4 paragraphs maximum.`
                },
                {
                    role: 'user',
                    content: `Please teach me about ${topic} in a ${difficulty} level. Keep it concise and engaging. Limit to 4 paragraphs maximum.`
                }
            ]
        });
        let content = response.message.content;
        // Add source links if available
        if (sources && sources.length > 0) {
            content += '\n\n📚 Want to learn more? Check out these resources:\n';
            sources.forEach((source) => {
                content += `- ${source.name}: ${source.url}\n`;
            });
        }
        return content;
    }
    catch (error) {
        console.error('Error generating learning content:', error);
        throw new Error('Failed to generate learning content');
    }
};
exports.generateLearning = generateLearning;
const generateContent = async (type, parameters) => {
    switch (type) {
        case 'facts':
            return (0, exports.generateFacts)(parameters.target, parameters.count || 2, parameters.format || 'bullet');
        case 'learning':
            return (0, exports.generateLearning)(parameters);
        default:
            throw new Error(`Unsupported content type: ${type}`);
    }
};
exports.generateContent = generateContent;
