export interface Schedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly' | 'every_x_minutes' | 'continuous';
  interval?: number;
  time: string | null;
  day: string | null;
  date: string | null;
}

export interface LearningSource {
  name: string;
  url: string;
  description: string;
  content_types: string[];
}

export interface LearningParameters {
  topic: string;
  format: 'article_link' | 'summary' | 'facts';
  content_types: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sources: LearningSource[];
  summary_length?: 'short' | 'medium' | 'detailed';
  include_links?: boolean;
}

export interface ReminderParameters {
  target: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface SummaryParameters {
  target: string;
  source?: string;
  format?: 'short' | 'detailed';
}

export interface FetchParameters {
  target: string;
  count?: number;
  format?: 'facts' | 'article' | 'summary';
}

export interface NotificationContent {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  actions?: Array<{
    label: string;
    url?: string;
    callback?: string;
  }>;
  metadata?: {
    taskId: string;
    taskType: string;
    timestamp: string;
    [key: string]: any;
  };
}

export type TaskType = 'reminder' | 'summary' | 'fetch' | 'learning';

export interface Task {
  id: string;
  description: string;
  type: TaskType;
  metadata: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  scheduledTime: Date;
  frequency: string | null;
  lastRunAt: Date | null;
  lastResult: string | null;
  priority: number;
  schedule?: Schedule;
  user?: {
    id: string;
    username: string;
    email: string;
    name: string | null;
  };
  parameters?: Record<string, any>;
}

export interface ChatRequest {
  prompt: string;
  deliveryMethod: 'in-app' | 'email';
}

export interface IntentResponse {
  intent: string;
  source: string | null;
  schedule: string | null;
  action: string;
  parameters: Record<string, any>;
  description: string;
}

export interface ChatResponse {
  parsedIntent: IntentResponse;
  task?: Task;
  success: boolean;
  error?: string;
} 