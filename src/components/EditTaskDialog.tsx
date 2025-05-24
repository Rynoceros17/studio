
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Save, Star } from 'lucide-react'; // Removed Palette

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import {
  Dialog as ShadDialog,
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogFooter as ShadDialogFooter,
} from '@/components/ui/dialog';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

// Schema without color
const editFormSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  recurring: z.boolean().optional(),
  highPriority: z.boolean().optional(),
});

type EditTaskFormValues = z.infer<typeof editFormSchema>;

interface EditTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>>) => void;
}

export function EditTaskDialog({ task, isOpen, onClose, updateTask }: EditTaskDialogProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: '',
      description: '',
      date: undefined,
      recurring: false,
      highPriority: false,
    },
  });

  useEffect(() => {
    if (isOpen && task) {
      form.reset({
        name: task.name,
        description: task.description || '',
        date: task.date ? parseISO(task.date + 'T00:00:00') : undefined,
        recurring: task.recurring || false,
        highPriority: task.highPriority || false,
      });
    } else if (!isOpen) {
       form.reset({ name: '', description: '', date: undefined, recurring: false, highPriority: false });
    }
  }, [task, isOpen, form]);

  const onSubmit: SubmitHandler<EditTaskFormValues> = (data) => {
    if (task) {
      const updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>> = {
        name: data.name,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'),
        recurring: data.recurring,
        highPriority: data.highPriority,
        // No color property
      };
      updateTask(task.id, updates);
      onClose();
    }
  };

  return (
    <ShadDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ShadDialogContent className="sm:max-w-md">
        <ShadDialogHeader>
          <ShadDialogTitle className="text-primary">Edit Task</ShadDialogTitle>
        </ShadDialogHeader>
        {task ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                                 "w-full justify-start text-left font-normal",
                                 !field.value && "text-muted-foreground"
                               )}
                                type="button"
                                onClick={(e) => {
                                   e.preventDefault();
                                   setIsCalendarOpen(!isCalendarOpen);
                                 }}
                             >
                               <CalendarIcon className="mr-2 h-4 w-4" />
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
                               setIsCalendarOpen(false);
                             }}
                             disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                           />
                         </PopoverContent>
                      </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

             <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-secondary/30 h-full justify-center">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="edit-recurring-checkbox"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <Label htmlFor="edit-recurring-checkbox">
                            Repeat Weekly
                          </Label>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="highPriority"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-secondary/30 h-full justify-center">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="edit-high-priority-checkbox"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <Label htmlFor="edit-high-priority-checkbox">
                            High Priority
                          </Label>
                          <FormDescription className="text-xs text-muted-foreground flex items-center">
                             <Star className="h-3 w-3 mr-1 text-accent fill-accent" /> Mark as important
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
             </div>

              {/* Color Selection UI Removed */}

              <ShadDialogFooter className="pt-4">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
              </ShadDialogFooter>
            </form>
          </Form>
        ) : (
          <p>Loading task details...</p>
        )}
      </ShadDialogContent>
    </ShadDialog>
  );
}
