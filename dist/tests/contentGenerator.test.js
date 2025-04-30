"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contentGenerator_1 = require("../server/services/contentGenerator");
describe('Content Generator Tests', () => {
    test('should generate facts about AI', async () => {
        const facts = await (0, contentGenerator_1.generateContent)('facts', {
            target: 'artificial intelligence',
            count: 2,
            format: 'bullet'
        });
        expect(facts).toBeDefined();
        expect(typeof facts).toBe('string');
        expect(facts.length).toBeGreaterThan(0);
        console.log('Generated facts:', facts);
    });
    test('should generate learning content about Python', async () => {
        const learningContent = await (0, contentGenerator_1.generateContent)('learning', {
            topic: 'Python programming',
            format: 'article',
            difficulty: 'beginner',
            sources: [
                {
                    name: 'Python Official Documentation',
                    url: 'https://docs.python.org/3/'
                }
            ]
        });
        expect(learningContent).toBeDefined();
        expect(typeof learningContent).toBe('string');
        expect(learningContent.length).toBeGreaterThan(0);
        console.log('Generated learning content:', learningContent);
    });
});
