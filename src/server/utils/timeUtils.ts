import { format } from 'date-fns';

export const formatTime = (date: Date): string => {
  return format(date, 'HH:mm');
};

export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const isTaskDue = (
  scheduledTime: string,
  currentTime: string,
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly' | 'every_x_minutes',
  lastExecution: string | null,
  interval?: number,
  scheduledDate?: string
): boolean => {
  const now = new Date();
  const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);
  
  // Get current time in local timezone with proper formatting
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  const formattedCurrentTime = formatTime(now);
  const currentDate = formatDate(now);
  
  // Convert to seconds since midnight for more precise comparison
  const scheduledSecondsSinceMidnight = scheduledHours * 3600 + scheduledMinutes * 60;
  const currentSecondsSinceMidnight = currentHours * 3600 + currentMinutes * 60 + currentSeconds;
  
  // For one-time tasks, check both date and time with 30-second precision
  if (frequency === 'once') {
    const isDue = scheduledDate === currentDate && 
                 Math.abs(currentSecondsSinceMidnight - scheduledSecondsSinceMidnight) <= 30;
    return isDue;
  }

  // For hourly tasks, check if the current minute matches the scheduled minute with 30-second precision
  if (frequency === 'hourly') {
    const isDue = Math.abs(currentMinutes - scheduledMinutes) <= 0.5; // 30 seconds
    return isDue;
  }

  // For tasks that run every X minutes
  if (frequency === 'every_x_minutes' && interval) {
    const minutesSinceLastExecution = lastExecution 
      ? Math.floor((now.getTime() - new Date(lastExecution).getTime()) / (1000 * 60))
      : Infinity;
    const isDue = minutesSinceLastExecution >= interval && 
                 Math.abs(currentSecondsSinceMidnight % (interval * 60) - scheduledSecondsSinceMidnight % (interval * 60)) <= 30;
    return isDue;
  }

  // For daily tasks, check if it's the right time and hasn't run today
  if (frequency === 'daily') {
    const lastExecDate = lastExecution ? new Date(lastExecution) : null;
    const today = formatDate(now);
    const lastExecDay = lastExecDate ? formatDate(lastExecDate) : null;
    
    const timeMatches = Math.abs(currentSecondsSinceMidnight - scheduledSecondsSinceMidnight) <= 30;
    const hasNotRunToday = lastExecDay !== today;
    
    return timeMatches && hasNotRunToday;
  }

  // For weekly tasks, check if it's the right day and time
  if (frequency === 'weekly') {
    const lastExecDate = lastExecution ? new Date(lastExecution) : null;
    const lastExecDay = lastExecDate ? lastExecDate.getDay() : -1;
    const currentDay = now.getDay();
    
    const timeMatches = Math.abs(currentSecondsSinceMidnight - scheduledSecondsSinceMidnight) <= 30;
    const isCorrectDay = currentDay === lastExecDay;
    
    return timeMatches && isCorrectDay;
  }

  // For monthly tasks, check if it's the right day of month and time
  if (frequency === 'monthly') {
    const lastExecDate = lastExecution ? new Date(lastExecution) : null;
    const lastExecDay = lastExecDate ? lastExecDate.getDate() : -1;
    const currentDay = now.getDate();
    
    const timeMatches = Math.abs(currentSecondsSinceMidnight - scheduledSecondsSinceMidnight) <= 30;
    const isCorrectDay = currentDay === lastExecDay;
    
    return timeMatches && isCorrectDay;
  }

  return false;
};

// Helper function to calculate next execution time
export const calculateNextExecutionTime = (
  schedule: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'hourly' | 'every_x_minutes';
    time: string | null;
    day?: string | null;
    date?: string | null;
    interval?: number;
  },
  currentTime: Date
): string | undefined => {
  if (!schedule) return undefined;
  
  const nextTime = new Date(currentTime);
  const [hours, minutes] = (schedule.time || '00:00').split(':').map(Number);
  
  nextTime.setHours(hours);
  nextTime.setMinutes(minutes);
  nextTime.setSeconds(0);
  nextTime.setMilliseconds(0);
  
  switch (schedule.frequency) {
    case 'hourly':
      nextTime.setHours(nextTime.getHours() + 1);
      break;
    case 'daily':
      nextTime.setDate(nextTime.getDate() + 1);
      break;
    case 'weekly':
      nextTime.setDate(nextTime.getDate() + 7);
      break;
    case 'monthly':
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
    case 'every_x_minutes':
      if (schedule.interval) {
        nextTime.setMinutes(nextTime.getMinutes() + schedule.interval);
      }
      break;
  }
  
  return nextTime.toISOString();
};

export interface RelativeTimeResult {
  time: string;
  date: string;
}

export const calculateRelativeTime = (currentTime: string, prompt: string): RelativeTimeResult => {
  const now = new Date();
  const [hours, minutes] = currentTime.split(':').map(Number);
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMilliseconds(0);

  console.log('Starting time calculation with:', { currentTime, prompt });

  // Extract time value and unit from prompt
  const timeMatch = prompt.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hour(?:s)?)/);
  if (!timeMatch) {
    // Try alternative formats like "half an hour"
    const halfHourMatch = prompt.toLowerCase().match(/half\s+an?\s+hour/);
    if (halfHourMatch) {
      console.log('Matched half hour format');
      now.setMinutes(now.getMinutes() + 30);
    } else {
      return {
        time: currentTime,
        date: formatDate(now)
      };
    }
  } else {
    const amount = parseFloat(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();

    if (unit.startsWith('min')) {
      now.setMinutes(now.getMinutes() + amount);
    } else if (unit.startsWith('hour')) {
      now.setHours(now.getHours() + amount);
    }
  }

  // If the calculated time is earlier than current time, add a day
  const currentDate = new Date();
  if (now < currentDate) {
    now.setDate(now.getDate() + 1);
  }

  // Format the time in 24-hour format
  const result: RelativeTimeResult = {
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    date: formatDate(now)
  };

  console.log('Calculated relative time:', result);
  return result;
}; 