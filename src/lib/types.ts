
export interface Task { // Changed 'type' to 'interface' for better clarity and extensibility
  id: string;
  name: string;
  description?: string;
  date: string; // Original task date (day it appears on the calendar)
  recurring?: boolean;
  details?: string;
  dueDate?: string; // Optional due date (yyyy-MM-dd format)
  // Removed: files?: FileMetaData[];
  highPriority?: boolean; // Optional: Flag for high priority tasks
  exceptions?: string[]; // Optional array of 'yyyy-MM-dd' dates to skip for recurring tasks
  color?: string; // Optional: Background color for the task card (e.g., HSL string)
};

// Removed: FileMetaData interface

// Goal and Subtask types (Ensure these are exported)
export interface Subtask {
    id: string;
    name: string;
    completed: boolean;
    subtasks?: Subtask[]; // Optional: for nested subtasks
}

export interface Goal {
    id: string;
    name: string;
    subtasks: Subtask[];
    dueDate?: string; // Optional due date for the goal
}

// Item type for the "Upcoming Deadlines" bar
export interface UpcomingItem {
  id: string;
  name: string;
  dueDate: string; // yyyy-MM-dd
  type: 'task' | 'goal';
  originalDate?: string; // For tasks, the date it's scheduled on
  description?: string; // For tasks
  highPriority?: boolean; // For tasks
  color?: string; // For tasks
  progress?: number; // For goals
}

