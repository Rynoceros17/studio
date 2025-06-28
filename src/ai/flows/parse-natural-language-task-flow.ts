
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
  description: z.string().optional().nullable().describe("Only include additional details if explicitly provided beyond the name and date/time. This field should NOT contain time information. Otherwise, this field can be an empty string or null."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().describe("The start time for the task in 24-hour HH:MM format. MUST be null if no time is specified. If a duration is given (e.g., 'for 2 hours'), calculate it."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().describe("The end time for the task in 24-hour HH:MM format. If only a start time is given (e.g., 'at 3pm'), infer an end time 1 hour later. MUST be null if no time is specified."),
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
The current date is {{{currentDate}}}.
Convert the user's query into an array of JSON objects. Each object in the array MUST represent a distinct task and MUST have the following fields: "name", "date", "description", "startTime", "endTime", "recurring", "highPriority", and "color".

**Crucially, when the user says 'today', the 'date' field in the output JSON MUST be exactly the value of \`{{{currentDate}}}\`.**
For 'tomorrow', it should be the day after \`{{{currentDate}}}\`.
For 'yesterday', it should be the day before \`{{{currentDate}}}\`.

- "name": (String) A concise name for the task. This should be the main action or event.
- "date": (String) The date for the task in "YYYY-MM-DD" format. If the user says 'today', this MUST be \`{{{currentDate}}}\`. Infer this from other terms like "tomorrow", "next Monday", or specific dates.
- "description": (String or Null) Only include additional details if explicitly provided in the request beyond the task name, date, and time. This field should NOT contain time information. If no extra details, this field should be an empty string or null.
- "startTime": (String 'HH:MM' or Null) The start time for the task in 24-hour HH:MM format. MUST be null if no time is specified.
- "endTime": (String 'HH:MM' or Null) The end time for the task in 24-hour HH:MM format. If a start time is given without an end time or duration (e.g., 'at 3pm'), infer an end time 1 hour later. If a duration is provided (e.g., 'from 2pm for 2 hours'), calculate the end time. MUST be null if no time is specified.
- "recurring": (Boolean) Set to \`true\` if the user's input for this task explicitly uses words like 'every week' or 'weekly'. Otherwise, this MUST be \`false\`. This field MUST always be present.
- "highPriority": (Boolean) Set to \`true\` if the user's input for this task explicitly uses words like 'important', 'priority', or 'urgent'. Otherwise, this MUST be \`false\`. This field MUST always be present.
- "color": (String tag like '#colX' or Null) If the user's input for this task explicitly specifies a color tag from the list: ${availableColorTags.join(', ')} (these correspond to: ${colorTagDescriptions.join('; ')}), include that exact tag here (e.g., '#col1', '#col2', '#col3', '#col4', '#col5', '#col6'). Otherwise, this field MUST be null. This field MUST always be present.

If the query contains multiple tasks, create a separate JSON object for each task in the array.
If the query contains only one task, return an array with a single JSON object.
If no tasks can be parsed, return an empty array.

Strictly adhere to the JSON output format specified. Do not add any extra explanations or text outside the JSON array.

Example 1 (Single Task with color tag and priority):
User Input: "Important: Remind me to call John tomorrow from 3pm to 4pm with #col1"
Output (assuming today is 2023-10-26, so tomorrow is 2023-10-27):
[
  {
    "name": "Call John",
    "date": "2023-10-27",
    "description": "",
    "startTime": "15:00",
    "endTime": "16:00",
    "recurring": false,
    "highPriority": true,
    "color": "#col1"
  }
]

Example 2 (Multiple Tasks, one recurring, one with priority and color tag):
User Input: "Dentist appointment next Tuesday at 11am and then Urgent: Weekly grocery shopping on Saturday at 10am use #col2"
Output (assuming today is 2023-10-26, so next Tuesday is 2023-10-31, Saturday is 2023-10-28):
[
  {
    "name": "Dentist appointment",
    "date": "2023-10-31",
    "description": "",
    "startTime": "11:00",
    "endTime": "12:00",
    "recurring": false,
    "highPriority": false,
    "color": null
  },
  {
    "name": "Grocery shopping",
    "date": "2023-10-28",
    "description": "",
    "startTime": "10:00",
    "endTime": "11:00",
    "recurring": true,
    "highPriority": true,
    "color": "#col2"
  }
]

Example 3 (Single Task, No Time, Minimal Description, no priority/color):
User Input: "Submit report by November 5th"
Output (assuming today is 2023-10-26, so November 5th is 2023-11-05):
[
  {
    "name": "Submit report",
    "date": "2023-11-05",
    "description": "",
    "startTime": null,
    "endTime": null,
    "recurring": false,
    "highPriority": false,
    "color": null
  }
]

Example 4 (Single task with only priority):
User Input: "urgent meeting with boss tomorrow"
Output (assuming today is 2023-10-26, so tomorrow is 2023-10-27):
[
  {
    "name": "meeting with boss",
    "date": "2023-10-27",
    "description": "",
    "startTime": null,
    "endTime": null,
    "recurring": false,
    "highPriority": true,
    "color": null
  }
]

Example 5 (Single task with only color):
User Input: "book club meeting next monday #col3"
Output (assuming today is 2023-10-26, next Monday is 2023-10-30):
[
  {
    "name": "book club meeting",
    "date": "2023-10-30",
    "description": "",
    "startTime": null,
    "endTime": null,
    "recurring": false,
    "highPriority": false,
    "color": "#col3"
  }
]

Example 6 (Single task with weekly recurrence):
User Input: "Yoga class every Wednesday from 6pm to 7:30pm"
Output (assuming today is 2023-10-26, so the *next* Wednesday is 2023-11-01. If today *was* Wednesday, use today's date):
[
  {
    "name": "Yoga class",
    "date": "2023-11-01",
    "description": "",
    "startTime": "18:00",
    "endTime": "19:30",
    "recurring": true,
    "highPriority": false,
    "color": null
  }
]

Example 7 (Task for "today"):
User Input: "Schedule a team sync today from 2pm to 2:30pm #col4"
Output (assuming today is {{{currentDate}}} e.g., 2023-10-26):
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
    // Ensure each task in the array has the necessary fields, providing defaults for optional ones if AI still misses them.
    return output.map(aiTask => ({
        name: aiTask.name || "Unnamed Task",
        date: aiTask.date, // This is required by schema, should always be there
        description: aiTask.description || "", // Default to empty string if null/undefined
        startTime: aiTask.startTime || null,
        endTime: aiTask.endTime || null,
        recurring: aiTask.recurring ?? false, // Default to false if undefined/null
        highPriority: aiTask.highPriority ?? false, // Default to false if undefined/null
        color: aiTask.color || null, // Default to null if undefined/null
    }));
  }
);



