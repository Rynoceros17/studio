

export interface Task {
  id: string;
  name: string;
  description?: string | null;
  date: string; // Original task date (day it appears on the calendar)
  startTime?: string; // Optional: 'HH:mm' format
  endTime?: string;   // Optional: 'HH:mm' format
  recurring?: boolean;
  details?: string | null;
  dueDate?: string | null; // Optional due date (yyyy-MM-dd format)
  highPriority?: boolean; // Optional: Flag for high priority tasks
  exceptions?: string[]; // Optional array of 'yyyy-MM-dd' dates to skip for recurring tasks
  color?: string | null; // Optional: Stores HSL string for task background
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

export interface WeekPreset {
  id: string;
  name: string;
  tasks: Array<Omit<Task, 'id' | 'date'> & { dayOfWeek: number }>; // 0=Mon, 6=Sun
}

// Type alias from Zod schema in parse-natural-language-task-flow.ts
// This represents a task that has been parsed by the AI but not yet saved.
export type SingleTaskOutput = {
    name: string;
    date: string;
    description: string | null | undefined;
    startTime: string | null | undefined;
    endTime: string | null | undefined;
    recurring: boolean;
    highPriority: boolean;
    color: string | null | undefined;
};
