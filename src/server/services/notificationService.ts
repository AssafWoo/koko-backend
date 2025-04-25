import { Task, NotificationContent } from '../types';

export function createNotificationContent(
  task: Task,
  message?: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): NotificationContent {
  const now = new Date();
  const baseContent: NotificationContent = {
    title: '',
    message: message || '',
    type,
    metadata: {
      taskId: task.id,
      taskType: task.type,
      timestamp: now.toISOString()
    }
  };

  switch (task.type) {
    case 'reminder':
      return {
        ...baseContent,
        title: '⏰ Reminder',
        message: message || `Time for: ${task.description}`,
        icon: '⏰',
        actions: [{
          label: 'Mark as Done',
          callback: 'markAsDone'
        }]
      };
    
    case 'fetch':
      return {
        ...baseContent,
        title: '🔍 Content Fetch',
        message: message || `Fetched: ${task.description}`,
        icon: '🔍',
        actions: [{
          label: 'View Details',
          callback: 'showFetchResults'
        }]
      };
    
    case 'summary':
      return {
        ...baseContent,
        title: '📝 Summary',
        message: message || `Summary: ${task.description}`,
        icon: '📝',
        actions: [{
          label: 'View Summary',
          callback: 'showFullSummary'
        }]
      };
    
    case 'learning':
      return {
        ...baseContent,
        title: '🧠 Learning Update',
        message: message || `Learning: ${task.description}`,
        icon: '🧠',
        actions: [{
          label: 'View Content',
          callback: 'showLearningContent'
        }]
      };
    
    default:
      return {
        ...baseContent,
        title: '🔔 Task Update',
        message: message || task.description
      };
  }
}

export async function sendNotification(type: string, data: any) {
  // This is a placeholder for actual notification sending logic
  // In a real implementation, this would send notifications to connected clients
  console.log(`Notification: ${type}`, data);
} 