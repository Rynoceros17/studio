
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Save, Star, Palette } from 'lucide-react'; // Added Palette

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'; // Added FormDescription
import {
  Dialog as ShadDialog, // Use ShadDialog alias
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogFooter as ShadDialogFooter, // Import Footer
} from '@/components/ui/dialog';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

// Predefined pastel colors (HSL format for easy brightness/saturation control)
const pastelColors = [
  { name: 'Default', value: undefined }, // Represents default card background
  { name: 'Pink', value: 'hsl(340, 70%, 85%)' },
  { name: 'Blue', value: 'hsl(200, 70%, 85%)' },
  { name: 'Green', value: 'hsl(140, 50%, 85%)' },
  { name: 'Yellow', value: 'hsl(55, 70%, 85%)' },
  { name: 'Orange', value: 'hsl(30, 70%, 85%)' },
  { name: 'Purple', value: 'hsl(260, 60%, 88%)' }, // Similar to secondary
];

// Schema for the core editable properties, now including color
const editFormSchema = z.object({
  name: z.string().min(1, { message: "Task name is required." }),
  description: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  recurring: z.boolean().optional(),
  highPriority: z.boolean().optional(), // Add highPriority field
  color: z.string().optional(), // Add color field
});

type EditTaskFormValues = z.infer<typeof editFormSchema>;

interface EditTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  // Update signature to include color in Task Omit<>
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => void; // Function to update core task properties
}

export function EditTaskDialog({ task, isOpen, onClose, updateTask }: EditTaskDialogProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { // Initialize with empty strings or default values
      name: '',
      description: '',
      date: undefined,
      recurring: false,
      highPriority: false, // Initialize highPriority
      color: undefined, // Initialize color
    },
  });

  // Effect to reset the form when the task changes or the dialog opens/closes
  useEffect(() => {
    if (isOpen && task) {
      form.reset({
        name: task.name,
        description: task.description || '',
        date: task.date ? parseISO(task.date + 'T00:00:00') : undefined, // Ensure parsing includes time part
        recurring: task.recurring || false,
        highPriority: task.highPriority || false, // Reset highPriority
        color: task.color, // Reset color
      });
    } else if (!isOpen) {
       // Optionally reset to defaults when closing if task is null
       // form.reset({ name: '', description: '', date: undefined, recurring: false });
    }
  }, [task, isOpen, form]); // form added as dependency

  const onSubmit: SubmitHandler<EditTaskFormValues> = (data) => {
    if (task) {
      // Update signature to include color
      const updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>> = {
        name: data.name,
        description: data.description,
        date: format(data.date, 'yyyy-MM-dd'), // Format date before updating
        recurring: data.recurring,
        highPriority: data.highPriority, // Include high priority status
        color: data.color, // Include color
      };
      updateTask(task.id, updates);
      onClose(); // Close dialog after successful update
    }
  };

  // Watch the current color value from the form
  const selectedColor = form.watch('color');

  return (
    <ShadDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ShadDialogContent className="sm:max-w-md"> {/* Changed max-w to md for a bit more space */}
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
                             // removed initialFocus
                             disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} // Optional: disable past dates
                           />
                         </PopoverContent>
                      </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

             {/* Combined Recurring and High Priority Options */}
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

              {/* Color Picker */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Palette className="mr-2 h-4 w-4" /> Task Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {pastelColors.map((colorOption) => (
                          <Button
                            key={colorOption.name}
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              "h-8 w-8 rounded-full border-2",
                              field.value === colorOption.value ? 'border-primary ring-2 ring-ring' : 'border-muted' // Highlight selected
                            )}
                            style={{ backgroundColor: colorOption.value || 'hsl(var(--card))' }} // Use card background for default
                            onClick={() => field.onChange(colorOption.value)}
                            aria-label={`Set task color to ${colorOption.name}`}
                            title={colorOption.name} // Tooltip for color name
                          >
                            {/* Optionally show checkmark on selected */}
                            {/* {field.value === colorOption.value && <Check className="h-4 w-4 text-primary-foreground mix-blend-difference" />} */}
                             {!colorOption.value && <span className="text-xs text-muted-foreground">✕</span>} {/* Mark for default */}
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
          <p>Loading task details...</p> // Or some loading indicator
        )}
      </ShadDialogContent>
    </ShadDialog>
  );
}
