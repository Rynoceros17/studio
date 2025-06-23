
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Save, Star, Palette } from 'lucide-react';

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

const colorOptions = [
  { name: 'White', value: 'hsl(var(--card))' },
  { name: 'Light Purple', value: 'hsl(var(--secondary))' },
  { name: 'Lighter Purple', value: 'hsl(var(--muted))' },
  { name: 'Pale Gold', value: 'hsl(50, 100%, 90%)' },
  { name: 'Soft Gold', value: 'hsl(45, 90%, 85%)' },
  { name: 'Light Goldenrod', value: 'hsl(55, 80%, 80%)' },
];

const editFormSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  recurring: z.boolean().optional(),
  highPriority: z.boolean().optional(),
  color: z.string().optional().default(colorOptions[0].value),
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
  const [selectedColor, setSelectedColor] = useState<string | null>(task?.color || colorOptions[0].value);


  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: '',
      description: '',
      date: undefined,
      recurring: false,
      highPriority: false,
      color: colorOptions[0].value,
    },
  });

  useEffect(() => {
    const defaultColorValue = colorOptions[0].value;
    if (isOpen && task) {
      form.reset({
        name: task.name,
        description: task.description || '',
        date: task.date ? parseISO(task.date + 'T00:00:00') : undefined, // Ensure time part for correct local date
        recurring: task.recurring || false,
        highPriority: task.highPriority || false,
        color: task.color || defaultColorValue,
      });
      setSelectedColor(task.color || defaultColorValue);
    } else if (!isOpen) {
       form.reset({ name: '', description: '', date: undefined, recurring: false, highPriority: false, color: defaultColorValue });
       setSelectedColor(defaultColorValue);
    }
  }, [task, isOpen, form]);

  const onSubmit: SubmitHandler<EditTaskFormValues> = (data) => {
    if (task) {
      const updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>> = {
        name: data.name,
        description: data.description || null,
        date: format(data.date, 'yyyy-MM-dd'),
        recurring: data.recurring,
        highPriority: data.highPriority,
        color: data.color || null,
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

             <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Palette className="mr-2 h-4 w-4" /> Task Color</FormLabel>
                    <FormControl>
                      <div className="flex space-x-2 pt-1 flex-wrap gap-y-2">
                        {colorOptions.map((colorOpt) => (
                          <Button
                            key={colorOpt.value}
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              "h-8 w-8 rounded-full",
                              field.value === colorOpt.value && "ring-2 ring-ring ring-offset-2"
                            )}
                            onClick={() => {
                              field.onChange(colorOpt.value);
                              setSelectedColor(colorOpt.value);
                            }}
                            aria-label={`Set task color to ${colorOpt.name}`}
                            title={colorOpt.name}
                          >
                            <div
                              className="h-5 w-5 rounded-full border"
                              style={{ backgroundColor: colorOpt.value }}
                            />
                          </Button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


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
