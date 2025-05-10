import { TaskType } from '@server/types';

// Simple patterns that don't need LLM processing
export const simplePatterns = [
  /^remind me to .*$/i,
  /^call .*$/i,
  /^email .*$/i,
  /^message .*$/i,
  /^text .*$/i,
  /^schedule .*$/i,
  /^book .*$/i,
  /^reserve .*$/i,
  /^set up .*$/i,
  /^create .*$/i,
  /^set .*$/i,
  /^add .*$/i,
  /^start .*$/i,
  /^begin .*$/i,
  /^initiate .*$/i
];

// Complex patterns that need LLM processing
export const complexPatterns = [
  /summarize/i,
  /analyze/i,
  /compare/i,
  /explain/i,
  /describe/i,
  /generate/i,
  /create a/i,
  /write a/i,
  /draft a/i,
  /compose a/i,
  /research/i,
  /investigate/i,
  /review/i,
  /evaluate/i,
  /assess/i,
  /suggest/i,
  /recommend/i,
  /propose/i,
  /design/i,
  /develop/i
];

// Task types that always require LLM processing
export const llmRequiredTypes: TaskType[] = ['summary', 'learning'];

// Helper function to determine if LLM processing is needed
export const needsLLMProcessing = (prompt: string, taskType: TaskType): boolean => {
  const lowerPrompt = prompt.toLowerCase();
  
  // If it's a task type that requires LLM, always return true
  if (llmRequiredTypes.includes(taskType)) {
    return true;
  }

  // Check if the prompt matches any simple patterns
  for (const pattern of simplePatterns) {
    if (pattern.test(prompt)) {
      return false;
    }
  }

  // Check for complex patterns that need LLM
  for (const pattern of complexPatterns) {
    if (pattern.test(lowerPrompt)) {
      return true;
    }
  }

  // Default to true if we're unsure
  return true;
};

// Helper function to log pattern matches for analysis
export const logPatternMatch = (prompt: string, taskType: TaskType, needsLLM: boolean): void => {
  console.log('Pattern Analysis:', {
    prompt,
    taskType,
    needsLLM,
    matchedSimplePatterns: simplePatterns.filter(pattern => pattern.test(prompt)),
    matchedComplexPatterns: complexPatterns.filter(pattern => pattern.test(prompt.toLowerCase()))
  });
}; 