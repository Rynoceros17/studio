
// src/lib/color-map.ts

/**
 * Defines a mapping from user-friendly color tags to hex color codes.
 * These tags can be used in the AI prompt for specifying task colors.
 */
export const colorTagToHexMap: Record<string, string> = {
  "#col1": "#A892D6", // Primary Light Purple
  "#col2": "#FFD700", // Accent Gold
  "#col3": "#ADD8E6", // Light Blue
  "#col4": "#90EE90", // Light Green
  "#col5": "#FFB6C1", // Light Pink
};

export const availableColorTags = Object.keys(colorTagToHexMap);
