
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
    addWeeks, // Ensured addWeeks is imported
    addDays,
    addHours,
    isSameDay,
    endOfDay,
    differenceInCalendarDays,
    differenceInWeeks,
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
  // Ensure we only use the date part, append T00:00:00 to parse as local time midnight
  const datePart = dateString.split('T')[0];
  const date = parseISO(datePart + 'T00:00:00');
  if (!isValid(date)) {
    // console.error("Invalid date string for parseISOStrict:", dateString); // Optional: for debugging
    return null;
  }
  return date;
};


export function calculateTimeLeft(dueDateStr: string | undefined): TimeLeft | null {
  if (!dueDateStr) return null;

  const due = parseISOStrict(dueDateStr); // Use the consistent local time parsing
  if (!due || !isValid(due)) {
    // console.warn("calculateTimeLeft: Invalid due date string provided:", dueDateStr);
    return null;
  }

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfDueDate = startOfDay(due); // Ensure comparison is start-of-day to start-of-day

  const isPastDue = startOfDueDate < startOfToday;
  const isDueToday = isSameDay(startOfDueDate, startOfToday);

  let yearsDetailed = 0, monthsDetailed = 0, weeksDetailed = 0, daysDetailed = 0, hoursDetailed = 0;
  let totalYears = 0, totalMonths = 0, totalWeeks = 0, totalDays = 0;
  let monthsInYear = 0, weeksInMonth = 0, daysInWeek = 0;
  let fullDaysRemaining = 0, hoursComponent = 0, minutesComponent = 0;


  if (!isPastDue) {
    let currentDateForDetailedCalc = new Date(now);
    
    yearsDetailed = differenceInYears(startOfDueDate, currentDateForDetailedCalc);
    currentDateForDetailedCalc = addYears(currentDateForDetailedCalc, yearsDetailed);

    monthsDetailed = differenceInMonths(startOfDueDate, currentDateForDetailedCalc);
    currentDateForDetailedCalc = addMonths(currentDateForDetailedCalc, monthsDetailed);
    
    weeksDetailed = differenceInWeeks(startOfDueDate, currentDateForDetailedCalc);
    currentDateForDetailedCalc = addWeeks(currentDateForDetailedCalc, weeksDetailed);
    
    daysDetailed = differenceInCalendarDays(startOfDueDate, currentDateForDetailedCalc);
    currentDateForDetailedCalc = addDays(currentDateForDetailedCalc, daysDetailed);

    hoursDetailed = differenceInHours(startOfDueDate, currentDateForDetailedCalc);
    if (hoursDetailed < 0) hoursDetailed = 0; // Ensure it's not negative if on the same day but later

    // For badge logic
    totalYears = differenceInYears(startOfDueDate, startOfToday);
    monthsInYear = differenceInMonths(startOfDueDate, addYears(startOfToday, totalYears));

    totalMonths = differenceInMonths(startOfDueDate, startOfToday);
    weeksInMonth = differenceInWeeks(startOfDueDate, addMonths(startOfToday, totalMonths));
    
    totalWeeks = differenceInWeeks(startOfDueDate, startOfToday, { weekStartsOn: 1 });
    daysInWeek = differenceInCalendarDays(startOfDueDate, addWeeks(startOfToday, totalWeeks, { weekStartsOn: 1 }));


    fullDaysRemaining = differenceInCalendarDays(startOfDueDate, startOfToday);
    
    if (isDueToday) {
        hoursComponent = differenceInHours(endOfDay(now), now);
        minutesComponent = differenceInMinutes(endOfDay(now), addHours(now, hoursComponent));
    } else if (fullDaysRemaining > 0) { // Due in the future (not today)
        hoursComponent = differenceInHours(endOfDay(now), now); // Hours left in *today*
        minutesComponent = differenceInMinutes(endOfDay(now), addHours(now, hoursComponent));
    } else { // Due tomorrow, but less than 24 hours left in today
        hoursComponent = differenceInHours(startOfDueDate, now);
        minutesComponent = differenceInMinutes(startOfDueDate, addHours(now, hoursComponent)) % 60;
    }
     // Ensure non-negative for components
     hoursComponent = Math.max(0, hoursComponent);
     minutesComponent = Math.max(0, minutesComponent);


  }
   // Ensure totalDays is calculated for general use
   totalDays = differenceInCalendarDays(startOfDueDate, startOfToday);


  return {
    yearsDetailed: Math.max(0, yearsDetailed),
    monthsDetailed: Math.max(0, monthsDetailed),
    weeksDetailed: Math.max(0, weeksDetailed),
    daysDetailed: Math.max(0, daysDetailed),
    hoursDetailed: Math.max(0, hoursDetailed),
    
    isPastDue,
    isDueToday,

    totalYears: Math.max(0, totalYears),
    monthsInYear: Math.max(0, monthsInYear),
    totalMonths: Math.max(0, totalMonths),
    weeksInMonth: Math.max(0, weeksInMonth),
    totalWeeks: Math.max(0, totalWeeks),
    daysInWeek: Math.max(0, daysInWeek),
    
    fullDaysRemaining: Math.max(0, fullDaysRemaining), // Number of full days after today
    hoursComponent: Math.max(0, hoursComponent),     // Hours part of the countdown (either in current day or due day)
    minutesComponent: Math.max(0, minutesComponent), // Minutes part
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
