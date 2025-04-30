"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanAndParseLLMResponse = exports.extractTaskIntent = void 0;
const ollama_1 = require("ollama");
const intentPrompt_1 = require("@server/prompts/intentPrompt");
const ollama = new ollama_1.Ollama();
const extractTaskIntent = async (prompt, currentTime) => {
    const response = await ollama.chat({
        model: 'mistral:instruct',
        messages: [
            {
                role: 'system',
                content: intentPrompt_1.intentPrompt
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
    return (0, exports.cleanAndParseLLMResponse)(response.message.content);
};
exports.extractTaskIntent = extractTaskIntent;
const cleanAndParseLLMResponse = (responseContent) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to parse LLM response: ${errorMessage}\nRaw response: ${responseContent}`);
    }
};
exports.cleanAndParseLLMResponse = cleanAndParseLLMResponse;
