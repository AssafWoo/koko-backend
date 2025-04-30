"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExplanation = exports.generateQuiz = void 0;
exports.generateEducationalContent = generateEducationalContent;
exports.generateInteractiveQuestion = generateInteractiveQuestion;
const llmTaskRouter_1 = require("./llmTaskRouter");
const llmRouter = llmTaskRouter_1.LLMTaskRouter.getInstance();
async function generateEducationalContent(topic, format, difficulty, sources) {
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
        let content = await llmRouter.processTask({ type: 'learning' }, `Please teach me about ${topic} in a ${difficulty} level.`);
        // Add source links if available
        if (sources.length > 0) {
            content += '\n\n📚 Want to learn more? Check out these resources:\n';
            sources.forEach(source => {
                content += `- ${source.name}: ${source.url}\n`;
            });
        }
        return content;
    }
    catch (error) {
        console.error('Error generating educational content:', error);
        throw error;
    }
}
async function generateInteractiveQuestion(topic, difficulty) {
    try {
        return await llmRouter.processTask({ type: 'learning' }, `Generate an interactive question about ${topic} for a ${difficulty} student.`);
    }
    catch (error) {
        console.error('Error generating interactive question:', error);
        throw error;
    }
}
const generateQuiz = async (topic, difficulty = 'beginner') => {
    try {
        return await llmRouter.processTask({ type: 'learning' }, `Please create a ${difficulty} level quiz about ${topic}.`);
    }
    catch (error) {
        console.error('Error generating quiz:', error);
        throw new Error('Failed to generate quiz');
    }
};
exports.generateQuiz = generateQuiz;
const generateExplanation = async (topic, concept, difficulty = 'beginner') => {
    try {
        return await llmRouter.processTask({ type: 'learning' }, `Please explain ${concept} in the context of ${topic} at a ${difficulty} level.`);
    }
    catch (error) {
        console.error('Error generating explanation:', error);
        throw new Error('Failed to generate explanation');
    }
};
exports.generateExplanation = generateExplanation;
