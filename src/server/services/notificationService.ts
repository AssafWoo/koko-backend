import { Task } from '../types';
import { notificationManager } from './notificationManager';

export interface NotificationContent {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  metadata?: {
    taskId: string;
    taskType: string;
    timestamp: string;
    formattedDateTime?: string;
    [key: string]: any;
  };
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function createNotificationContent(task: Task, message: string, type: 'success' | 'error' | 'info' | 'warning'): NotificationContent {
  console.log('[NotificationService] Creating notification content for task:', task.id);
  const scheduledTime = new Date(task.scheduledTime);
  const formattedDateTime = formatDateTime(scheduledTime);

  const content = {
    title: `Task ${task.description}`,
    message: `${message}\nDue: ${formattedDateTime}`,
    type,
    metadata: {
      taskId: task.id,
      taskType: task.type,
      timestamp: new Date().toISOString(),
      taskDescription: task.description,
      formattedDateTime
    }
  };

  console.log('[NotificationService] Created notification content:', content);
  return content;
}

export async function sendNotification(type: string, content: NotificationContent): Promise<void> {
  console.log(`[NotificationService] Attempting to send ${type} notification:`, content);
  
  try {
    // Send notification through EventStream
    const notificationPayload = {
      type,
      content: content
    };
    
    console.log('[NotificationService] Sending notification payload:', notificationPayload);
    const payloadString = JSON.stringify(notificationPayload);
    console.log('[NotificationService] Serialized payload:', payloadString);
    
    notificationManager.sendNotification(payloadString);
    console.log('[NotificationService] Notification sent successfully');

    // For development logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NotificationService] DEV: Sent ${type} notification to EventStream for task ${content.metadata?.taskId}`);
      console.log(`[NotificationService] DEV: Active clients: ${notificationManager.getClientCount()}`);
      console.log(`[NotificationService] DEV: Notification type: ${type}`);
      console.log(`[NotificationService] DEV: Full notification content:`, content);
    }
  } catch (error) {
    console.error('[NotificationService] Failed to send notification:', error);
    // Don't throw the error as we don't want notification failures to break the task execution
    // But we should log it for monitoring
  }
} 