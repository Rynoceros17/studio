
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
    parseISO,
    isValid,
    differenceInDays,
    startOfDay,
    differenceInMonths,
    differenceInYears,
    differenceInHours,
    differenceInMinutes,
    addYears,
    addMonths,
    addDays,
    isSameDay,
    endOfDay,
    differenceInCalendarDays
} from 'date-fns';
import type { Goal, Subtask } from "./types";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const truncateText = (text: string | undefined | null, limit: number): string => {
    if (!text) return '';
    if (text.length > limit) {
        return text.substring(0, limit) + '...';
    }
    return text;
};

export const getMaxLength = (limitType: 'title' | 'desc', context: 'calendar' | 'dialog' | 'subtask' = 'calendar'): number => {
    const CAL_TITLE_LIMIT_SM = 40;
    const CAL_DESC_LIMIT_SM = 40;
    const CAL_TITLE_LIMIT_MD = 25;
    const CAL_DESC_LIMIT_MD = 25;
    const CAL_TITLE_LIMIT_LG = 20;
    const CAL_DESC_LIMIT_LG = 15;

    const DIALOG_TITLE_LIMIT = 55;
    const DIALOG_DESC_LIMIT = 40;

    const SUBTASK_TITLE_LIMIT = 30;

    if (context === 'dialog') {
        return limitType === 'title' ? DIALOG_TITLE_LIMIT : DIALOG_DESC_LIMIT;
    }

    if (context === 'subtask') {
        return SUBTASK_TITLE_LIMIT;
    }

    if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) {
            return limitType === 'title' ? CAL_TITLE_LIMIT_SM : CAL_DESC_LIMIT_SM;
        } else if (window.innerWidth < 1024) {
            return limitType === 'title' ? CAL_TITLE_LIMIT_MD : CAL_DESC_LIMIT_MD;
        } else {
            return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG;
        }
    }
    return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG;
};

export const formatDuration = (totalSeconds: number): string => {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
    totalSeconds = 0;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  } else {
    return `${minutesStr}:${secondsStr}`;
  }
};

export interface TimeLeft {
    fullDaysRemaining: number;  // Number of full 24-hour days *after* the current day ends, until the due day starts.
    hoursInCurrentDay: number; // Hours left in the current day (until midnight) or in the due day if dueToday.
    minutesInCurrentHour: number; // Minutes component for hoursInCurrentDay.
    isPastDue: boolean;
    isDueToday: boolean;
    totalMonths: number; // Total full months from now until the start of the due date.
    totalYears: number;  // Total full years from now until the start of the due date.
}


export function calculateTimeLeft(dueDateStr: string | undefined): TimeLeft | null {
  if (!dueDateStr) return null;
  const dueDateTime = startOfDay(parseISO(dueDateStr + "T00:00:00")); // Ensure we compare start of day
  if (!isValid(dueDateTime)) return null;

  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = endOfDay(now);

  const isPastDue = dueDateTime < startOfToday;
  const isDueToday = isSameDay(dueDateTime, startOfToday);

  // These are for the broader display like "X years, Y months left"
  const totalMonths = Math.max(0, differenceInMonths(dueDateTime, now));
  const totalYears = Math.max(0, differenceInYears(dueDateTime, now));


  if (isPastDue) {
    return {
        fullDaysRemaining: 0, // Or could be negative to indicate how many days past
        hoursInCurrentDay: 0,
        minutesInCurrentHour: 0,
        isPastDue: true,
        isDueToday: false,
        totalMonths, // Will be 0 or negative if using differenceInMonths from past
        totalYears,  // Will be 0 or negative
    };
  }

  if (isDueToday) {
    const msLeftToday = Math.max(0, endOfToday.getTime() - now.getTime());
    const hours = Math.floor(msLeftToday / (1000 * 60 * 60));
    const minutes = Math.floor((msLeftToday % (1000 * 60 * 60)) / (1000 * 60));
    return {
        fullDaysRemaining: 0,
        hoursInCurrentDay: hours,
        minutesInCurrentHour: minutes,
        isPastDue: false,
        isDueToday: true,
        totalMonths,
        totalYears,
    };
  }

  // Due in the future (not today, not past)
  // fullDaysRemaining: Number of full 24-hour days *after* the current day ends, until the due day starts.
  const fullDaysRemaining = Math.max(0, differenceInCalendarDays(dueDateTime, now) - 1);

  const msUntilEndOfToday = Math.max(0, endOfToday.getTime() - now.getTime());
  const hoursInCurrentDay = Math.floor(msUntilEndOfToday / (1000 * 60 * 60));
  const minutesInCurrentHour = Math.floor((msUntilEndOfToday % (1000 * 60 * 60)) / (1000 * 60));

  return {
    fullDaysRemaining,
    hoursInCurrentDay,
    minutesInCurrentHour,
    isPastDue: false,
    isDueToday: false,
    totalMonths,
    totalYears,
  };
}


const countSubtasksRecursive = (subtasks: Subtask[]): { total: number, completed: number } => {
    let total = 0;
    let completed = 0;
    subtasks.forEach(subtask => {
        total++;
        if (subtask.completed) {
            completed++;
        }
        if (subtask.subtasks && subtask.subtasks.length > 0) {
            const childCounts = countSubtasksRecursive(subtask.subtasks);
            total += childCounts.total;
            completed += childCounts.completed;
        }
    });
    return { total, completed };
};

export const calculateGoalProgress = (goal: Goal): number => {
    if (!goal || !goal.subtasks || goal.subtasks.length === 0) {
        return 0;
    }
    const { total, completed } = countSubtasksRecursive(goal.subtasks);
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
};
