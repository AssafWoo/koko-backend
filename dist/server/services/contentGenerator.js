"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContent = exports.generateLearning = exports.generateFacts = void 0;
const ollama_1 = require("ollama");
const ollama = new ollama_1.Ollama();
const generateFacts = async (topic, count = 2, format = 'bullet') => {
    try {
        const response = await ollama.chat({
            model: 'llama2',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant that provides interesting and accurate facts about ${topic}. Focus on lesser-known, fascinating, or educational facts.`
                },
                {
                    role: 'user',
                    content: `Please provide ${count} interesting facts about ${topic}. ${format === 'bullet'
                        ? 'Format each fact as a bullet point starting with •'
                        : 'Format as a cohesive paragraph'}.`
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
            model: 'llama2',
            messages: [
                {
                    role: 'system',
                    content: `You are a friendly and engaging teacher explaining ${topic} to a ${difficulty} student.
          Your goal is to make the content interesting, easy to understand, and memorable.
          Use analogies, examples, and a conversational tone.
          Format the content as a lesson with:
          1. A brief introduction
          2. Key points or facts
          3. A real-world example or analogy
          4. A fun fact or interesting tidbit
          5. A thought-provoking question to encourage further learning

          Make it feel like a personal conversation with the student.`
                },
                {
                    role: 'user',
                    content: `Please teach me about ${topic} in a ${difficulty} level.`
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
