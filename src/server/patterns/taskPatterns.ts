import { TaskType } from '@server/types';

interface Pattern {
  pattern: RegExp;
  type: TaskType;
}

// Time-based patterns
export const timePatterns: RegExp[] = [
  /what(('|')s| is) the time/i,
  /current time/i,
  /time now/i,
  /what time is it/i
];

// Date-based patterns
export const datePatterns: RegExp[] = [
  /what(('|')s| is) the date/i,
  /what day is it/i,
  /what(('|')s| is) today/i,
  /current date/i,
  /date today/i
];

// Reminder Patterns
export const reminderPatterns: Pattern[] = [
  // Basic reminders
  { pattern: /remind me to/i, type: 'reminder' },
  { pattern: /set a reminder for/i, type: 'reminder' },
  { pattern: /don(('|')t| not) forget to/i, type: 'reminder' },
  { pattern: /remember to/i, type: 'reminder' },
  { pattern: /alert me to/i, type: 'reminder' },
  { pattern: /notify me to/i, type: 'reminder' },
  { pattern: /ping me to/i, type: 'reminder' },
  { pattern: /put a reminder for/i, type: 'reminder' },
  { pattern: /schedule a reminder for/i, type: 'reminder' },
  { pattern: /add a reminder for/i, type: 'reminder' },
  // Time-specific reminders
  { pattern: /remind me at/i, type: 'reminder' },
  { pattern: /set an alarm for/i, type: 'reminder' },
  { pattern: /wake me up at/i, type: 'reminder' },
  { pattern: /alert me at/i, type: 'reminder' },
  { pattern: /notify me at/i, type: 'reminder' },
  { pattern: /remind me in/i, type: 'reminder' },
  { pattern: /remind me every/i, type: 'reminder' },
  { pattern: /set a recurring reminder for/i, type: 'reminder' },
  // Event reminders
  { pattern: /remind me about my meeting/i, type: 'reminder' },
  { pattern: /remind me of my appointment/i, type: 'reminder' },
  { pattern: /remind me about the call/i, type: 'reminder' },
  { pattern: /remind me about the interview/i, type: 'reminder' },
  { pattern: /remind me about the conference/i, type: 'reminder' },
  { pattern: /remind me about the event/i, type: 'reminder' },
  { pattern: /remind me about the deadline/i, type: 'reminder' },
  // Task reminders
  { pattern: /remind me to take my medicine/i, type: 'reminder' },
  { pattern: /remind me to drink water/i, type: 'reminder' },
  { pattern: /remind me to exercise/i, type: 'reminder' },
  { pattern: /remind me to check my email/i, type: 'reminder' },
  { pattern: /remind me to pay bills/i, type: 'reminder' },
  { pattern: /remind me to call/i, type: 'reminder' },
  { pattern: /remind me to text/i, type: 'reminder' },
  { pattern: /remind me to email/i, type: 'reminder' },
  { pattern: /remind me to submit/i, type: 'reminder' },
  { pattern: /remind me to complete/i, type: 'reminder' },
  { pattern: /remind me to review/i, type: 'reminder' },
  { pattern: /remind me to update/i, type: 'reminder' },
  // Health reminders
  { pattern: /remind me to take my vitamins/i, type: 'reminder' },
  { pattern: /remind me to meditate/i, type: 'reminder' },
  { pattern: /remind me to stretch/i, type: 'reminder' },
  { pattern: /remind me to take a break/i, type: 'reminder' },
  // Work reminders
  { pattern: /remind me to follow up/i, type: 'reminder' },
  { pattern: /remind me to prepare for/i, type: 'reminder' },
  { pattern: /remind me to submit my report/i, type: 'reminder' },
  { pattern: /remind me to update my status/i, type: 'reminder' }
];

// Summary Patterns
export const summaryPatterns: Pattern[] = [
  // Basic summaries
  { pattern: /summarize|summary of/i, type: 'summary' },
  { pattern: /give me a summary of/i, type: 'summary' },
  { pattern: /brief me on/i, type: 'summary' },
  { pattern: /sum up/i, type: 'summary' },
  { pattern: /recap/i, type: 'summary' },
  { pattern: /condense/i, type: 'summary' },
  { pattern: /summarize this/i, type: 'summary' },
  { pattern: /give me the gist of/i, type: 'summary' },
  { pattern: /what(('|')s| is) the main point of/i, type: 'summary' },
  // Document summaries
  { pattern: /summarize this document/i, type: 'summary' },
  { pattern: /summarize this article/i, type: 'summary' },
  { pattern: /summarize this text/i, type: 'summary' },
  { pattern: /summarize this paper/i, type: 'summary' },
  { pattern: /summarize this report/i, type: 'summary' },
  { pattern: /summarize this book/i, type: 'summary' },
  // Meeting summaries
  { pattern: /summarize the meeting/i, type: 'summary' },
  { pattern: /summarize the call/i, type: 'summary' },
  { pattern: /summarize the discussion/i, type: 'summary' },
  { pattern: /summarize the conversation/i, type: 'summary' },
  { pattern: /summarize the interview/i, type: 'summary' },
  { pattern: /summarize the presentation/i, type: 'summary' },
  // Email summaries
  { pattern: /summarize my emails/i, type: 'summary' },
  { pattern: /summarize my inbox/i, type: 'summary' },
  { pattern: /summarize my messages/i, type: 'summary' },
  { pattern: /summarize my correspondence/i, type: 'summary' },
  // Content summaries
  { pattern: /summarize the content/i, type: 'summary' },
  { pattern: /summarize the material/i, type: 'summary' },
  { pattern: /summarize the information/i, type: 'summary' },
  { pattern: /summarize the data/i, type: 'summary' }
];

