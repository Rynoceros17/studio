
"use client";

import type * as React from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
// Removed useToast import as it's handled in the parent now
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
});

type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  addTask: (task: Omit<Task, 'id'>) => void;
  onTaskAdded?: () => void; // Optional callback after task is added
}

export function TaskForm({ addTask, onTaskAdded }: TaskFormProps) {
  // Removed toast instance
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      date: undefined, // Initialize date as undefined
    },
  });

  const onSubmit: SubmitHandler<TaskFormValues> = (data) => {
    const newTask: Omit<Task, 'id'> = {
      name: data.name,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'), // Format date before adding
    };
    addTask(newTask);
    form.reset(); // Reset form after submission
    // Removed toast call here
    onTaskAdded?.(); // Call the callback if provided (e.g., to close a dialog)
  };

  return (
    // Removed bg-secondary, p-6, rounded-lg, shadow - let the Dialog handle styling
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
         {/* Removed heading - Dialog has its own title */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Buy groceries" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Milk, eggs, bread" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal", // Use justify-start
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" /> {/* Icon on the left */}
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(date) => {
                      field.onChange(date);
                      setIsCalendarOpen(false); // Close popover on date select
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </form>
    </Form>
  );
}
