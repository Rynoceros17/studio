
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
    isSameDay,
    endOfDay,
    differenceInCalendarDays,
    differenceInWeeks,
    intervalToDuration, // Keep for general total calculations if needed elsewhere
} from 'date-fns';
import type { Goal, Subtask, TimeLeft } from "./types";


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

export const parseISOStrict = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  const datePart = dateString.split('T')[0];
  const date = parseISO(datePart + 'T00:00:00');
  if (!isValid(date)) {
    return null;
  }
  return date;
};


export function calculateTimeLeft(dueDateStr: string | undefined): TimeLeft | null {
  if (!dueDateStr) return null;

  const due = parseISOStrict(dueDateStr);
  if (!due || !isValid(due)) {
    console.warn("calculateTimeLeft: Invalid due date string provided:", dueDateStr);
    return null;
  }

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfDueDate = startOfDay(due);

  const isPastDue = startOfDueDate < startOfToday;
  const isDueToday = isSameDay(startOfDueDate, startOfToday);

  let yearsDetailed = 0;
  let monthsDetailed = 0;
  let weeksDetailed = 0;
  let daysDetailed = 0;
  let hoursDetailed = 0; // This will be 0 if comparing startOfDueDate to startOfToday for YMDW breakdown

  if (!isPastDue) {
    let currentDateForCalc = new Date(startOfToday); // Use startOfToday for hierarchical breakdown

    yearsDetailed = differenceInYears(startOfDueDate, currentDateForCalc);
    currentDateForCalc = addYears(currentDateForCalc, yearsDetailed);

    monthsDetailed = differenceInMonths(startOfDueDate, currentDateForCalc);
    currentDateForCalc = addMonths(currentDateForCalc, monthsDetailed);

    weeksDetailed = differenceInWeeks(startOfDueDate, currentDateForCalc, { weekStartsOn: 1 });
    currentDateForCalc = addWeeks(currentDateForCalc, weeksDetailed);
    
    daysDetailed = differenceInCalendarDays(startOfDueDate, currentDateForCalc);
    // hoursDetailed will be 0 because we are comparing startOfDueDate with currentDateForCalc (which is also at start of a day)
    // If we wanted hours relative to 'now' for the last day, it's a different calculation.
  }
  
  // For badge and other general displays:
  const totalYears = differenceInYears(startOfDueDate, startOfToday);
  const totalMonths = differenceInMonths(startOfDueDate, startOfToday);
  const totalWeeks = differenceInWeeks(startOfDueDate, startOfToday, { weekStartsOn: 1 });
  const totalDays = differenceInCalendarDays(startOfDueDate, startOfToday);

  let fullDaysRemaining = 0;
  let hoursInCurrentDay = 0;
  let minutesInCurrentHour = 0;

  if (!isPastDue) {
      fullDaysRemaining = differenceInCalendarDays(startOfDueDate, startOfToday); // Total calendar days until due date

      if (isDueToday) {
          const endOfToday = endOfDay(now);
          hoursInCurrentDay = differenceInHours(endOfToday, now);
          minutesInCurrentHour = differenceInMinutes(endOfToday, addHours(now, hoursInCurrentDay)) % 60;
      } else if (fullDaysRemaining > 0) { // Due in the future (not today)
          const endOfToday = endOfDay(now);
          hoursInCurrentDay = differenceInHours(endOfToday, now); // Hours left in *today*
          minutesInCurrentHour = differenceInMinutes(endOfToday, addHours(now, hoursInCurrentDay)) % 60;
      }
       hoursInCurrentDay = Math.max(0, hoursInCurrentDay);
       minutesInCurrentHour = Math.max(0, minutesInCurrentHour);
  }


  return {
    yearsDetailed: Math.max(0, yearsDetailed),
    monthsDetailed: Math.max(0, monthsDetailed),
    weeksDetailed: Math.max(0, weeksDetailed),
    daysDetailed: Math.max(0, daysDetailed),
    hoursDetailed: Math.max(0, hoursDetailed), // This is the hour component of the day-boundary diff
    
    isPastDue,
    isDueToday,

    totalYears: Math.max(0, totalYears),
    monthsInYear: monthsDetailed, // after full years
    totalMonths: Math.max(0, totalMonths),
    weeksInMonth: weeksDetailed, // after full months
    totalWeeks: Math.max(0, totalWeeks),
    daysInWeek: daysDetailed, // after full weeks
    
    fullDaysRemaining: Math.max(0, fullDaysRemaining), 
    hoursComponent: Math.max(0, hoursInCurrentDay), // Renamed for clarity for badge
    minutesComponent: Math.max(0, minutesInCurrentHour), // Renamed for clarity for badge
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
