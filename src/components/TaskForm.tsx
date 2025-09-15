
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Star, Palette } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const colorOptions = [
    { name: 'Tomato', value: 'hsl(var(--task-color-1))' },
    { name: 'Tangerine', value: 'hsl(var(--task-color-2))' },
    { name: 'Citron', value: 'hsl(var(--task-color-3))' },
    { name: 'Lime', value: 'hsl(var(--task-color-4))' },
    { name: 'Mint', value: 'hsl(var(--task-color-5))' },
    { name: 'Sky', value: 'hsl(var(--task-color-6))' },
    { name: 'Lavender', value: 'hsl(var(--task-color-7))' },
    { name: 'Plum', value: 'hsl(var(--task-color-8))' },
    { name: 'Rose', value: 'hsl(var(--task-color-9))' },
    { name: 'Graphite', value: 'hsl(var(--task-color-10))' },
];


const formSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  recurring: z.boolean().optional().default(false),
  highPriority: z.boolean().optional().default(false),
  color: z.string().optional(),
}).refine(data => {
    // If one time is set, the other must also be set, and end must be after start
    if (data.startTime || data.endTime) {
        if (!data.startTime || !data.endTime || data.endTime <= data.startTime) {
            return false;
        }
        const timeToMinutes = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        const startMinutes = timeToMinutes(data.startTime);
        const endMinutes = timeToMinutes(data.endTime);
        return (endMinutes - startMinutes) >= 30;
    }
    return true;
}, {
    message: "End time must be after start time, and duration must be at least 30 minutes.",
    path: ["endTime"],
});


type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  addTask: (task: Omit<Task, 'id'>) => void;
  onTaskAdded?: () => void;
  initialData?: Partial<Task> | null;
}

export function TaskForm({ addTask, onTaskAdded, initialData }: TaskFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      date: initialData?.date ? new Date(initialData.date + 'T00:00:00') : undefined,
      startTime: initialData?.startTime || "",
      endTime: initialData?.endTime || "",
      recurring: initialData?.recurring || false,
      highPriority: initialData?.highPriority || false,
      color: initialData?.color || colorOptions[0].value,
    },
  });

   useEffect(() => {
     const defaultColorValue = colorOptions[0].value;
     if (initialData) {
       form.reset({
         name: initialData.name || "",
         description: initialData.description || "",
         date: initialData.date ? new Date(initialData.date + 'T00:00:00') : undefined,
         startTime: initialData.startTime || "",
         endTime: initialData.endTime || "",
         recurring: initialData.recurring || false,
         highPriority: initialData.highPriority || false,
         color: initialData.color || defaultColorValue,
       });
     } else {
       form.reset({
         name: "",
         description: "",
         date: undefined,
         startTime: "",
         endTime: "",
         recurring: false,
         highPriority: false,
         color: defaultColorValue,
       });
     }
   }, [initialData, form]);


  const onSubmit: SubmitHandler<TaskFormValues> = (data) => {
    const newTask: Omit<Task, 'id'> = {
      name: data.name,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'),
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      recurring: data.recurring,
      highPriority: data.highPriority,
      color: data.color,
       details: '',
       dueDate: undefined,
       exceptions: [],
    };
    addTask(newTask);
    onTaskAdded?.();
    form.reset();
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
                name="startTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

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
                        id="recurring-checkbox"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="recurring-checkbox">
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
                        id="high-priority-checkbox"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="high-priority-checkbox">
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

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </form>
    </Form>
  );
}
