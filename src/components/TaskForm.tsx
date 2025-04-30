
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Star, Palette } from 'lucide-react'; // Removed X icon import

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

// New set of 8 colors + White (default)
const colorOptions = [
  { name: 'Salmon', value: 'hsl(6, 90%, 85%)' },     // Light Salmon
  { name: 'Sky', value: 'hsl(195, 70%, 85%)' },    // Light Sky Blue
  { name: 'Mint', value: 'hsl(150, 60%, 85%)' },    // Light Mint Green
  { name: 'Apricot', value: 'hsl(35, 90%, 85%)' },   // Light Apricot
  { name: 'Lavender', value: 'hsl(250, 60%, 88%)' }, // Light Lavender (similar to old purple)
  { name: 'Teal', value: 'hsl(175, 50%, 82%)' },    // Light Teal
  { name: 'Rose', value: 'hsl(350, 75%, 88%)' },    // Light Rose
  { name: 'Lime', value: 'hsl(80, 60%, 85%)' },     // Light Lime Green
  { name: 'White', value: undefined }, // Represents default card background (white)
];


// Update schema to include color
const formSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  recurring: z.boolean().optional().default(false),
  highPriority: z.boolean().optional().default(false),
  color: z.string().optional(), // Allow undefined for color
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
      recurring: initialData?.recurring || false,
      highPriority: initialData?.highPriority || false,
      color: initialData?.color || undefined,
    },
  });

   useEffect(() => {
     if (initialData) {
       form.reset({
         name: initialData.name || "",
         description: initialData.description || "",
         date: initialData.date ? new Date(initialData.date + 'T00:00:00') : undefined,
         recurring: initialData.recurring || false,
         highPriority: initialData.highPriority || false,
         color: initialData.color || undefined,
       });
     } else {
       form.reset({
         name: "",
         description: "",
         date: undefined,
         recurring: false,
         highPriority: false,
         color: undefined,
       });
     }
   }, [initialData, form]);


  const onSubmit: SubmitHandler<TaskFormValues> = (data) => {
    const newTask: Omit<Task, 'id'> = {
      name: data.name,
      description: data.description,
      date: format(data.date, 'yyyy-MM-dd'),
      recurring: data.recurring,
      highPriority: data.highPriority,
      color: data.color, // Pass undefined if default/no color selected
       details: '',
       dueDate: undefined,
       files: [],
       exceptions: [],
    };
    addTask(newTask);
    onTaskAdded?.();
  };

  const selectedColor = form.watch('color');


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
                      // Prevent form submission when clicking the trigger
                      type="button"
                      onClick={(e) => {
                         e.preventDefault();
                         setIsCalendarOpen(!isCalendarOpen);
                       }}
                       onBlur={() => {
                           // Delay closing slightly to allow calendar interaction
                           // setTimeout(() => setIsCalendarOpen(false), 150);
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
                 <div className="flex flex-wrap gap-2 pt-2">
                   {colorOptions.map((colorOption) => ( // Use new colorOptions
                     <Button
                       key={colorOption.name}
                       type="button"
                       variant="outline"
                       size="icon"
                       className={cn(
                         "h-8 w-8 rounded-full border-2 flex items-center justify-center",
                         // Highlight if the field value matches the option's value (including undefined)
                         field.value === colorOption.value ? 'border-primary ring-2 ring-ring' : 'border-muted'
                       )}
                       style={{ backgroundColor: colorOption.value || 'hsl(var(--card))' }} // Use card background (white) if value is undefined
                       onClick={() => field.onChange(colorOption.value)} // Sets to undefined for default
                       aria-label={`Set task color to ${colorOption.name}`}
                       title={colorOption.name}
                     >
                        {/* Intentionally empty: color is shown by background */}
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
