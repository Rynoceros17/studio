
'use server';
/**
 * @fileOverview A Genkit flow to adjust a list of previously generated tasks based on user feedback.
 *
 * - adjustTasks - A function that takes a list of tasks and a query to modify them.
 * - AdjustTasksInput - The input type for the flow.
 * - AdjustTasksOutput - The return type for the flow (an array of SingleTaskOutput).
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { TaskArraySchema, type TaskArrayOutput } from './task-schemas';

const AdjustTasksInputSchema = z.object({
  pendingTasks: TaskArraySchema.describe("The array of task objects that need to be adjusted."),
  query: z.string().min(1, "Query cannot be empty.").describe("The user's instruction on how to adjust the tasks."),
});
export type AdjustTasksInput = z.infer<typeof AdjustTasksInputSchema>;

// The output is the same as the parse flow output
export type AdjustTasksOutput = TaskArrayOutput;

export async function adjustTasks(input: AdjustTasksInput): Promise<AdjustTasksOutput> {
  // Need to stringify the tasks for the prompt
  const promptData = {
    ...input,
    pendingTasksJson: JSON.stringify(input.pendingTasks, null, 2), // Pretty print for the model
  };
  return adjustTasksFlow(promptData);
}

const adjustTaskPrompt = ai.definePrompt({
    name: 'adjustTasksPrompt',
    input: {schema: z.object({ pendingTasksJson: z.string(), query: z.string() })},
    output: {schema: TaskArraySchema},
    prompt: `You are an expert personal assistant specializing in calendar management.
The user wants to make changes to a list of tasks you previously generated.

Your task is to take the original JSON array of tasks and the user's new adjustment instruction. You must produce a new, complete JSON array that reflects the requested changes.

- You can add, remove, or modify tasks based on the user's request.
- If the user's request is unclear or doesn't seem to relate to adjusting tasks, return an empty array \`[]\`.
- Your response MUST be only the valid JSON array. Do not include any other text, explanations, or markdown.
- When modifying a task, retain all its original fields unless the user specifically asks to change them.
- Do not add a color unless the user explicitly requests one using a tag like '#col1'.

**Original Tasks (JSON):**
{{{pendingTasksJson}}}

**User's Adjustment Request:**
{{{query}}}
`,
});

const adjustTasksFlow = ai.defineFlow(
  {
    name: 'adjustTasksFlow',
    inputSchema: z.object({ pendingTasksJson: z.string(), query: z.string() }),
    outputSchema: TaskArraySchema,
  },
  async (promptData) => {
    const {output} = await adjustTaskPrompt(promptData);
    if (!output) {
      console.warn("AI failed to adjust tasks or returned undefined output. Returning empty array.");
      return [];
    }
    // Perform the same sanitization as the parse flow, but do not assign random colors
    return output
      .filter(aiTask => !!aiTask.name && !!aiTask.date && /^\d{4}-\d{2}-\d{2}$/.test(aiTask.date))
      .map(aiTask => ({
        name: aiTask.name,
        date: aiTask.date,
        description: (aiTask.description && aiTask.description.toLowerCase() !== 'null') ? aiTask.description : null,
        startTime: aiTask.startTime || null,
        endTime: aiTask.endTime || null,
        recurring: aiTask.recurring ?? false,
        highPriority: aiTask.highPriority ?? false,
        color: aiTask.color || null, // Keep existing color or leave as null
    }));
  }
);
