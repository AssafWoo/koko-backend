import express from 'express';
import { z } from 'zod';
import { Task, Schedule, ReminderParameters, SummaryParameters, FetchParameters, LearningParameters, LearningSource, TaskType } from '@server/types';
import { createTask, runTask, updateTask } from '@server/services/taskService';
import { createNotificationContent, sendNotification } from '@server/services/notificationService';
import { authenticateToken } from '@server/middleware/auth';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { timePatterns, datePatterns, allPatterns } from '@server/patterns/taskPatterns';

const router = express.Router();

const learningSourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string(),
  content_types: z.array(z.string())
});

const taskInputSchema = z.object({
  type: z.enum(['reminder', 'summary', 'fetch', 'learning']),
  source: z.string().nullable(),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'hourly', 'every_x_minutes', 'continuous', 'multiple_times']),
    time: z.string().nullable(),
    day: z.string().nullable(),
    date: z.string().nullable(),
    interval: z.number().optional(),
    timesPerDay: z.number().optional(),
    timesPerWeek: z.number().optional(),
    timesPerMonth: z.number().optional(),
    timesPerHour: z.number().optional()
  }).nullable(),
  action: z.string(),
  parameters: z.record(z.any()),
  description: z.string(),
  deliveryMethod: z.enum(['in-app', 'email', 'slack']).optional(),
  prompt: z.string(),
  previewResult: z.string()
});

const taskUpdateSchema = z.object({
  description: z.string().optional(),
  schedule: z.object({
    time: z.string().nullable().optional(),
    day: z.string().nullable().optional(),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'hourly', 'every_x_minutes', 'continuous']).optional()
  }).optional(),
  type: z.enum(['reminder', 'summary', 'fetch', 'learning']).optional()
});

const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  reminder: [
    'remind', 'reminder', 'alert', 'notify', 'notification', 'ping', 'nudge', 'prompt', 'remember', 'wake', 'wakeup', 'alarm', 'deadline', 'due', 'schedule', 'calendar', 'appointment', 'meeting'
  ],
  learning: [
    'teach', 'learn', 'study', 'explain', 'educate', 'lesson', 'course', 'training', 'tutorial', 'instruct', 'instruction', 'guide', 'how to', 'show me', 'help me understand', 'what is', 'definition', 'meaning', 'overview', 'introduction', 'basics', 'fundamentals', 'info about', 'information on', 'details about'
  ],
  summary: [
    'summarize', 'summary', 'recap', 'brief', 'condense', 'outline', 'abstract', 'digest', 'highlight', 'key points', 'main points', 'tl;dr', 'short version', 'in short', 'in a nutshell', 'essence', 'core idea', 'main idea', 'quick look', 'quick review'
  ],
  fetch: [
    'fetch', 'get', 'retrieve', 'collect', 'pull', 'download', 'obtain', 'acquire', 'gather', 'lookup', 'search', 'find', 'show', 'display', 'present', 'bring', 'access', 'scrape', 'extract', 'load', 'list', 'provide', 'give me', 'show me', 'find me', 'look up', 'check', 'scan'
  ],
  // If you have a 'send' type, add it here
};

function normalizeInput(input: string): string {
  // Trim whitespace
  let normalized = input.trim();
  // Convert to lowercase
  normalized = normalized.toLowerCase();
  // Expand common abbreviations (example: 'rem' -> 'remind')
  const abbreviations: Record<string, string> = {
    'rem': 'remind',
    'sum': 'summarize',
    'fetch': 'get',
    'learn': 'study'
  };
  Object.entries(abbreviations).forEach(([abbr, full]) => {
    normalized = normalized.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
  });
  return normalized;
}

function quickTaskTypeDetect(prompt: string): TaskType | null {
  const lower = prompt.toLowerCase();
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some(word => lower.includes(word))) {
      return type as TaskType;
    }
  }
  return null; // fallback to LLM
}

// Create a rate limiter for LLM routes
const llmLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each user to 5 LLM requests per minute
  message: 'Too many requests, please try again later.'
});

// Add placeholder callLLM function
async function callLLM(prompt: string): Promise<string> {
  // Placeholder for your actual LLM call
  return 'LLM response for: ' + prompt;
}

// Add Fallback/Graceful Degradation Layer
interface LLMResponse {
  content: string;
  error?: string;
}

