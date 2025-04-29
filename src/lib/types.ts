

export type Task = {
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
};

// Simple interface for file metadata (as we aren't handling uploads yet)
export interface FileMetaData {
    name: string;
    type: string;
    size: number;
    // In a real app, you might store a URL or an identifier here
}

// Goal and Subtask types
export interface Subtask {
    id: string;
    name: string;
    completed: boolean;
}

export interface Goal {
    id: string;
    name: string;
    subtasks: Subtask[];
}

