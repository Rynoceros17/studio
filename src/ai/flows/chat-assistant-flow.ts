
'use server';
/**
 * @fileOverview A Genkit flow for a general chat assistant. This flow is intended as a fallback
 * when the primary task parsing flow fails to identify any tasks.
 *
 * - chatWithAssistant - A function that takes a user's message and returns a helpful AI response.
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

const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatAssistantInputSchema,
    outputSchema: ChatAssistantOutputSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
        prompt: `You are a helpful AI assistant for a calendar app. Your primary role is to help users create tasks.
        Another AI, responsible for parsing structured tasks, was unable to understand the user's request.
        Your job is to respond to the user in a friendly and helpful manner.

        Politely inform the user that you couldn't identify any specific tasks in their message.
        Suggest they try rephrasing their request, perhaps including more specific details like dates, times, or task names.
        Keep your response concise and helpful.

        User's original message: "${input.message}"`,
        model: 'googleai/gemini-2.0-flash',
        config: {
            temperature: 0.5,
        },
    });

    return { reply: llmResponse.text };
  }
);
