"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReminderCommand = void 0;
const parseReminderCommand = (prompt) => {
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
exports.parseReminderCommand = parseReminderCommand;
