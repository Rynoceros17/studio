
// src/lib/color-map.ts

/**
 * Defines a mapping from user-friendly color tags to HSL color values.
 * These tags can be used in the AI prompt for specifying task colors.
 * The order matches the UI options in TaskForm/EditTaskDialog.
 */
export const colorTagToHexMap: Record<string, string> = {
  "#col1": "hsl(0 0% 100%)",           // White
  "#col2": "hsl(259 67% 88%)",         // Light Purple
  "#col3": "hsl(259 67% 92%)",         // Lighter Purple
  "#col4": "hsl(50, 100%, 90%)",       // Pale Gold
  "#col5": "hsl(45, 90%, 85%)",        // Soft Gold
  "#col6": "hsl(55, 80%, 80%)",        // Light Goldenrod
};

export const availableColorTags = Object.keys(colorTagToHexMap);

export const colorTagDescriptions = [
    "White",
    "Light Purple",
    "Lighter Purple",
    "Pale Gold",
    "Soft Gold",
    "Light Goldenrod"
];
