import { Schedule } from '@server/types';

// Helper function to calculate relative time
const calculateRelativeTime = (currentTime: string, relativeTime: string): string => {
  // Parse relative time (e.g., "in 1 min", "in 5 minutes", "in 2 hours")
  const match = relativeTime.match(/in (\d+) (min|mins|minute|minutes|hour|hours)/i);
  if (!match) return currentTime;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  // Create a new Date object with the current time
  const now = new Date();
  const [hours, minutes] = currentTime.split(':').map(Number);
  
  // Set the time to the current time
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMilliseconds(0);

  // Add the relative time
  if (unit.startsWith('min')) {
    now.setMinutes(now.getMinutes() + amount);
  } else if (unit.startsWith('hour')) {
    now.setHours(now.getHours() + amount);
  }

  // Format the time in 24-hour format
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

export const normalizeSchedule = (
  schedule: Partial<Schedule>,
  currentTime: string,
  currentDate: string,
  prompt: string
): Schedule => {
  const normalizedSchedule: Schedule = {
    frequency: schedule.frequency || 'once',
    time: schedule.time ?? currentTime,
    day: schedule.day ?? null,
    date: schedule.date ?? (schedule.frequency === 'once' ? currentDate : null),
    interval: schedule.interval
  };

  // Check if the prompt contains relative time and adjust the schedule accordingly
  if (prompt.toLowerCase().includes('in ') && 
      (prompt.toLowerCase().includes('min') || prompt.toLowerCase().includes('hour'))) {
    const calculatedTime = calculateRelativeTime(currentTime, prompt);
    normalizedSchedule.time = calculatedTime;
    normalizedSchedule.date = currentDate;
    normalizedSchedule.frequency = 'once'; // Force one-time for relative time tasks
  }

  return normalizedSchedule;
};

export { calculateRelativeTime }; 