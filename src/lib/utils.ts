
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
    addWeeks, // Ensure addWeeks is imported
    addDays,
    addHours,
    isSameDay,
    endOfDay,
    differenceInCalendarDays,
    differenceInWeeks,
    intervalToDuration,
    subDays, // Import subDays
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
        if (window.innerWidth < 640) { // sm
            return limitType === 'title' ? CAL_TITLE_LIMIT_SM : CAL_DESC_LIMIT_SM;
        } else if (window.innerWidth < 1024) { // md to lg
            return limitType === 'title' ? CAL_TITLE_LIMIT_MD : CAL_DESC_LIMIT_MD;
        } else { // lg and up
            return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG;
        }
    }
    return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG; // Fallback for SSR
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
    console.warn("parseISOStrict: Invalid date string received:", dateString);
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
  const startOfDueDate = startOfDay(due); // Original start of due date for flags

  // Flags based on original due date
  const isPastDue = startOfDueDate < startOfToday;
  const isDueToday = isSameDay(startOfDueDate, startOfToday);

  // Adjusted target date for calculating remaining time values (subtract 1 day)
  const calcTargetDate = subDays(startOfDueDate, 1);

  let yearsDetailed = 0;
  let monthsDetailed = 0;
  let weeksDetailed = 0;
  let daysDetailed = 0;
  let hoursDetailed = 0;

  let totalYears = 0;
  let totalMonths = 0;
  let totalWeeks = 0;
  // No totalDays needed as fullDaysRemaining serves a similar purpose based on calcTargetDate

  let monthsInYear = 0;
  let weeksInMonth = 0;
  let daysInWeek = 0;

  let fullDaysRemaining = 0;
  let hoursComponent = 0;
  let minutesComponent = 0;


  if (calcTargetDate >= startOfToday) { // Only calculate positive detailed components if adjusted due date is not in the past
    const duration = intervalToDuration({ start: startOfToday, end: calcTargetDate });
    yearsDetailed = Math.max(0, duration.years || 0);
    monthsDetailed = Math.max(0, duration.months || 0);
    
    const totalDaysFromDuration = Math.max(0, duration.days || 0);
    weeksDetailed = Math.max(0, Math.floor(totalDaysFromDuration / 7));
    daysDetailed = Math.max(0, totalDaysFromDuration % 7);
    hoursDetailed = Math.max(0, duration.hours || 0); // Will be 0 due to startOfDay comparison
  } else {
    // If calcTargetDate is in the past, all detailed components are effectively 0
    yearsDetailed = 0;
    monthsDetailed = 0;
    weeksDetailed = 0;
    daysDetailed = 0;
    hoursDetailed = 0;
  }
  
  // Calculate total units for broader display (e.g., badge) using calcTargetDate
  totalYears = differenceInYears(calcTargetDate, startOfToday);
  totalMonths = differenceInMonths(calcTargetDate, startOfToday);
  totalWeeks = differenceInWeeks(calcTargetDate, startOfToday, { weekStartsOn: 1 }); 
  
  fullDaysRemaining = differenceInCalendarDays(calcTargetDate, startOfToday);


  // Calculate parts for "Xy Ymo left", "Xmo Yw left" etc. using calcTargetDate
  let tempRemainingStartForComponents = new Date(startOfToday);

  const effectiveTotalYears = Math.max(0, totalYears);
  let remainingDateAfterYears = addYears(tempRemainingStartForComponents, effectiveTotalYears);
  monthsInYear = differenceInMonths(calcTargetDate, remainingDateAfterYears);
  monthsInYear = Math.max(0, monthsInYear);

  let remainingDateAfterMonths = addMonths(remainingDateAfterYears, monthsInYear);
  weeksInMonth = differenceInWeeks(calcTargetDate, remainingDateAfterMonths, { weekStartsOn: 1 });
  weeksInMonth = Math.max(0, weeksInMonth);

  let remainingDateAfterWeeks = addWeeks(remainingDateAfterMonths, weeksInMonth);
  daysInWeek = differenceInCalendarDays(calcTargetDate, remainingDateAfterWeeks);
  daysInWeek = Math.max(0, daysInWeek);
  

  // Calculate hours and minutes left *in the current day* or *in the actual due day if it's today*
  // These are based on the ORIGINAL due date and current time, not the adjusted one.
  if (isDueToday) { 
      const endOfDueDate = endOfDay(due); // Use original 'due' for end of day
      hoursComponent = differenceInHours(endOfDueDate, now);
      minutesComponent = differenceInMinutes(endOfDueDate, addHours(now, Math.max(0, hoursComponent))) % 60;
  } else if (!isPastDue) { // Due in the future (original due date)
      const endOfToday = endOfDay(now);
      hoursComponent = differenceInHours(endOfToday, now); 
      minutesComponent = differenceInMinutes(endOfToday, addHours(now, Math.max(0, hoursComponent))) % 60;
  }
   hoursComponent = Math.max(0, hoursComponent);
   minutesComponent = Math.max(0, minutesComponent);


  return {
    yearsDetailed,
    monthsDetailed,
    weeksDetailed,
    daysDetailed,
    hoursDetailed, // This will be 0 for "Y:M:W:D:H" format if comparing startOfDays.
    
    isPastDue, // Based on original due date
    isDueToday, // Based on original due date

    totalYears: Math.max(0, totalYears),
    monthsInYear, // component of year
    totalMonths: Math.max(0, totalMonths),
    weeksInMonth, // component of month
    totalWeeks: Math.max(0, totalWeeks),
    daysInWeek,   // component of week
    
    fullDaysRemaining: Math.max(0, fullDaysRemaining), // Based on adjusted due date
    hoursComponent, // Actual hours left today / on due day
    minutesComponent, // Actual minutes left today / on due day
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
