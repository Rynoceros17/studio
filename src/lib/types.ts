
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
  color?: string; // Optional: Stores HSL string for task background
};

export interface Goal {
    id: string;
    name: string;
    subtasks: Subtask[];
    dueDate?: string;
    highPriority?: boolean;
}

export interface Subtask {
    id: string;
    name: string;
    completed: boolean;
    subtasks?: Subtask[];
}

export interface UpcomingItem {
  id: string;
  name: string;
  dueDate: string;
  type: 'task' | 'goal';
  originalDate?: string;
  description?: string;
  taskHighPriority?: boolean;
  goalHighPriority?: boolean;
  color?: string;
  progress?: number;
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
  fullDaysRemaining: number;
  
  monthsInYear: number;
  weeksInMonth: number;
  daysInWeek: number;
  
  hoursComponent: number;
  minutesComponent: number;

  isPastDue: boolean;
  isDueToday: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}
