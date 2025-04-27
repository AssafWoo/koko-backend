"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNextExecutionTime = exports.isTaskDue = exports.formatDate = exports.formatTime = void 0;
const date_fns_1 = require("date-fns");
const formatTime = (date) => {
    return (0, date_fns_1.format)(date, 'HH:mm');
};
exports.formatTime = formatTime;
const formatDate = (date) => {
    return (0, date_fns_1.format)(date, 'yyyy-MM-dd');
};
exports.formatDate = formatDate;
const isTaskDue = (scheduledTime, currentTime, frequency, lastExecution, interval, scheduledDate) => {
    const now = new Date();
    const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);
    // Get current time in local timezone with proper formatting
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const formattedCurrentTime = (0, exports.formatTime)(now);
    const currentDate = (0, exports.formatDate)(now);
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
        const today = (0, exports.formatDate)(now);
        const lastExecDay = lastExecDate ? (0, exports.formatDate)(lastExecDate) : null;
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
exports.isTaskDue = isTaskDue;
// Helper function to calculate next execution time
const calculateNextExecutionTime = (schedule, currentTime) => {
    if (!schedule)
        return null;
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
exports.calculateNextExecutionTime = calculateNextExecutionTime;
