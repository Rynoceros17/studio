
'use server';
/**
 * @fileOverview A Genkit flow to parse natural language into a structured task object.
 *
 * - parseNaturalLanguageTask - A function that takes a user's query and returns a parsed task.
 * - ParseNaturalLanguageTaskInput - The input type for the flow.
 * - ParseNaturalLanguageTaskOutput - The return type for the flow.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {format} from 'date-fns';

const ParseNaturalLanguageTaskInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty.").describe("The natural language query from the user describing a task."),
});
export type ParseNaturalLanguageTaskInput = z.infer<typeof ParseNaturalLanguageTaskInputSchema>;

const ParseNaturalLanguageTaskOutputSchema = z.object({
  name: z.string().describe("A concise name for the task."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.").describe("The date for the task in YYYY-MM-DD format. Infer from terms like 'today', 'tomorrow', 'next Monday', or specific dates."),
  description: z.string().optional().describe("Any additional details from the request. If a specific time is mentioned, include it here clearly (e.g., 'Time: 3:00 PM')."),
  parsedTime: z.string().optional().nullable().describe("If a specific time is mentioned (e.g., '3pm', '15:00'), extract it as 'HH:MM AM/PM' or 'HH:MM' (24-hour). If no time, omit or leave null."),
});
export type ParseNaturalLanguageTaskOutput = z.infer<typeof ParseNaturalLanguageTaskOutputSchema>;

export async function parseNaturalLanguageTask(input: ParseNaturalLanguageTaskInput): Promise<ParseNaturalLanguageTaskOutput> {
  return parseNaturalLanguageTaskFlow(input);
}

const parseTaskPrompt = ai.definePrompt({
  name: 'parseNaturalLanguageTaskPrompt',
  input: {schema: ParseNaturalLanguageTaskInputSchema},
  output: {schema: ParseNaturalLanguageTaskOutputSchema},
  prompt: `You are an intelligent assistant that helps parse user requests to create calendar tasks.
The current date is ${format(new Date(), 'yyyy-MM-dd')}.
Convert the user's request into a JSON object with the following fields:
- "name": A concise name for the task. This should be the main action or event.
- "date": The date for the task in "YYYY-MM-DD" format. Infer this from terms like "today", "tomorrow", "next Monday", or specific dates.
- "description": Any additional details from the request. If the user mentions a specific time, include it clearly in the description (e.g., "Complete report. Originally mentioned time: 3:00 PM").
- "parsedTime": If a specific time is mentioned (e.g., "3pm", "15:00"), extract it as "HH:MM AM/PM" or "HH:MM" (24-hour). If no time, this field should be null.

Strictly adhere to the JSON output format specified. Do not add any extra explanations or text outside the JSON object.

Example 1:
User Input: "Remind me to call John tomorrow at 3pm"
Output (assuming today is 2023-10-26):
{
  "name": "Call John",
  "date": "2023-10-27",
  "description": "Call John. Originally mentioned time: 3:00 PM",
  "parsedTime": "3:00 PM"
}

Example 2:
User Input: "Dentist appointment next Tuesday"
Output (assuming today is Thursday, 2023-10-26, so next Tuesday is 2023-10-31):
{
  "name": "Dentist appointment",
  "date": "2023-10-31",
  "description": "Dentist appointment",
  "parsedTime": null
}

Example 3:
User Input: "Submit report by November 5th"
Output (assuming current year is 2023):
{
  "name": "Submit report",
  "date": "2023-11-05",
  "description": "Submit report",
  "parsedTime": null
}

Example 4:
User Input: "Lunch with Sarah on Oct 30"
Output (assuming current year is 2023):
{
  "name": "Lunch with Sarah",
  "date": "2023-10-30",
  "description": "Lunch with Sarah",
  "parsedTime": null
}

User Input: {{{query}}}
Ensure your entire response is ONLY the JSON object.
`,
});

const parseNaturalLanguageTaskFlow = ai.defineFlow(
  {
    name: 'parseNaturalLanguageTaskFlow',
    inputSchema: ParseNaturalLanguageTaskInputSchema,
    outputSchema: ParseNaturalLanguageTaskOutputSchema,
  },
  async (input) => {
    const {output} = await parseTaskPrompt(input);
    if (!output) {
      throw new Error("AI failed to parse the task. Please try rephrasing your request.");
    }
    // Ensure all required fields are present, even if AI omits optional ones
    return {
        name: output.name || "Unnamed Task",
        date: output.date, // This is required by schema, should always be there
        description: output.description || "",
        parsedTime: output.parsedTime || null,
    };
  }
);

