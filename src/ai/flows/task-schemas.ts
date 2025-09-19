/**
 * @fileOverview Shared Zod schemas for AI task-related flows.
 * This file does NOT use the 'use server' directive, so it can safely
 * export non-function objects like Zod schemas.
 */
import { z } from 'zod';
import { availableColorTags, colorTagDescriptions } from '@/lib/color-map';

// Schema for a single task as parsed by the AI
export const SingleTaskSchema = z.object({
  name: z.string().describe("A concise name for the task."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.").describe("The date for the task in YYYY-MM-DD format. When 'today' is mentioned, this MUST be the value of `currentDate`. Infer from other terms like 'tomorrow', 'next Monday', or specific dates."),
  description: z.string().nullable().describe("Include additional details ONLY if explicitly provided beyond the name and date/time. **This field MUST NOT contain any time information.** Time details must go in the startTime and endTime fields. If no extra details are given, this field MUST be null."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().describe("The start time in 24-hour HH:MM format. Extract from phrases like 'at 3pm' or 'from 2-4pm'. If a duration is given (e.g., 'for 2 hours'), calculate a start time. MUST be null if absolutely no time is specified."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().describe("The end time in 24-hour HH:MM format. If only a start time is given (e.g., 'at 3pm'), infer an end time 1 hour later. If a duration is given (e.g., 'from 2pm for 2 hours'), calculate the end time. MUST be null if absolutely no time is specified."),
  recurring: z.boolean().describe("Set to `true` ONLY for single-day recurrences like 'every Tuesday'. For date ranges like 'every day this week', expand into individual tasks and set this to `false`. Otherwise, this MUST be `false`. This field MUST always be present."),
  highPriority: z.boolean().describe("Set to `true` if the user's input for this task explicitly uses words like 'important', 'priority', or 'urgent'. Otherwise, this MUST be `false`. This field MUST always be present."),
  color: z.string().regex(/^#col[1-6]$/).nullable().describe(`If the user's input for this task explicitly specifies a color tag from the list: ${availableColorTags.join(', ')} (these correspond to: ${colorTagDescriptions.join('; ')}), include that exact tag here (e.g., '#col1'). Otherwise, this field MUST be null. This field MUST always be present.`)
});

// Output schema for flows that return an array of tasks
export const TaskArraySchema = z.array(SingleTaskSchema);

// Type alias for a single parsed task object.
export type SingleTaskOutput = z.infer<typeof SingleTaskSchema>;

// Type alias for an array of parsed tasks.
export type TaskArrayOutput = z.infer<typeof TaskArraySchema>;
