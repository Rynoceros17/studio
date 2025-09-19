
'use server';
/**
 * @fileOverview A Genkit flow to parse natural language into structured task objects.
 * Can handle multiple tasks from a single query.
 *
 * - parseNaturalLanguageTask - A function that takes a user's query and returns an array of parsed tasks.
 * - ParseNaturalLanguageTaskInput - The input type for the flow.
 * - ParseNaturalLanguageTaskOutput - The return type for the flow (an array of SingleTaskOutput).
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {format} from 'date-fns';
import { availableColorTags } from '@/lib/color-map';
import { TaskArraySchema, type TaskArrayOutput } from './task-schemas';

const ParseNaturalLanguageTaskInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty.").max(500, "Query is too long.").describe("The natural language query from the user describing one or more tasks."),
});
export type ParseNaturalLanguageTaskInput = z.infer<typeof ParseNaturalLanguageTaskInputSchema>;

// Output schema is an array of single tasks
export type ParseNaturalLanguageTaskOutput = TaskArrayOutput;


export async function parseNaturalLanguageTask(input: ParseNaturalLanguageTaskInput): Promise<ParseNaturalLanguageTaskOutput> {
  // Dynamically set current date for the prompt
  const currentDate = format(new Date(), 'yyyy-MM-dd');
  const promptData = { ...input, currentDate };
  return parseNaturalLanguageTaskFlow(promptData);
}

const parseTaskPrompt = ai.definePrompt({
  name: 'parseNaturalLanguageTaskPrompt',
  input: {schema: ParseNaturalLanguageTaskInputSchema.extend({currentDate: z.string()})},
  output: {schema: TaskArraySchema},
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
- "description": (Null) This field MUST ALWAYS be null. Do not add any text to it.
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
    outputSchema: TaskArraySchema,
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
        // Check for the literal string "null" and convert it to the null value.
        description: (aiTask.description && aiTask.description.toLowerCase() !== 'null') ? aiTask.description : null,
        startTime: aiTask.startTime || null,
        endTime: aiTask.endTime || null,
        recurring: aiTask.recurring ?? false,
        highPriority: aiTask.highPriority ?? false,
        color: aiTask.color || availableColorTags[Math.floor(Math.random() * availableColorTags.length)],
    }));
  }
);

