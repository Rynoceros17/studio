
"use client";

import type * as React from 'react';
import { useState, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wand2, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Task } from '@/lib/types';
import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';

const naturalLanguageTaskFormSchema = z.object({
  naturalLanguageInput: z.string().min(1, { message: "Please enter your task description." }),
});

type NaturalLanguageTaskFormValues = z.infer<typeof naturalLanguageTaskFormSchema>;

interface NaturalLanguageTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdd: (task: Omit<Task, 'id'>) => void;
}

interface ParsedTaskResult {
  title?: string;
  date?: string; // yyyy-MM-dd
  error?: string;
}

export function NaturalLanguageTaskDialog({ isOpen, onClose, onTaskAdd }: NaturalLanguageTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTaskResult | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const form = useForm<NaturalLanguageTaskFormValues>({
    resolver: zodResolver(naturalLanguageTaskFormSchema),
    defaultValues: {
      naturalLanguageInput: '',
    },
  });

  const handleDialogClose = () => {
    form.reset();
    setParsedResult(null);
    setSubmissionError(null);
    setIsLoading(false);
    onClose();
  };

  const onSubmit: SubmitHandler<NaturalLanguageTaskFormValues> = async (data) => {
    setIsLoading(true);
    setParsedResult(null);
    setSubmissionError(null);
    try {
      const result = await parseNaturalLanguageTask({
        userInput: data.naturalLanguageInput,
        currentDate: new Date().toISOString().split('T')[0], // Pass current date as yyyy-MM-dd
      });
      setParsedResult(result);
      if (result.error) {
          setSubmissionError(result.error);
      }
    } catch (error: any) {
      console.error("Error parsing natural language task:", error);
      const errorMessage = error.message || "An unexpected error occurred during parsing.";
      setParsedResult({ error: errorMessage });
      setSubmissionError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTaskToCalendar = () => {
    if (parsedResult && parsedResult.title && parsedResult.date) {
      const newTask: Omit<Task, 'id'> = {
        name: parsedResult.title,
        date: parsedResult.date,
        description: '', // Default empty description
        recurring: false,
        highPriority: false,
        color: undefined,
        details: '',
        files: [],
        exceptions: [],
        dueDate: undefined, 
      };
      onTaskAdd(newTask);
      handleDialogClose();
    } else {
        setSubmissionError("Cannot add to calendar. Missing title or date from parsed result.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center">
            <Wand2 className="mr-2 h-5 w-5" /> Add Task with Natural Language
          </DialogTitle>
          <DialogDescription>
            Type your task and when you want to do it (e.g., "Team meeting tomorrow at 10am" or "Submit report next Friday").
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="naturalLanguageInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="natural-language-input" className="sr-only">Task Description</FormLabel>
                  <FormControl>
                    <Textarea
                      id="natural-language-input"
                      placeholder="e.g., Pick up dry cleaning on Tuesday"
                      {...field}
                      rows={3}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Parse Task
            </Button>
          </form>
        </Form>

        {submissionError && !isLoading && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Parsing Error</AlertTitle>
                <AlertDescription>{submissionError}</AlertDescription>
            </Alert>
        )}

        {parsedResult && !parsedResult.error && !isLoading && (
          <div className="mt-4 space-y-3">
            <Alert>
              <Wand2 className="h-4 w-4 !text-primary" />
              <AlertTitle className="text-primary">Parsed Task Suggestion</AlertTitle>
              <AlertDescription>
                {parsedResult.title ? (
                  <p><strong>Title:</strong> {parsedResult.title}</p>
                ) : (
                  <p className="text-destructive">Could not determine task title.</p>
                )}
                {parsedResult.date ? (
                  <p><strong>Date:</strong> {parsedResult.date}</p>
                ) : (
                  <p className="text-destructive">Could not determine task date.</p>
                )}
              </AlertDescription>
            </Alert>
            {parsedResult.title && parsedResult.date && (
              <Button onClick={handleAddTaskToCalendar} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Add to Calendar
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
