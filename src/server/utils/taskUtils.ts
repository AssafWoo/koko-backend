interface ReminderCommand {
  time: string;
  target: string;
}

export const parseReminderCommand = (prompt: string): ReminderCommand | null => {
  const reminderRegex = /^remind me about (.*?) at (.*?)$/i;
  const match = prompt.match(reminderRegex);

  if (!match) {
    return null;
  }

  return {
    target: match[1].trim(),
    time: match[2].trim()
  };
}; 