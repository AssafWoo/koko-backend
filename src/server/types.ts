export type TaskType = 'http' | 'script' | 'database';

export type Schedule = {
  type: 'interval' | 'cron';
  value: string;
};

export type TaskParameters = {
  type: TaskType;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  script?: string;
  database?: string;
  query?: string;
};

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'scheduled';

export type TaskLog = {
  timestamp: string;
  message: string;
};

export type Task = {
  id: string;
  type: TaskType;
  schedule: Schedule;
  parameters: TaskParameters;
  status: TaskStatus;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
}; 