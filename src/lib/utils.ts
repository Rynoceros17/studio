
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
    addHours, // Added addHours
    isSameDay,
    endOfDay,
    differenceInCalendarDays,
    differenceInWeeks,
    intervalToDuration,
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

    // This check needs to be client-side only to avoid hydration errors if window is accessed during SSR
    // For default/SSR, return a reasonable value.
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
  const date = parseISO(datePart + 'T00:00:00'); // Ensure it's parsed as local time at midnight
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
  const startOfDueDate = startOfDay(due); // Due date at midnight local time

  const isPastDue = startOfDueDate < startOfToday;
  const isDueToday = isSameDay(startOfDueDate, startOfToday);

  let yearsDetailed = 0;
  let monthsDetailed = 0;
  let weeksDetailed = 0;
  let daysDetailed = 0;
  let hoursDetailed = 0;

  let totalYears = 0;
  let totalMonths = 0;
  let totalWeeks = 0;
  let totalDays = 0;

  let monthsInYear = 0;
  let weeksInMonth = 0;
  let daysInWeek = 0;

  let fullDaysRemaining = 0;
  let hoursInCurrentDay = 0;
  let minutesInCurrentHour = 0;


  if (!isPastDue) {
    let tempRemainingStart = new Date(startOfToday); // Use start of today for calculating future components

    yearsDetailed = differenceInYears(startOfDueDate, tempRemainingStart);
    tempRemainingStart = addYears(tempRemainingStart, yearsDetailed);

    monthsDetailed = differenceInMonths(startOfDueDate, tempRemainingStart);
    tempRemainingStart = addMonths(tempRemainingStart, monthsDetailed);
    
    // For weeks and days, we look at the remaining calendar days after full years and months
    const daysToProcessForWeeksAndDays = differenceInCalendarDays(startOfDueDate, tempRemainingStart);
    weeksDetailed = Math.floor(daysToProcessForWeeksAndDays / 7);
    daysDetailed = daysToProcessForWeeksAndDays % 7;
    
    // hoursDetailed for the "Y:M:W:D:H" format will be 0 because we are comparing startOfDueDate with startOfToday components
    hoursDetailed = 0; 
  }
  
  // Calculate total units for broader display (e.g., badge)
  totalYears = differenceInYears(startOfDueDate, startOfToday);
  totalMonths = differenceInMonths(startOfDueDate, startOfToday);
  totalWeeks = differenceInWeeks(startOfDueDate, startOfToday, { weekStartsOn: 1 }); // Assuming week starts on Monday
  totalDays = differenceInCalendarDays(startOfDueDate, startOfToday); // Total calendar days difference

  // Calculate parts for "Xy Ymo left", "Xmo Yw left" etc.
  let remainingDateAfterYears = addYears(startOfToday, totalYears);
  monthsInYear = differenceInMonths(startOfDueDate, remainingDateAfterYears);

  let remainingDateAfterMonths = addMonths(remainingDateAfterYears, monthsInYear);
  weeksInMonth = differenceInWeeks(startOfDueDate, remainingDateAfterMonths, { weekStartsOn: 1 });

  let remainingDateAfterWeeks = addWeeks(remainingDateAfterMonths, weeksInMonth);
  daysInWeek = differenceInCalendarDays(startOfDueDate, remainingDateAfterWeeks);


  if (!isPastDue) {
      fullDaysRemaining = differenceInCalendarDays(startOfDueDate, startOfToday); 

      if (isDueToday) { // If due today, hours and minutes are from now until end of due day
          const endOfDueDay = endOfDay(startOfDueDate); // End of the due date
          hoursInCurrentDay = differenceInHours(endOfDueDay, now);
          minutesInCurrentHour = differenceInMinutes(endOfDueDay, addHours(now, hoursInCurrentDay)) % 60;
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
    hoursDetailed: Math.max(0, hoursDetailed), // This will be 0 for Y:M:W:D:H format
    
    isPastDue,
    isDueToday,

    totalYears: Math.max(0, totalYears),
    monthsInYear: Math.max(0, monthsInYear),
    totalMonths: Math.max(0, totalMonths),
    weeksInMonth: Math.max(0, weeksInMonth),
    totalWeeks: Math.max(0, totalWeeks),
    daysInWeek: Math.max(0, daysInWeek),
    
    fullDaysRemaining: Math.max(0, fullDaysRemaining), 
    hoursComponent: Math.max(0, hoursInCurrentDay), 
    minutesComponent: Math.max(0, minutesInCurrentHour),
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

