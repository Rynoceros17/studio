
export interface Task {
  id: string;
  name: string;
  description?: string;
  date: string; // Original task date (day it appears on the calendar)
  recurring?: boolean;
  details?: string;
  dueDate?: string; // Optional due date (yyyy-MM-dd format)
  highPriority?: boolean; // Optional: Flag for high priority tasks
  exceptions?: string[]; // Optional array of 'yyyy-MM-dd' dates to skip for recurring tasks
  color?: string; // Optional: Background color for the task card
};

// Goal and Subtask types
export interface Subtask {
    id: string;
    name: string;
    completed: boolean;
    subtasks?: Subtask[];
}

export interface Goal {
    id: string;
    name: string;
    subtasks: Subtask[];
    dueDate?: string; // Optional due date for the goal
    highPriority?: boolean; // Added for goal priority
}

// Item type for the "Upcoming Deadlines" bar
export interface UpcomingItem {
  id: string;
  name: string;
  dueDate: string; // yyyy-MM-dd
  type: 'task' | 'goal';
  originalDate?: string; // For tasks, the date it's scheduled on
  description?: string; // For tasks
  taskHighPriority?: boolean; // For tasks (renamed to avoid conflict)
  goalHighPriority?: boolean; // For goals
  color?: string; // For tasks
  progress?: number; // For goals
}

export interface TimeLeft {
  yearsDetailed: number;
  monthsDetailed: number;
  weeksDetailed: number;
  daysDetailed: number;
  hoursDetailed: number;

  totalYears: number;
  totalMonths: number;
  totalWeeks: number;
  totalDays: number; // Total calendar days difference
  fullDaysRemaining: number; // Days after today until due date
  
  monthsInYear: number; // Month part after years
  weeksInMonth: number; // Week part after months
  daysInWeek: number;   // Day part after weeks
  
  hoursComponent: number;    // Hours part for current day or due day
  minutesComponent: number;  // Minutes part for current day or due day

  isPastDue: boolean;
  isDueToday: boolean;
}
