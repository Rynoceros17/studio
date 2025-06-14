
'use server';
/**
 * @fileOverview A Genkit flow for a general chat assistant.
 *
 * - chatWithAssistant - A function that takes a user's message and returns the AI's response.
 * - ChatAssistantInput - The input type for the flow.
 * - ChatAssistantOutput - The return type for the flow.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ChatAssistantInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty.").describe("The user's message to the chat assistant."),
});
export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

const ChatAssistantOutputSchema = z.object({
  reply: z.string().describe("The AI assistant's reply to the user's message."),
});
export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;


export async function chatWithAssistant(input: ChatAssistantInput): Promise<ChatAssistantOutput> {
  return chatAssistantFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatAssistantPrompt',
  input: { schema: ChatAssistantInputSchema },
  output: { schema: ChatAssistantOutputSchema },
  prompt: `You are a helpful AI assistant. Respond to the user's message.

User: {{{message}}}
AI:`,
});

const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatAssistantInputSchema,
    outputSchema: ChatAssistantOutputSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
        prompt: input.message, // Using the direct message for now, can be refined
        model: 'googleai/gemini-2.0-flash', // Ensure this model is appropriate
        config: {
            // Add any specific configurations if needed, e.g., temperature
        },
        // If using a structured prompt like above, you'd call it:
        // const { output } = await chatPrompt(input);
        // return { reply: output?.reply || "Sorry, I couldn't generate a response." };
    });

    // For ai.generate with simple prompt:
    return { reply: llmResponse.text || "Sorry, I couldn't generate a response." };
  }
);
