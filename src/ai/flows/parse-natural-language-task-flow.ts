
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
  query: z.string().min(1, "Query cannot be empty.").max(100, "Query is too long.").describe("The natural language query from the user describing one or more tasks."),
});
export type ParseNaturalLanguageTaskInput = z.infer<typeof ParseNaturalLanguageTaskInputSchema>;

// Schema for a single task
const SingleTaskSchema = z.object({
  name: z.string().describe("A concise name for the task."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.").describe("The date for the task in YYYY-MM-DD format. When 'today' is mentioned, this MUST be the value of `currentDate`. Infer from other terms like 'tomorrow', 'next Monday', or specific dates."),
  description: z.string().optional().nullable().describe("Include additional details ONLY if explicitly provided beyond the name and date/time. **This field MUST NOT contain any time information.** Time details must go in the startTime and endTime fields. If no extra details are given, this field should be an empty string or null."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().describe("The start time in 24-hour HH:MM format. Extract from phrases like 'at 3pm' or 'from 2-4pm'. If a duration is given (e.g., 'for 2 hours'), calculate a start time. MUST be null if absolutely no time is specified."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().describe("The end time in 24-hour HH:MM format. If only a start time is given (e.g., 'at 3pm'), infer an end time 1 hour later. If a duration is given (e.g., 'from 2pm for 2 hours'), calculate the end time. MUST be null if absolutely no time is specified."),
  recurring: z.boolean().describe("Set to `true` if the user's input for this task explicitly uses words like 'every week' or 'weekly'. Otherwise, this MUST be `false`. This field MUST always be present."),
  highPriority: z.boolean().describe("Set to `true` if the user's input for this task explicitly uses words like 'important', 'priority', or 'urgent'. Otherwise, this MUST be `false`. This field MUST always be present."),
  color: z.string().regex(/^#col[1-6]$/).optional().nullable().describe(`If the user's input for this task explicitly specifies a color tag from the list: ${availableColorTags.join(', ')} (these correspond to: ${colorTagDescriptions.join('; ')}), include that exact tag here (e.g., '#col1'). Otherwise, this field MUST be null. This field MUST always be present.`)
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
  prompt: `You are an intelligent assistant that helps parse user requests to create calendar tasks from a single query which might contain multiple distinct tasks.
The current date is {{{currentDate}}}. This is the ONLY source for what "today" means.
Convert the user's query into an array of JSON objects. Each object in the array MUST represent a distinct task and MUST have the following fields: "name", "date", "description", "startTime", "endTime", "recurring", "highPriority", and "color".

**CRITICAL RULE: When the user's query contains the word 'today', you MUST use the value of \`{{{currentDate}}}\` for the 'date' field in the output JSON. Do not guess or use any other date.**
For 'tomorrow', it must be the day after \`{{{currentDate}}}\`.
For 'yesterday', it must be the day before \`{{{currentDate}}}\`.

- "name": (String) A concise name for the task.
- "date": (String) The date for the task in "YYYY-MM-DD" format. If the user says 'today', this MUST be exactly \`{{{currentDate}}}\`. Infer this from other terms like "tomorrow", "next Monday", or specific dates relative to \`{{{currentDate}}}\`.
- "description": (String or Null) Include additional details ONLY if explicitly provided beyond the name and date/time. **This field MUST NOT contain any time information.** Time details must go in the startTime and endTime fields. If no extra details are given, this field should be an empty string or null.
- "startTime": (String 'HH:MM' or Null) The start time in 24-hour HH:MM format. Extract from phrases like 'at 3pm' or 'from 2-4pm'. If a duration is given (e.g., 'for 2 hours'), calculate a start time. MUST be null if absolutely no time is specified.
- "endTime": (String 'HH:MM' or Null) The end time in 24-hour HH:MM format. If only a start time is given (e.g., 'at 3pm'), infer an end time 1 hour later. If a duration is given (e.g., 'from 2pm for 2 hours'), calculate the end time. MUST be null if absolutely no time is specified.
- "recurring": (Boolean) Set to \`true\` if the user's input for this task explicitly uses words like 'every week' or 'weekly'. Otherwise, this MUST be \`false\`.
- "highPriority": (Boolean) Set to \`true\` if the user's input for this task explicitly uses words like 'important', 'priority', or 'urgent'. Otherwise, this MUST be \`false\`.
- "color": (String tag like '#colX' or Null) If the user's input for this task explicitly specifies a color tag from the list: ${availableColorTags.join(', ')} (these correspond to: ${colorTagDescriptions.join('; ')}), include that exact tag here (e.g., '#col1'). Otherwise, this field MUST be null.

If the query contains multiple tasks, create a separate JSON object for each task in the array.
If the query contains only one task, return an array with a single JSON object.
If no tasks can be parsed, return an empty array.

Strictly adhere to the JSON output format specified. Do not add any extra explanations or text outside the JSON array.

Example 1:
User Input: "Important: Remind me to call John tomorrow from 3pm to 4pm with #col1"
Output (where tomorrow's date is calculated from \`{{{currentDate}}}\`):
[
  {
    "name": "Call John",
    "date": "YYYY-MM-DD",
    "description": "",
    "startTime": "15:00",
    "endTime": "16:00",
    "recurring": false,
    "highPriority": true,
    "color": "#col1"
  }
]

Example 2:
User Input: "Dentist appointment next Tuesday at 11am and then Weekly grocery shopping on Saturday at 10am use #col2"
Output (where dates are calculated from \`{{{currentDate}}}\`):
[
  {
    "name": "Dentist appointment",
    "date": "YYYY-MM-DD",
    "description": "",
    "startTime": "11:00",
    "endTime": "12:00",
    "recurring": false,
    "highPriority": false,
    "color": null
  },
  {
    "name": "Grocery shopping",
    "date": "YYYY-MM-DD",
    "description": "",
    "startTime": "10:00",
    "endTime": "11:00",
    "recurring": true,
    "highPriority": false,
    "color": "#col2"
  }
]

Example 3 (Task for "today"):
User Input: "Schedule a team sync today from 2pm to 2:30pm #col4"
Output:
[
  {
    "name": "Team sync",
    "date": "{{{currentDate}}}",
    "description": "",
    "startTime": "14:00",
    "endTime": "14:30",
    "recurring": false,
    "highPriority": false,
    "color": "#col4"
  }
]


User Input: {{{query}}}
Ensure your entire response is ONLY the JSON array. EACH task object in the array MUST contain all fields: "name", "date", "description", "startTime", "endTime", "recurring", "highPriority", and "color".
Remember: if 'today' is mentioned, the date MUST be '{{{currentDate}}}'.
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
