
'use server';
/**
 * @fileOverview A Genkit flow to parse natural language into structured task objects.
 * Can handle multiple tasks from a single query.
 *
 * - parseNaturalLanguageTask - A function that takes a user's query and returns an array of parsed tasks.
 * - ParseNaturalLanguageTaskInput - The input type for the flow.
 * - SingleTaskOutput - The type for a single parsed task object.
 * - ParseNaturalLanguageTaskOutput - The return type for the flow (an array of SingleTaskOutput).
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {format} from 'date-fns';
import { availableColorTags, colorTagDescriptions } from '@/lib/color-map'; // Import available color tags

const ParseNaturalLanguageTaskInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty.").max(500, "Query is too long.").describe("The natural language query from the user describing one or more tasks."),
});
export type ParseNaturalLanguageTaskInput = z.infer<typeof ParseNaturalLanguageTaskInputSchema>;

// Schema for a single task
const SingleTaskSchema = z.object({
  name: z.string().describe("A concise name for the task."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.").describe("The date for the task in YYYY-MM-DD format. When 'today' is mentioned, this MUST be the value of `currentDate`. Infer from other terms like 'tomorrow', 'next Monday', or specific dates."),
  description: z.string().nullable().describe("Include additional details ONLY if explicitly provided beyond the name and date/time. **This field MUST NOT contain any time information.** Time details must go in the startTime and endTime fields. If no extra details are given, this field MUST be an empty string or null."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().describe("The start time in 24-hour HH:MM format. Extract from phrases like 'at 3pm' or 'from 2-4pm'. If a duration is given (e.g., 'for 2 hours'), calculate a start time. MUST be null if absolutely no time is specified."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().describe("The end time in 24-hour HH:MM format. If only a start time is given (e.g., 'at 3pm'), infer an end time 1 hour later. If a duration is given (e.g., 'from 2pm for 2 hours'), calculate the end time. MUST be null if absolutely no time is specified."),
  recurring: z.boolean().describe("Set to `true` ONLY for single-day recurrences like 'every Tuesday'. For date ranges like 'every day this week', expand into individual tasks and set this to `false`. Otherwise, this MUST be `false`. This field MUST always be present."),
  highPriority: z.boolean().describe("Set to `true` if the user's input for this task explicitly uses words like 'important', 'priority', or 'urgent'. Otherwise, this MUST be `false`. This field MUST always be present."),
  color: z.string().regex(/^#col[1-6]$/).nullable().describe(`If the user's input for this task explicitly specifies a color tag from the list: ${availableColorTags.join(', ')} (these correspond to: ${colorTagDescriptions.join('; ')}), include that exact tag here (e.g., '#col1'). Otherwise, this field MUST be null. This field MUST always be present.`)
});
export type SingleTaskOutput = z.infer<typeof SingleTaskSchema>;

// Output schema is an array of single tasks
const ParseNaturalLanguageTaskOutputSchema = z.array(SingleTaskSchema);
export type ParseNaturalLanguageTaskOutput = z.infer<typeof ParseNaturalLanguageTaskOutputSchema>;


export async function parseNaturalLanguageTask(input: ParseNaturalLanguageTaskInput): Promise<ParseNaturalLanguageTaskOutput> {
  // Dynamically set current date for the prompt
  const currentDate = format(new Date(), 'yyyy-MM-dd');
  const promptData = { ...input, currentDate };
  return parseNaturalLanguageTaskFlow(promptData);
}

const parseTaskPrompt = ai.definePrompt({
  name: 'parseNaturalLanguageTaskPrompt',
  input: {schema: ParseNaturalLanguageTaskInputSchema.extend({currentDate: z.string()})},
  output: {schema: ParseNaturalLanguageTaskOutputSchema},
  prompt: `You are an expert personal assistant specializing in calendar management. 
Your task is to interpret a user's natural language request and convert it into one or more structured JSON objects for calendar events.

**Context:**
- The current date is {{{currentDate}}}. Use this to resolve relative dates like 'today', 'tomorrow', and 'next week'.

**Instructions:**
1.  **Analyze the Query:** Carefully read the user's input to identify all distinct tasks.
2.  **Extract Details:** For each task, determine the name, date, start time, end time, and other attributes based on the user's language.
3.  **Handle Ranges:** If a request spans multiple days (e.g., "meeting every day this week"), you must generate a separate, non-recurring task object for each individual day.
4.  **Infer and Default:**
    - If only a start time is given, assume a 1-hour duration for the end time.
    - If no specific time is mentioned, startTime and endTime should be null.
    - Only mark a task as recurring if it repeats on a specific day of the week indefinitely (e.g., "every Tuesday").
5.  **Output Format:** Your response MUST be a valid JSON array of task objects. Adhere strictly to the output schema. Do not include any text, explanations, or markdown formatting outside of the JSON array. If you cannot parse any tasks from the query, return an empty array \`[]\`.

**Output Schema Fields:**
- "name": (String) A concise name for the task.
- "date": (String) The date in "YYYY-MM-DD" format.
- "description": (String or Null) Additional details, but no time information.
- "startTime": (String 'HH:MM' or Null) 24-hour start time.
- "endTime": (String 'HH:MM' or Null) 24-hour end time.
- "recurring": (Boolean) True only for weekly repeats on a specific day.
- "highPriority": (Boolean) True if words like 'important' or 'urgent' are used.
- "color": (String tag like '#colX' or Null) If a color tag like '#col1' through '#col6' is mentioned.

**Example 1:**
User Input: "Important: Remind me to call John tomorrow from 3pm to 4pm with #col1"
Output (where tomorrow's date is calculated from \`{{{currentDate}}}\`):
[
  {
    "name": "Call John",
    "date": "YYYY-MM-DD",
    "description": null,
    "startTime": "15:00",
    "endTime": "16:00",
    "recurring": false,
    "highPriority": true,
    "color": "#col1"
  }
]

**Example 2:**
User Input: "Study every day this week from 4pm to 6pm"
Output (assuming \`currentDate\` is within a week, expand to all 7 days of that week with the correct dates, starting from Monday):
[
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null },
  { "name": "Study", "date": "YYYY-MM-DD", "description": null, "startTime": "16:00", "endTime": "18:00", "recurring": false, "highPriority": false, "color": null }
]

**User's Request to Parse:**
{{{query}}}
`,
});

const parseNaturalLanguageTaskFlow = ai.defineFlow(
  {
    name: 'parseNaturalLanguageTaskFlow',
    inputSchema: ParseNaturalLanguageTaskInputSchema.extend({currentDate: z.string()}),
    outputSchema: ParseNaturalLanguageTaskOutputSchema,
  },
  async (promptData) => {
    const {output} = await parseTaskPrompt(promptData);
    if (!output) {
      console.warn("AI failed to parse tasks or returned undefined output. Returning empty array.");
      return [];
    }
    // Filter for essential fields and provide safe defaults for all others to prevent DB errors.
    return output
      .filter(aiTask => !!aiTask.name && !!aiTask.date && /^\d{4}-\d{2}-\d{2}$/.test(aiTask.date))
      .map(aiTask => ({
        name: aiTask.name, // Existence is guaranteed by filter
        date: aiTask.date, // Existence and format are guaranteed by filter
        description: aiTask.description || null, // Default to null
        startTime: aiTask.startTime || null,
        endTime: aiTask.endTime || null,
        recurring: aiTask.recurring ?? false,
        highPriority: aiTask.highPriority ?? false,
        color: aiTask.color || null,
    }));
  }
);
