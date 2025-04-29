import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to truncate text
export const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    // Ensure maxLength is at least 3 to accommodate '...'
    if (maxLength < 3) return text.slice(0, maxLength);
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
};


// Function to get max lengths based on viewport/container
// Added 'subtask' context
export const getMaxLength = (limitType: 'title' | 'desc', context: 'calendar' | 'dialog' | 'subtask' = 'calendar'): number => {
    // Calendar limits (adjust based on column width)
    const CAL_TITLE_LIMIT_SM = 40; // Mobile (e.g., 1-2 cols)
    const CAL_DESC_LIMIT_SM = 40;
    const CAL_TITLE_LIMIT_MD = 25; // Tablet (e.g., 3-4 cols)
    const CAL_DESC_LIMIT_MD = 25;
    const CAL_TITLE_LIMIT_LG = 25; // Desktop (7 cols)
    const CAL_DESC_LIMIT_LG = 17; // Desktop (7 cols)

    // Dialog limits
    const DIALOG_TITLE_LIMIT = 55; // Adjusted as per previous request
    const DIALOG_DESC_LIMIT = 40; // Adjusted as per previous request

    // Subtask limits
    const SUBTASK_TITLE_LIMIT = 30; // New limit for subtasks

    if (context === 'dialog') {
        return limitType === 'title' ? DIALOG_TITLE_LIMIT : DIALOG_DESC_LIMIT;
    }

    if (context === 'subtask') {
        // Only title limit is relevant for subtasks currently
        return SUBTASK_TITLE_LIMIT;
    }

    // Calendar context logic
    if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) { // sm screens
            return limitType === 'title' ? CAL_TITLE_LIMIT_SM : CAL_DESC_LIMIT_SM;
        } else if (window.innerWidth < 1024) { // md screens
            return limitType === 'title' ? CAL_TITLE_LIMIT_MD : CAL_DESC_LIMIT_MD;
        } else { // lg screens and up
            return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG;
        }
    }
    // Default for SSR or if window is undefined (for calendar)
    return limitType === 'title' ? CAL_TITLE_LIMIT_LG : CAL_DESC_LIMIT_LG; // Default to desktop calendar
};
