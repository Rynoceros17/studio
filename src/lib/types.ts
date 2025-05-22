
export interface Task { // Changed 'type' to 'interface' for better clarity and extensibility
  id: string;
  name: string;
  description?: string;
  date: string; // Original task date (day it appears on the calendar)
  recurring?: boolean;
  details?: string;
  dueDate?: string; // Optional due date (yyyy-MM-dd format)
  files?: FileMetaData[]; // Optional array for file metadata
  highPriority?: boolean; // Optional: Flag for high priority tasks
  exceptions?: string[]; // Optional array of 'yyyy-MM-dd' dates to skip for recurring tasks
  color?: string; // Optional: Background color for the task card (e.g., HSL string)
};

// Simple interface for file metadata (as we aren't handling uploads yet)
export interface FileMetaData {
    name: string;
    type: string;
    size: number;
    // In a real app, you might store a URL or an identifier here
}

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
