
"use client";

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays, differenceInWeeks, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const dueDateTaskFormSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  taskDate: z.date({ required_error: "A primary task date is required." }),
  dueDate: z.date().optional(),
});

type DueDateTaskFormValues = z.infer<typeof dueDateTaskFormSchema>;

interface DueDateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  addTask: (task: Omit<Task, 'id'>) => void;
}

export function DueDateTaskDialog({ isOpen, onClose, addTask }: DueDateTaskDialogProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [weeksLeft, setWeeksLeft] = useState<number | null>(null);
  const [isTaskDatePickerOpen, setIsTaskDatePickerOpen] = useState(false);
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);

  const form = useForm<DueDateTaskFormValues>({
    resolver: zodResolver(dueDateTaskFormSchema),
    defaultValues: {
      name: '',
      taskDate: new Date(),
      dueDate: undefined,
    },
  });

  const selectedDueDate = form.watch('dueDate');

  useEffect(() => {
    if (selectedDueDate && isValid(selectedDueDate)) {
      const today = new Date();
      today.setHours(0,0,0,0); // Normalize today to start of day for accurate diff
      const due = new Date(selectedDueDate);
      due.setHours(0,0,0,0); // Normalize due date

      if (due >= today) {
        setDaysLeft(differenceInDays(due, today));
        setWeeksLeft(differenceInWeeks(due, today));
      } else {
        setDaysLeft(null); // Due date is in the past
        setWeeksLeft(null);
      }
    } else {
      setDaysLeft(null);
      setWeeksLeft(null);
    }
  }, [selectedDueDate]);

  const onSubmit: SubmitHandler<DueDateTaskFormValues> = (data) => {
    const newTask: Omit<Task, 'id'> = {
      name: data.name,
      description: '', // Default empty description
      date: format(data.taskDate, 'yyyy-MM-dd'),
      dueDate: data.dueDate ? format(data.dueDate, 'yyyy-MM-dd') : undefined,
      recurring: false,
      highPriority: false,
      color: undefined,
      details: '',
      files: [],
      exceptions: [],
    };
    addTask(newTask);
    form.reset({ name: '', taskDate: new Date(), dueDate: undefined }); // Reset form after adding
    onClose();
  };

  const handleDialogClose = () => {
    form.reset({ name: '', taskDate: new Date(), dueDate: undefined });
    setDaysLeft(null);
    setWeeksLeft(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Add Task with Due Date</DialogTitle>
          <DialogDescription>
            Enter task details. "Days/Weeks Left" will update if a due date is set.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Project Proposal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taskDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Task Date (for Calendar)</FormLabel>
                  <Popover open={isTaskDatePickerOpen} onOpenChange={setIsTaskDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          type="button"
                          onClick={() => setIsTaskDatePickerOpen(!isTaskDatePickerOpen)}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            field.onChange(date);
                            setIsTaskDatePickerOpen(false);
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
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date (Optional)</FormLabel>
                  <Popover open={isDueDatePickerOpen} onOpenChange={setIsDueDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                           type="button"
                           onClick={() => setIsDueDatePickerOpen(!isDueDatePickerOpen)}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a due date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            field.onChange(date);
                            setIsDueDatePickerOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(daysLeft !== null || weeksLeft !== null) && selectedDueDate && isValid(selectedDueDate) && differenceInDays(selectedDueDate, new Date(new Date().setHours(0,0,0,0))) >= 0 && (
              <Alert variant="default" className="bg-secondary/50">
                <AlertCircle className="h-4 w-4 !text-primary" />
                <AlertTitle className="text-primary">Time Remaining</AlertTitle>
                <AlertDescription>
                  {daysLeft !== null && <span>{daysLeft} day{daysLeft === 1 ? '' : 's'} left. </span>}
                  {weeksLeft !== null && <span>({weeksLeft} week{weeksLeft === 1 ? '' : 's'} left)</span>}
                </AlertDescription>
              </Alert>
            )}
             {selectedDueDate && isValid(selectedDueDate) && differenceInDays(selectedDueDate, new Date(new Date().setHours(0,0,0,0))) < 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Due Date Past</AlertTitle>
                    <AlertDescription>
                        The selected due date is in the past.
                    </AlertDescription>
                </Alert>
            )}


            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Task to Calendar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