// Learning Patterns
export const learningPatterns: Pattern[] = [
  // Basic learning
  { pattern: /teach me about/i, type: 'learning' },
  { pattern: /learn about/i, type: 'learning' },
  { pattern: /explain/i, type: 'learning' },
  { pattern: /how to/i, type: 'learning' },
  { pattern: /tutorial on/i, type: 'learning' },
  { pattern: /guide me through/i, type: 'learning' },
  { pattern: /show me how to/i, type: 'learning' },
  { pattern: /help me understand/i, type: 'learning' },
  { pattern: /break down/i, type: 'learning' },
  { pattern: /walk me through/i, type: 'learning' },
  // Specific topics
  { pattern: /teach me programming/i, type: 'learning' },
  { pattern: /learn coding/i, type: 'learning' },
  { pattern: /explain javascript/i, type: 'learning' },
  { pattern: /how to code/i, type: 'learning' },
  { pattern: /learn python/i, type: 'learning' },
  { pattern: /teach me react/i, type: 'learning' },
  { pattern: /learn typescript/i, type: 'learning' },
  { pattern: /explain node.js/i, type: 'learning' },
  // Language learning
  { pattern: /teach me spanish/i, type: 'learning' },
  { pattern: /learn french/i, type: 'learning' },
  { pattern: /practice english/i, type: 'learning' },
  { pattern: /learn german/i, type: 'learning' },
  { pattern: /teach me chinese/i, type: 'learning' },
  { pattern: /learn japanese/i, type: 'learning' },
  // Skill learning
  { pattern: /teach me to cook/i, type: 'learning' },
  { pattern: /learn to play guitar/i, type: 'learning' },
  { pattern: /how to meditate/i, type: 'learning' },
  { pattern: /learn to draw/i, type: 'learning' },
  { pattern: /teach me photography/i, type: 'learning' },
  { pattern: /learn to dance/i, type: 'learning' },
  // Business skills
  { pattern: /teach me marketing/i, type: 'learning' },
  { pattern: /learn sales/i, type: 'learning' },
  { pattern: /explain finance/i, type: 'learning' },
  { pattern: /learn management/i, type: 'learning' },
  { pattern: /teach me leadership/i, type: 'learning' }
];

// Fetch Patterns
export const fetchPatterns: Pattern[] = [
  // Basic fetch
  { pattern: /get|fetch|find|search for/i, type: 'fetch' },
  { pattern: /look up/i, type: 'fetch' },
  { pattern: /retrieve/i, type: 'fetch' },
  { pattern: /find information about/i, type: 'fetch' },
  { pattern: /search for/i, type: 'fetch' },
  { pattern: /locate/i, type: 'fetch' },
  { pattern: /pull up/i, type: 'fetch' },
  { pattern: /bring up/i, type: 'fetch' },
  // Specific fetches
  { pattern: /get the weather/i, type: 'fetch' },
  { pattern: /find a restaurant/i, type: 'fetch' },
  { pattern: /search for flights/i, type: 'fetch' },
  { pattern: /look up a definition/i, type: 'fetch' },
  { pattern: /find a hotel/i, type: 'fetch' },
  { pattern: /get directions to/i, type: 'fetch' },
  { pattern: /find a doctor/i, type: 'fetch' },
  { pattern: /search for jobs/i, type: 'fetch' },
  // Data fetching
  { pattern: /get my emails/i, type: 'fetch' },
  { pattern: /fetch my calendar/i, type: 'fetch' },
  { pattern: /find my documents/i, type: 'fetch' },
  { pattern: /get my contacts/i, type: 'fetch' },
  { pattern: /fetch my notes/i, type: 'fetch' },
  { pattern: /find my files/i, type: 'fetch' },
  // Information fetching
  { pattern: /get the news/i, type: 'fetch' },
  { pattern: /find stock prices/i, type: 'fetch' },
  { pattern: /look up a phone number/i, type: 'fetch' },
  { pattern: /get sports scores/i, type: 'fetch' },
  { pattern: /find movie times/i, type: 'fetch' },
  { pattern: /search for recipes/i, type: 'fetch' },
  // Research fetching
  { pattern: /find research about/i, type: 'fetch' },
  { pattern: /get statistics on/i, type: 'fetch' },
  { pattern: /search for studies about/i, type: 'fetch' },
  { pattern: /find data about/i, type: 'fetch' }
];

// Combine all patterns
export const allPatterns: Pattern[] = [
  ...reminderPatterns,
  ...summaryPatterns,
  ...learningPatterns,
  ...fetchPatterns
]; 