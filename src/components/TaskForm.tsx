
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
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox
import { Label } from "@/components/ui/label"; // Added Label
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  recurring: z.boolean().optional().default(false), // Add recurring field with default
});

type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  addTask: (task: Omit<Task, 'id'>) => void;
  onTaskAdded?: () => void; // Optional callback after task is added
}

export function TaskForm({ addTask, onTaskAdded }: TaskFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      date: undefined, // Initialize date as undefined
      recurring: false, // Initialize recurring as false
    },
  });

  const onSubmit: SubmitHandler<TaskFormValues> = (data) => {
    const newTask: Omit<Task, 'id'> = {
      name: data.name,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'), // Format date before adding
      recurring: data.recurring, // Include recurring status
       // Initialize other optional fields
       details: '',
       dueDate: undefined,
       files: [],
    };
    addTask(newTask);
    form.reset(); // Reset form after submission
    onTaskAdded?.(); // Call the callback if provided (e.g., to close a dialog)
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Dr Du Homework" {...field} />
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
                <Textarea placeholder="e.g., Math Extension 1" {...field} />
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
         <FormField
            control={form.control}
            name="recurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-secondary/30">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Repeat Weekly
                  </FormLabel>
                  <FormMessage />
                </div>
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