async function callLLMWithFallback(prompt: string): Promise<LLMResponse> {
  try {
    const result = await Promise.race<LLMResponse>([
      // Your actual LLM call here
      Promise.resolve({ content: `LLM processed: ${prompt}` }),
      new Promise<LLMResponse>((_, reject) => 
        setTimeout(() => reject(new Error('LLM request timed out')), 5000)
      )
    ]);
    return result;
  } catch (error) {
    console.error('LLM call failed:', error);
    return {
      content: 'I apologize, but I am having trouble processing your request right now. Please try again in a moment.',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Add Pre-LLM Filtering Layer
interface PreLLMResult {
  handled: boolean;
  result?: string;
  error?: string;
  type?: TaskType;
}

function preLLMFilter(prompt: string): PreLLMResult {
  const normalized = prompt.trim().toLowerCase();

  // Empty or invalid input
  if (!normalized) {
    return {
      handled: true,
      error: 'Please enter a valid request.'
    };
  }

  // Time-based queries
  if (timePatterns.some(pattern => pattern.test(normalized))) {
    return {
      handled: true,
      result: `The current time is ${new Date().toLocaleTimeString()}`,
      type: 'reminder'
    };
  }

  // Date-based queries
  if (datePatterns.some(pattern => pattern.test(normalized))) {
    return {
      handled: true,
      result: `Today's date is ${new Date().toLocaleDateString()}`,
      type: 'reminder'
    };
  }

  // Check all patterns
  for (const { pattern, type } of allPatterns) {
    if (pattern.test(normalized)) {
      return {
        handled: true,
        type: type as TaskType,
        result: `I'll ${type} ${normalized.replace(pattern, '').trim()}`
      };
    }
  }

  // Not handled by pre-filter
  return {
    handled: false
  };
}

// Apply rate limiter to the POST route
router.post('/', llmLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = taskInputSchema.parse(req.body);
    const userId = req.user?.id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Input Validation & Normalization Layer
    const normalizedDescription = normalizeInput(validatedData.description);
    validatedData.description = normalizedDescription;

    // Pre-LLM Filtering Layer
    const preFilterResult = preLLMFilter(normalizedDescription);
    if (preFilterResult.handled) {
      if (preFilterResult.error) {
        res.status(400).json({ error: preFilterResult.error });
        return;
      }

      // If we have a result from pre-filter, use it
      const task = await createTask({
        ...validatedData,
        type: preFilterResult.type || validatedData.type,
        prompt: validatedData.description,
        previewResult: preFilterResult.result || validatedData.description,
        schedule: validatedData.schedule || {
          frequency: 'once',
          time: null,
          day: null,
          date: null
        }
      }, userId);

      // Send notification for task creation
      try {
        const notification = createNotificationContent(task, 'New task created', 'info');
        await sendNotification('taskCreated', notification);
      } catch (notificationError) {
        console.error('Failed to send task creation notification:', notificationError);
      }

      res.json({
        task,
        preFiltered: true,
        message: 'Request handled by pre-filter'
      });
      return;
    }

    // Quick task type detection before LLM
    const quickType = quickTaskTypeDetect(normalizedDescription);
    if (quickType) {
      validatedData.type = quickType;
    }

    // Fallback/Graceful Degradation Layer
    const llmResult = await callLLMWithFallback(validatedData.description);
    
    const task = await createTask({
      ...validatedData,
      prompt: validatedData.description,
      previewResult: llmResult.content,
      schedule: validatedData.schedule || {
        frequency: 'once',
        time: null,
        day: null,
        date: null
      }
    }, userId);

    if (llmResult.error) {
      res.json({
        task,
        warning: 'Task created with fallback response due to LLM processing issue'
      });
    } else {
      res.json(task);
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'An unknown error occurred' });
    }
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.id?.toString();
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const result = await runTask(taskId, userId);
    
    if (!result) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Send notification about task completion
    try {
      const notification = createNotificationContent(result, 'Task completed successfully', 'success');
      await sendNotification('taskCompleted', notification);
      console.log('[TaskRoutes] Sent task completion notification');
    } catch (notificationError) {
      console.error('[TaskRoutes] Failed to send task completion notification:', notificationError);
    }
    
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'An unknown error occurred' });
    }
  }
});

router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id?.toString();
    
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validatedData = taskUpdateSchema.parse(req.body);
    const updatedTask = await updateTask(id, userId, validatedData);

    if (!updatedTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(updatedTask);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'An unknown error occurred' });
    }
  }
});

export default router; 