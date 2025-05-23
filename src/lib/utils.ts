
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
    addWeeks,
    addDays,
    addHours,
    isSameDay,
    endOfDay,
    differenceInCalendarDays,
    differenceInWeeks,
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
  // For detailed Y:M:W:D:H display
  yearsDetailed: number;
  monthsDetailed: number;
  weeksDetailed: number;
  daysDetailed: number;
  hoursDetailed: number;

  isPastDue: boolean;
  isDueToday: boolean;

  // For badge display and general logic
  totalYears: number;   // Total full years difference
  totalMonths: number;  // Total full months difference
  totalWeeks: number;   // Total full weeks difference
  fullDaysRemaining: number; // Calendar days from today until due date (0 if today, 1 if tomorrow etc.)
  hoursInCurrentDay: number; // Hours left in the current day (until midnight if due future) or in due day (if due today)
  minutesInCurrentHour: number; // Minutes component for hoursInCurrentDay
}


export function calculateTimeLeft(dueDateStr: string | undefined): TimeLeft | null {
  if (!dueDateStr) return null;
  // Ensure dueDate is parsed as the beginning of that day in local time
  const startOfDueDate = parseISO(dueDateStr + "T00:00:00"); 
  if (!isValid(startOfDueDate)) return null;

  const now = new Date();
  const startOfToday = startOfDay(now);

  const isPastDue = startOfDueDate < startOfToday;
  const isDueToday = isSameDay(startOfDueDate, startOfToday);

  // --- Calculate components for the detailed Y:M:W:D:H string ---
  let yearsDetailed = 0;
  let monthsDetailed = 0;
  let weeksDetailed = 0;
  let daysDetailed = 0;
  let hoursDetailed = 0;

  if (!isPastDue) {
    let _currentDateForDetailedCalc = new Date(now); // Clone `now`
    
    yearsDetailed = differenceInYears(startOfDueDate, _currentDateForDetailedCalc);
    _currentDateForDetailedCalc = addYears(_currentDateForDetailedCalc, yearsDetailed);

    monthsDetailed = differenceInMonths(startOfDueDate, _currentDateForDetailedCalc);
    _currentDateForDetailedCalc = addMonths(_currentDateForDetailedCalc, monthsDetailed);

    weeksDetailed = differenceInWeeks(startOfDueDate, _currentDateForDetailedCalc);
    _currentDateForDetailedCalc = addWeeks(_currentDateForDetailedCalc, weeksDetailed);
    
    daysDetailed = differenceInDays(startOfDueDate, _currentDateForDetailedCalc); 
    _currentDateForDetailedCalc = addDays(_currentDateForDetailedCalc, daysDetailed);

    // hoursDetailed will be the remaining hours until the startOfDueDate (which is midnight)
    // This will be 0 if startOfDueDate is exactly at midnight and _currentDateForDetailedCalc has also reached that midnight.
    // If there's a time component to startOfDueDate (not the case here), this would be different.
    hoursDetailed = differenceInHours(startOfDueDate, _currentDateForDetailedCalc);
  }

  // --- Calculate components for badge and general logic ---
  const totalYearsBadge = differenceInYears(startOfDueDate, startOfToday);
  const totalMonthsBadge = differenceInMonths(startOfDueDate, startOfToday);
  const totalWeeksBadge = differenceInWeeks(startOfDueDate, startOfToday);
  const fullDaysRemainingBadge = isPastDue ? 0 : differenceInCalendarDays(startOfDueDate, startOfToday);

  let hoursInCurrentDayBadge = 0;
  let minutesInCurrentHourBadge = 0;

  if (!isPastDue) {
    if (isDueToday) {
        // Hours left in the due day (today)
        hoursInCurrentDayBadge = Math.max(0, differenceInHours(endOfDay(startOfDueDate), now));
        const tempNowForMins = addHours(now, hoursInCurrentDayBadge);
        minutesInCurrentHourBadge = Math.max(0, differenceInMinutes(endOfDay(startOfDueDate), tempNowForMins));
    } else { 
        // Hours left in the current day (until midnight)
        hoursInCurrentDayBadge = Math.max(0, differenceInHours(endOfDay(now), now));
        const tempNowForMins = addHours(now, hoursInCurrentDayBadge);
        minutesInCurrentHourBadge = Math.max(0, differenceInMinutes(endOfDay(now), tempNowForMins));
    }
  }

  return {
    yearsDetailed: Math.max(0, yearsDetailed),
    monthsDetailed: Math.max(0, monthsDetailed),
    weeksDetailed: Math.max(0, weeksDetailed),
    daysDetailed: Math.max(0, daysDetailed),
    hoursDetailed: Math.max(0, hoursDetailed),

    isPastDue,
    isDueToday,

    totalYears: totalYearsBadge,
    totalMonths: totalMonthsBadge,
    totalWeeks: totalWeeksBadge,
    fullDaysRemaining: fullDaysRemainingBadge,
    hoursInCurrentDay: hoursInCurrentDayBadge,
    minutesInCurrentHour: minutesInCurrentHourBadge,
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
