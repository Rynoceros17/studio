
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, isValid, differenceInDays, differenceInWeeks, startOfDay, differenceInMonths, differenceInYears, differenceInHours, differenceInMinutes, addYears, addMonths, addWeeks, addDays } from 'date-fns';
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
    const CAL_TITLE_LIMIT_LG = 20; // Adjusted for 7 columns
    const CAL_DESC_LIMIT_LG = 15;  // Adjusted for 7 columns

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
    years: number;
    monthsInYear: number; // Remaining months after accounting for full years
    daysInMonth: number; // Remaining days after accounting for full years and months
    hoursInDay: number; // Remaining hours after accounting for full days
    totalDays: number;
    totalHours: number;
    isPastDue: boolean;
}

export function calculateTimeLeft(dueDateStr: string | undefined): TimeLeft | null {
  if (!dueDateStr) return null;
  const due = parseISO(dueDateStr);
  if (!isValid(due)) return null;

  const now = new Date();
  const today = startOfDay(now); // Compare with the start of today for "days left"

  if (due < today) { // If due date is before the start of today, it's past due
    const totalDaysPast = differenceInDays(today, due);
    return {
        years: 0, monthsInYear: 0, daysInMonth: 0, hoursInDay: 0,
        totalDays: -totalDaysPast,
        totalHours: -totalDaysPast * 24,
        isPastDue: true
    };
  }

  const totalDays = differenceInDays(due, today); // Days from start of today to due date
  const totalHours = differenceInHours(due, now); // Hours from right now to due date

  let tempDate = new Date(now);
  const years = differenceInYears(due, tempDate);
  tempDate = addYears(tempDate, years);

  const monthsInYear = differenceInMonths(due, tempDate);
  tempDate = addMonths(tempDate, monthsInYear);

  // Days remaining in the current month of the countdown
  const daysInMonth = differenceInDays(due, tempDate);

  // Hours remaining in the current day of the countdown
  // For this, we consider the difference from 'now' to the end of the 'due' date day for more precision
  const hoursInDay = totalHours >= 0 ? totalHours % 24 : 0;


  return {
    years,
    monthsInYear,
    daysInMonth,
    hoursInDay,
    totalDays,
    totalHours,
    isPastDue: totalHours < 0 && !isSameDay(due, today) // Past due if totalHours is negative and not due today
  };
}


// Moved from goals/page.tsx to be reusable
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
