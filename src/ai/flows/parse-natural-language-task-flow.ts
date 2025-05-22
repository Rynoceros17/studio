
'use server';
/**
 * @fileOverview A Genkit flow to parse natural language input into a task title and date.
 *
 * - parseNaturalLanguageTask - A function that handles parsing user input.
 * - NaturalLanguageTaskInput - The input type for the flow.
 * - NaturalLanguageTaskOutput - The return type for the flow.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';

const NaturalLanguageTaskInputSchema = z.object({
  userInput: z.string().describe('The natural language input from the user describing a task and optionally a date.'),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Current date must be in yyyy-MM-dd format.").describe('The current date in yyyy-MM-dd format, to help resolve relative dates like "tomorrow".'),
});
export type NaturalLanguageTaskInput = z.infer<typeof NaturalLanguageTaskInputSchema>;

const NaturalLanguageTaskOutputSchema = z.object({
  title: z.string().optional().describe('The parsed title of the task. Should be concise.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format.")
    .optional()
    .describe('The parsed date for the task in yyyy-MM-dd format. If a date is found, it must be in this format.'),
  error: z.string().optional().describe('An error message if parsing failed or the input was ambiguous. If no task or date can be reasonably extracted, this field should explain why.'),
});
export type NaturalLanguageTaskOutput = z.infer<typeof NaturalLanguageTaskOutputSchema>;

export async function parseNaturalLanguageTask(input: NaturalLanguageTaskInput): Promise<NaturalLanguageTaskOutput> {
  return parseNaturalLanguageTaskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseNaturalLanguageTaskPrompt',
  input: { schema: NaturalLanguageTaskInputSchema },
  output: { schema: NaturalLanguageTaskOutputSchema },
  prompt: `You are an assistant that helps parse user input to create tasks.
Given the user's input and the current date, extract a concise task title and a specific date for the task.
The current date is: {{{currentDate}}}

User input: "{{{userInput}}}"

- The task date must be returned in "yyyy-MM-dd" format.
- If the user specifies a relative date (e.g., "tomorrow", "next Friday", "in 2 days"), calculate the absolute date based on the current date.
- If the input is ambiguous or does not clearly state a task and a date, set the "error" field explaining the issue (e.g., "Could not determine a specific date" or "No clear task found").
- If a date is mentioned but not a task title, or vice-versa, try to return what you can.
- If no date is mentioned, do not return a date.
- Be specific. For example, if the user says "this Friday", calculate which Friday that is.
- If a time is mentioned, ignore the time and only focus on the date.
- If only a day of the week is mentioned (e.g. "Monday"), assume it's the upcoming Monday unless specified otherwise (e.g. "last Monday").
- If a month and day are mentioned but no year (e.g. "May 10th"), assume the current year if that date has not passed yet. If it has passed, assume next year.
- If the user's input is very vague (e.g. "something soon"), set the error field.
- If no specific task description is found, the title can be "Untitled Task" if a date is found, otherwise, set an error.
`,
});

const parseNaturalLanguageTaskFlow = ai.defineFlow(
  {
    name: 'parseNaturalLanguageTaskFlow',
    inputSchema: NaturalLanguageTaskInputSchema,
    outputSchema: NaturalLanguageTaskOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      return { error: 'AI model did not return a valid response.' };
    }
    if (output.error) {
      return { error: output.error };
    }

    // Validate the date format if a date is returned
    if (output.date) {
      try {
        const parsedDate = parse(output.date, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) {
          return { title: output.title, error: `AI returned an invalid date format: ${output.date}. Please try again with a clearer date.` };
        }
        // Re-format to ensure it's strictly yyyy-MM-dd
        output.date = format(parsedDate, 'yyyy-MM-dd');
      } catch (e) {
        return { title: output.title, error: `AI returned a date that could not be parsed: ${output.date}.` };
      }
    }

    if (!output.title && !output.date) {
        return { error: "Could not understand the task or date from your input. Please try being more specific." };
    }
    if (!output.title && output.date) {
        output.title = "Untitled Task"; // Assign a default title if date is present but no title
    }


    return output;
  }
);
