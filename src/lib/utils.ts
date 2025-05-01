import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to truncate text using CSS classes approach
export const truncateText = (text: string | undefined | null, limit: number): string => {
    if (!text) return '';
    // Basic truncation logic (can be improved if needed)
    if (text.length > limit) {
        return text.substring(0, limit) + '...';
    }
    return text;
};


// Function to get max lengths based on viewport/container
// This is less critical now with CSS truncation, but can be kept for reference or specific JS logic
export const getMaxLength = (limitType: 'title' | 'desc', context: 'calendar' | 'dialog' | 'subtask' = 'calendar'): number => {
    // Calendar limits (adjust based on column width)
    const CAL_TITLE_LIMIT_SM = 40; // Mobile (e.g., 1-2 cols)
    const CAL_DESC_LIMIT_SM = 40;
    const CAL_TITLE_LIMIT_MD = 25; // Tablet (e.g., 3-4 cols)
    const CAL_DESC_LIMIT_MD = 25;
    const CAL_TITLE_LIMIT_LG = 25; // Desktop (7 cols)
    const CAL_DESC_LIMIT_LG = 17; // Desktop (7 cols)

    // Dialog limits
    const DIALOG_TITLE_LIMIT = 55;
    const DIALOG_DESC_LIMIT = 40;

    // Subtask limits
    const SUBTASK_TITLE_LIMIT = 30;

    if (context === 'dialog') {
        return limitType === 'title' ? DIALOG_TITLE_LIMIT : DIALOG_DESC_LIMIT;
    }

    if (context === 'subtask') {
        return SUBTASK_TITLE_LIMIT;
    }

    // Calendar context logic (Consider removing if CSS handles everything)
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

// Function to format duration in seconds to HH:MM:SS
export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0; // Handle negative values

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');

  // Only include hours if they are greater than 0
  return hours > 0 ? `${hoursStr}:${minutesStr}:${secondsStr}` : `${minutesStr}:${secondsStr}`;
};
