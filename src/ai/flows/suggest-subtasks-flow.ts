
'use server';
/**
 * @fileOverview A Genkit flow to suggest subtasks for a given goal.
 *
 * - suggestSubtasksForGoal - A function that handles suggesting subtasks.
 * - SuggestSubtasksInput - The input type for the flow.
 * - SuggestSubtasksOutput - The return type for the flow.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';

const SuggestSubtasksInputSchema = z.object({
  goalName: z.string().describe('The name of the main goal for which subtasks are to be suggested.'),
});
export type SuggestSubtasksInput = z.infer<typeof SuggestSubtasksInputSchema>;

const SuggestSubtasksOutputSchema = z.object({
  subtaskNames: z.array(z.string()).optional().describe('An array of 3-5 suggested subtask names. These should be actionable steps to achieve the goal.'),
  error: z.string().optional().describe('An error message if suggestions could not be generated.'),
});
export type SuggestSubtasksOutput = z.infer<typeof SuggestSubtasksOutputSchema>;

export async function suggestSubtasksForGoal(input: SuggestSubtasksInput): Promise<SuggestSubtasksOutput> {
  return suggestSubtasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSubtasksPrompt',
  input: { schema: SuggestSubtasksInputSchema },
  output: { schema: SuggestSubtasksOutputSchema },
  prompt: `You are a helpful assistant that specializes in breaking down goals into actionable subtasks.
Given the following goal name, suggest 3 to 5 concise and actionable subtasks that would help achieve it.
Focus on practical first steps or key components.

Goal Name: "{{{goalName}}}"

Return the subtasks as a JSON array of strings in the "subtaskNames" field.
If you cannot generate relevant subtasks, provide a reason in the "error" field.
For example, for the goal "Learn to bake bread", subtasks could be:
["Research beginner bread recipes", "Buy necessary ingredients and equipment", "Practice kneading techniques", "Bake a simple loaf", "Experiment with different flours"]
`,
});

const suggestSubtasksFlow = ai.defineFlow(
  {
    name: 'suggestSubtasksFlow',
    inputSchema: SuggestSubtasksInputSchema,
    outputSchema: SuggestSubtasksOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      return { error: 'AI model did not return a valid response.' };
    }
    if (output.error) {
      return { error: output.error };
    }
    if (!output.subtaskNames || output.subtaskNames.length === 0) {
        // If the AI didn't provide an error but also no subtasks, set a generic one.
        return { error: 'Could not generate subtask suggestions for this goal. Please try rephrasing your goal or be more specific.'};
    }

    return { subtaskNames: output.subtaskNames };
  }
);
