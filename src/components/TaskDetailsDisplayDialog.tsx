
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Star, X } from 'lucide-react'; // Added X icon

import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog as ShadDialog,
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription as ShadDialogDesc,
  DialogFooter as ShadDialogFooter,
} from "@/components/ui/dialog";
import type { Task } from '@/lib/types';
import { cn, truncateText, getMaxLength } from '@/lib/utils';

interface TaskDetailsDisplayDialogProps {
  task: Task | null;
  onClose: () => void;
  updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => void;
}

export function TaskDetailsDisplayDialog({ task, onClose, updateTaskDetails }: TaskDetailsDisplayDialogProps) {
  const [taskDetails, setTaskDetails] = useState(task?.details || '');
  const [dueDate, setDueDate] = useState<Date | undefined>(
      task?.dueDate ? parseISO(task.dueDate + 'T00:00:00') : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
      if (task) {
          setTaskDetails(task.details || '');
          setDueDate(task.dueDate ? parseISO(task.dueDate + 'T00:00:00') : undefined);
      } else {
          setTaskDetails('');
          setDueDate(undefined);
      }
  }, [task]);

  const handleSave = () => {
    if (task) {
      const updates: Partial<Pick<Task, 'details' | 'dueDate'>> = {
          details: taskDetails || null,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      };
      if (updates.details !== (task.details || null) || updates.dueDate !== (task.dueDate || null))
        {
        updateTaskDetails(task.id, updates);
      }
      onClose();
    }
  };

  const dialogTitleLimit = getMaxLength('title', 'dialog');
  const dialogDescLimit = 40;
  const truncatedTitle = truncateText(task?.name, dialogTitleLimit);
  const truncatedDescription = truncateText(task?.description, dialogDescLimit);

  return (
    <ShadDialog open={!!task} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <ShadDialogContent className="sm:max-w-md">
        <ShadDialogHeader>
           <div className="flex justify-between items-start">
                <div>
                    <ShadDialogTitle className="text-primary truncate" title={task?.name}>
                        {truncatedTitle}
                    </ShadDialogTitle>
                     {task?.description && (
                        <ShadDialogDesc className="pt-1 truncate" title={task.description}>
                            <span className="line-clamp-2 break-all whitespace-normal">
                                {truncatedDescription}
                            </span>
                        </ShadDialogDesc>
                     )}
                </div>
           </div>
           {task?.date && (
                <div className="text-xs text-muted-foreground pt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span>Scheduled for: {format(parseISO(task.date + 'T00:00:00'), 'PPP')}</span>
                    {task.recurring && <Badge variant="secondary" className="text-xs">Weekly</Badge>}
                    {task.highPriority && <Badge variant="outline" className="text-xs border-accent text-accent"><Star className="h-3 w-3 mr-1 fill-accent"/>Priority</Badge>}
                </div>
           )}
        </ShadDialogHeader>
        {task ? (
          <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                   <Label htmlFor="dueDateDisplayPopover" className="text-right text-sm font-medium text-primary">
                       Due Date:
                   </Label>
                   <div className="col-span-3 flex items-center gap-2">
                       <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                           <PopoverTrigger asChild>
                               <Button
                                   id="dueDateDisplayPopover"
                                   variant={"outline"}
                                   className={cn(
                                       "flex-grow justify-start text-left font-normal h-9 truncate",
                                       !dueDate && "text-muted-foreground"
                                   )}
                                   >
                                   <CalendarIcon className="mr-2 h-4 w-4" />
                                   {dueDate ? format(dueDate, "PPP") : <span>Pick date</span>}
                               </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-auto p-0" align="start">
                               <Calendar
                                   mode="single"
                                   selected={dueDate}
                                   onSelect={(date) => {
                                       setDueDate(date); // date can be Date | undefined
                                       setIsCalendarOpen(false);
                                   }}
                                   disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                               />
                           </PopoverContent>
                       </Popover>
                        {dueDate && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setDueDate(undefined)}
                                className="h-9 w-9 flex-shrink-0"
                                aria-label="Clear due date"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                   </div>
               </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label
                htmlFor="detailsDisplay"
                className="text-right text-sm font-medium leading-none text-primary pt-2"
              >
                Details:
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="detailsDisplay"
                  value={taskDetails || ''}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="Add links, notes, etc."
                  className="min-h-[100px] max-h-[200px] overflow-y-auto"
                />
              </div>
            </div>

          </div>
        ) : (
          <p>No task selected.</p>
        )}
         <ShadDialogFooter className="pt-4">
            <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Save Details
            </Button>
          </ShadDialogFooter>
      </ShadDialogContent>
    </ShadDialog>
  );
}
