
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Trash2, Paperclip, Star } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge"; // Import Badge
import {
  Dialog as ShadDialog, // Renamed to avoid conflict
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription as ShadDialogDesc, // Renamed to avoid conflict
  DialogFooter as ShadDialogFooter, // Added Footer
} from "@/components/ui/dialog";
import type { Task, FileMetaData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TaskDetailsDisplayDialogProps {
  task: Task | null;
  onClose: () => void;
  updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => void;
}

export function TaskDetailsDisplayDialog({ task, onClose, updateTaskDetails }: TaskDetailsDisplayDialogProps) {
  const [taskDetails, setTaskDetails] = useState(task?.details || '');
  const [dueDate, setDueDate] = useState<Date | undefined>(
      task?.dueDate ? parseISO(task.dueDate + 'T00:00:00') : undefined // Ensure time part for parsing
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileMetaData[]>(task?.files || []); // State for file metadata

  // Effect to update internal state when the task prop changes
  useEffect(() => {
      if (task) {
          setTaskDetails(task.details || '');
          setDueDate(task.dueDate ? parseISO(task.dueDate + 'T00:00:00') : undefined);
          setUploadedFiles(task.files || []);
      } else {
          // Reset state when dialog closes (task is null)
          setTaskDetails('');
          setDueDate(undefined);
          setUploadedFiles([]);
      }
  }, [task]); // Depend only on task

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
          const newFiles: FileMetaData[] = Array.from(event.target.files).map(file => ({
              name: file.name,
              type: file.type,
              size: file.size,
          }));
          setUploadedFiles(prevFiles => [...prevFiles, ...newFiles]);
          event.target.value = '';
      }
  };

  const removeFile = (fileName: string) => {
      setUploadedFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
  };

  const handleSave = () => {
    if (task) {
      const updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>> = {
          details: taskDetails,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          files: uploadedFiles,
      };
      if (updates.details !== task.details ||
          updates.dueDate !== task.dueDate ||
          JSON.stringify(updates.files) !== JSON.stringify(task.files))
        {
        updateTaskDetails(task.id, updates);
      }
      onClose();
    }
  };

  return (
    <ShadDialog open={!!task} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <ShadDialogContent className="sm:max-w-md">
        <ShadDialogHeader>
           <div className="flex justify-between items-start">
                <div>
                    <ShadDialogTitle className="text-primary">{task?.name}</ShadDialogTitle>
                     {task?.description && <ShadDialogDesc className="pt-1">{task.description}</ShadDialogDesc>}
                </div>
           </div>
           {task?.date && (
                <div className="text-xs text-muted-foreground pt-1">
                    Scheduled for: {format(parseISO(task.date + 'T00:00:00'), 'PPP')}
                    {task.recurring && <Badge variant="secondary" className="ml-2 text-xs">Weekly</Badge>}
                    {task.highPriority && <Badge variant="outline" className="ml-2 text-xs border-accent text-accent"><Star className="h-3 w-3 mr-1 fill-accent"/>Priority</Badge>}
                </div>
           )}
        </ShadDialogHeader>
        {task ? (
          <div className="grid gap-4 py-4">

              {/* Due Date Selector - Using grid for alignment */}
               <div className="grid grid-cols-4 items-center gap-4"> {/* Use items-center */}
                   <Label htmlFor="dueDateDisplay" className="text-right text-sm font-medium text-primary">
                       Due Date:
                   </Label>
                   <div className="col-span-3">
                       <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                           <PopoverTrigger asChild>
                               <Button
                                   id="dueDateDisplay"
                                   variant={"outline"}
                                   className={cn(
                                       "w-full justify-start text-left font-normal h-9", // Keep h-9, w-full controlled by grid
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
                                       setDueDate(date);
                                       setIsCalendarOpen(false);
                                   }}
                                   disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                               />
                           </PopoverContent>
                       </Popover>
                   </div>
               </div>

            {/* Additional Details Textarea */}
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
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="Add links, notes, etc."
                  className="min-h-[100px]"
                />
              </div>
            </div>

             {/* Files Upload */}
             <div className="grid grid-cols-4 items-start gap-4">
                 <Label htmlFor="filesDisplay" className="text-right text-sm font-medium text-primary pt-2">
                    Files:
                 </Label>
                 <div className="col-span-3">
                      <Label htmlFor="file-upload-input" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer h-9 text-xs w-full flex items-center justify-center")}>
                         <Paperclip className="mr-2 h-3 w-3" /> Attach Files
                       </Label>
                      <Input
                        id="file-upload-input"
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                       {uploadedFiles.length > 0 && (
                           <div className="mt-2 space-y-1 max-h-24 overflow-y-auto border rounded p-1">
                               {uploadedFiles.map(file => (
                                   <div key={file.name} className="flex items-center justify-between text-xs bg-muted/50 p-1 rounded">
                                       <span className="truncate mr-1" title={file.name}>{file.name}</span>
                                       <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive shrink-0" onClick={() => removeFile(file.name)} aria-label={`Remove file ${file.name}`}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                   </div>
                               ))}
                           </div>
                        )}
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

