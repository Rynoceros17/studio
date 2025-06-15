
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

const ParseNaturalLanguageTaskInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty.").max(250, "Query is too long.").describe("The natural language query from the user describing one or more tasks."),
});
export type ParseNaturalLanguageTaskInput = z.infer<typeof ParseNaturalLanguageTaskInputSchema>;

// Schema for a single task
const SingleTaskSchema = z.object({
  name: z.string().describe("A concise name for the task."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.").describe("The date for the task in YYYY-MM-DD format. Infer from terms like 'today', 'tomorrow', 'next Monday', or specific dates."),
  description: z.string().optional().describe("Only include additional details if explicitly provided beyond name and date/time. If a specific time is mentioned, include it here (e.g., 'Time: 3:00 PM'). Otherwise, empty string or omit."),
  parsedTime: z.string().optional().nullable().describe("If a specific time is mentioned (e.g., '3pm', '15:00'), extract it as 'HH:MM AM/PM' or 'HH:MM' (24-hour). If no time, omit or leave null."),
});
export type SingleTaskOutput = z.infer<typeof SingleTaskSchema>;

// Output schema is an array of single tasks
const ParseNaturalLanguageTaskOutputSchema = z.array(SingleTaskSchema);
export type ParseNaturalLanguageTaskOutput = z.infer<typeof ParseNaturalLanguageTaskOutputSchema>;


export async function parseNaturalLanguageTask(input: ParseNaturalLanguageTaskInput): Promise<ParseNaturalLanguageTaskOutput> {
  return parseNaturalLanguageTaskFlow(input);
}

const parseTaskPrompt = ai.definePrompt({
  name: 'parseNaturalLanguageTaskPrompt',
  input: {schema: ParseNaturalLanguageTaskInputSchema},
  output: {schema: ParseNaturalLanguageTaskOutputSchema}, // Expecting an array of tasks
  prompt: `You are an intelligent assistant that helps parse user requests to create calendar tasks from a single query which might contain multiple distinct tasks.
The current date is ${format(new Date(), 'yyyy-MM-dd')}.
Convert the user's query into an array of JSON objects. Each object in the array should represent a distinct task and have the following fields:
- "name": A concise name for the task. This should be the main action or event.
- "date": The date for the task in "YYYY-MM-DD" format. Infer this from terms like "today", "tomorrow", "next Monday", or specific dates.
- "description": Only include additional details if explicitly provided in the request beyond the task name and date/time. If the user mentions a specific time, include it clearly in the description (e.g., "Time: 3:00 PM"). If no extra details or time, this field should be an empty string.
- "parsedTime": If a specific time is mentioned (e.g., "3pm", "15:00"), extract it as "HH:MM AM/PM" or "HH:MM" (24-hour). If no time, this field should be null.

If the query contains multiple tasks, create a separate JSON object for each task in the array.
If the query contains only one task, return an array with a single JSON object.
If no tasks can be parsed, return an empty array.

Strictly adhere to the JSON output format specified. Do not add any extra explanations or text outside the JSON array.

Example 1 (Single Task):
User Input: "Remind me to call John tomorrow at 3pm"
Output (assuming today is 2023-10-26):
[
  {
    "name": "Call John",
    "date": "2023-10-27",
    "description": "Time: 3:00 PM",
    "parsedTime": "3:00 PM"
  }
]

Example 2 (Multiple Tasks):
User Input: "Dentist appointment next Tuesday and then Grocery shopping on Saturday at 10am"
Output (assuming today is Thursday, 2023-10-26, so next Tuesday is 2023-10-31 and Saturday is 2023-10-28):
[
  {
    "name": "Dentist appointment",
    "date": "2023-10-31",
    "description": "",
    "parsedTime": null
  },
  {
    "name": "Grocery shopping",
    "date": "2023-10-28",
    "description": "Time: 10:00 AM",
    "parsedTime": "10:00 AM"
  }
]

Example 3 (Single Task, No Time, Minimal Description):
User Input: "Submit report by November 5th"
Output (assuming current year is 2023):
[
  {
    "name": "Submit report",
    "date": "2023-11-05",
    "description": "",
    "parsedTime": null
  }
]

User Input: "Book flight for next week Monday and also prepare presentation for Friday"
Output (assuming today is 2023-10-26, next Monday is 2023-10-30, Friday is 2023-10-27):
[
    {
        "name": "Book flight",
        "date": "2023-10-30",
        "description": "",
        "parsedTime": null
    },
    {
        "name": "Prepare presentation",
        "date": "2023-10-27",
        "description": "",
        "parsedTime": null
    }
]


User Input: {{{query}}}
Ensure your entire response is ONLY the JSON array.
`,
});

const parseNaturalLanguageTaskFlow = ai.defineFlow(
  {
    name: 'parseNaturalLanguageTaskFlow',
    inputSchema: ParseNaturalLanguageTaskInputSchema,
    outputSchema: ParseNaturalLanguageTaskOutputSchema, // Expecting an array
  },
  async (input) => {
    const {output} = await parseTaskPrompt(input);
    if (!output) {
      // This case should ideally be handled by the prompt ensuring an empty array for no tasks.
      // If AI returns nothing or malformed, this could be a fallback.
      console.warn("AI failed to parse tasks or returned undefined output. Returning empty array.");
      return [];
    }
    // Ensure each task in the array has the necessary fields, providing defaults for optional ones.
    return output.map(task => ({
        name: task.name || "Unnamed Task",
        date: task.date, // This is required by schema, should always be there
        description: task.description || "", // Default to empty string if not provided
        parsedTime: task.parsedTime || null,
    }));
  }
);

