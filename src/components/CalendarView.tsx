"use client";

import type * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Calendar as CalendarIcon } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
    restrictToVerticalAxis,
    restrictToWindowEdges,
} from '@dnd-kit/modifiers'; // Corrected import path
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Task, FileMetaData } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { Calendar } from "@/components/ui/calendar"; // Import Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover


const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

interface CalendarViewProps {
  tasks: Task[];
  deleteTask: (id: string) => void;
  updateTaskOrder: (date: string, orderedTaskIds: string[]) => void;
  toggleTaskCompletion: (id: string) => void;
  completedTasks: Set<string>;
  updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => void;
}

interface SortableTaskProps {
  task: Task;
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
  isDragging?: boolean;
  onTaskDoubleClick: (task: Task) => void;
}

// Determine max lengths based on viewport width (example breakpoints)
const getMaxLength = (limitType: 'title' | 'desc'): number => {
    const BASE_TITLE_LIMIT_SM = 10;
    const BASE_DESC_LIMIT_SM = 15;
    const BASE_TITLE_LIMIT_MD = 15;
    const BASE_DESC_LIMIT_MD = 25;
    const BASE_TITLE_LIMIT_LG = 20; // Adjust as needed for 7 columns
    const BASE_DESC_LIMIT_LG = 30; // Adjust as needed for 7 columns

    if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) { // sm screens (e.g., mobile, 1-2 columns maybe)
            return limitType === 'title' ? BASE_TITLE_LIMIT_SM : BASE_DESC_LIMIT_SM;
        } else if (window.innerWidth < 1024) { // md screens (e.g., tablet, 3-4 columns maybe)
            return limitType === 'title' ? BASE_TITLE_LIMIT_MD : BASE_DESC_LIMIT_MD;
        } else { // lg screens and up (desktop, 7 columns)
            return limitType === 'title' ? BASE_TITLE_LIMIT_LG : BASE_DESC_LIMIT_LG;
        }
    }
    // Default for SSR or if window is undefined
    return limitType === 'title' ? BASE_TITLE_LIMIT_MD : BASE_DESC_LIMIT_MD;
};


const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};


function TaskItem({ task, isCompleted, isDragging, onTaskDoubleClick }: SortableTaskProps) {
    const [titleLimit, setTitleLimit] = useState(getMaxLength('title'));
    const [descLimit, setDescLimit] = useState(getMaxLength('desc'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title'));
            setDescLimit(getMaxLength('desc'));
        };
        window.addEventListener('resize', handleResize);
        // Initial check
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = truncateText(task.description, descLimit);

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words", // Added min-h
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Ensures div takes space but content can wrap */}
              <p className={cn(
                  "text-xs font-medium break-words whitespace-normal", // Allow wrapping
                  isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                {nameDisplay}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal", // Allow wrapping
                     isCompleted && 'line-through'
                    )}
                    title={task.description}
                 >
                  {descriptionDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center space-y-0.5 shrink-0">
               <div className="h-5 w-5 flex items-center justify-center">
                  {isCompleted ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Circle className="h-3 w-3" />}
                </div>
               <div className="h-5 w-5 flex items-center justify-center">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </div>
            </div>
          </div>
        </Card>
    );
}

function SortableTask({ task, isCompleted, toggleTaskCompletion, deleteTask, onTaskDoubleClick }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease',
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging item is on top
    position: 'relative' as const // Needed for z-index to work
  };

  const [titleLimit, setTitleLimit] = useState(getMaxLength('title'));
  const [descLimit, setDescLimit] = useState(getMaxLength('desc'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title'));
            setDescLimit(getMaxLength('desc'));
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial set
        return () => window.removeEventListener('resize', handleResize);
    }, []);

  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault();
      toggleTaskCompletion(task.id);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteTask(task.id);
  }

  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = truncateText(task.description, descLimit);

  const handleDoubleClick = () => {
    onTaskDoubleClick(task);
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes} className="mb-1 touch-none" onDoubleClick={handleDoubleClick}>
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words", // Base styles, added min-h, break-words
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                 isCompleted ? 'animate-pulse border-2 border-accent' : '',
                 'transition-all duration-300 ease-in-out',
                 "relative" // Ensure relative positioning for children if needed
            )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <button
                {...listeners}
                className="cursor-grab pt-0.5 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0"
                aria-label="Drag task"
              >
                <GripVertical className="h-3 w-3" />
             </button>
             <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Ensures div takes space */}
               <p
                 className={cn(
                   "text-xs font-medium break-words whitespace-normal", // Allow wrapping
                   isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                 {nameDisplay}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal", // Allow wrapping
                     isCompleted && 'line-through'
                   )}
                   title={task.description}
                 >
                   {descriptionDisplay}
                 </p>
               )}
             </div>

            <div className="flex flex-col items-center space-y-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-green-600 hover:text-green-700 focus-visible:ring-1 focus-visible:ring-ring rounded"
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded"
                onClick={handleDeleteTask}
                aria-label="Delete task"
                disabled={isCompleted}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
}

interface TaskDetailsDialogProps {
  task: Task | null;
  onClose: () => void;
  updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => void;
}

function TaskDetailsDialog({ task, onClose, updateTaskDetails }: TaskDetailsDialogProps) {
  const [taskDetails, setTaskDetails] = useState(task?.details || '');
  const [dueDate, setDueDate] = useState<Date | undefined>(
      task?.dueDate ? parseISO(task.dueDate) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileMetaData[]>(task?.files || []); // State for file metadata


  useEffect(() => {
      // Reset state when task changes or dialog opens
      if (task) {
          setTaskDetails(task.details || '');
          setDueDate(task.dueDate ? parseISO(task.dueDate) : undefined);
          setUploadedFiles(task.files || []);
      } else {
          // Optionally reset when dialog closes (task is null)
          setTaskDetails('');
          setDueDate(undefined);
          setUploadedFiles([]);
      }
  }, [task]); // Depend on task

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
          const newFiles: FileMetaData[] = Array.from(event.target.files).map(file => ({
              name: file.name,
              type: file.type,
              size: file.size,
          }));
          // NOTE: In a real app, you'd trigger an upload here and store URLs/IDs.
          // For this example, we just store the metadata.
          setUploadedFiles(prevFiles => [...prevFiles, ...newFiles]);
          // Clear the input value to allow uploading the same file again if needed
          event.target.value = '';
      }
  };

  const removeFile = (fileName: string) => {
      setUploadedFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
      // NOTE: In a real app, you'd also trigger a delete request to your storage.
  };


  const handleSave = () => {
    if (task) {
      const updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>> = {
          details: taskDetails,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          files: uploadedFiles,
      };
      updateTaskDetails(task.id, updates);
      onClose();
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md"> {/* Adjusted width slightly */}
        <DialogHeader>
          <DialogTitle className="text-primary">Task Details: {task?.name}</DialogTitle>
          {task?.description && <p className="text-sm text-muted-foreground pt-1">{task.description}</p>}
        </DialogHeader>
        {task ? (
          <div className="grid gap-4 py-4">
              {/* Due Date Selector */}
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dueDate" className="text-right text-sm font-medium text-primary">
                    Due Date:
                  </Label>
                   <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                          <Button
                              variant={"outline"}
                              className={cn(
                                  "col-span-3 justify-start text-left font-normal h-9", // Adjusted height
                                  !dueDate && "text-muted-foreground"
                              )}
                              >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dueDate ? format(dueDate, "PPP") : <span>Pick a due date</span>}
                           </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="single"
                              selected={dueDate}
                              onSelect={(date) => {
                                  setDueDate(date);
                                  setIsCalendarOpen(false); // Close popover on date select
                              }}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
              </div>

            {/* Additional Details Textarea */}
            <div className="grid grid-cols-4 items-start gap-4"> {/* Use items-start */}
              <Label
                htmlFor="details"
                className="text-right text-sm font-medium leading-none text-primary pt-2" /* Add padding top */
              >
                Details:
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="details"
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="Add links, notes, etc."
                  className="min-h-[100px]" // Ensure decent height
                />
              </div>
            </div>

             {/* Files Upload */}
             <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="files" className="text-right text-sm font-medium text-primary">
                     Files:
                 </Label>
                 <div className="col-span-3">
                      <Input
                        id="files"
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="h-9 text-xs" // Adjusted height and text size
                      />
                       {/* Display uploaded file names */}
                       {uploadedFiles.length > 0 && (
                           <div className="mt-2 space-y-1">
                               {uploadedFiles.map(file => (
                                   <div key={file.name} className="flex items-center justify-between text-xs bg-muted p-1 rounded">
                                       <span className="truncate" title={file.name}>{file.name}</span>
                                       <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive shrink-0" onClick={() => removeFile(file.name)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                   </div>
                               ))}
                           </div>
                        )}
                  </div>
             </div>


            <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-4">
              Save Details
            </Button>
          </div>
        ) : (
          <p>No task selected.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}


export function CalendarView({ tasks, deleteTask, updateTaskOrder, toggleTaskCompletion, completedTasks, updateTaskDetails }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);


  useEffect(() => {
      setIsClient(true);
  }, []);


  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday end

  const days = useMemo(() => {
      const daysArray = [];
      let day = weekStart;
      while (day <= weekEnd) {
        daysArray.push(new Date(day));
        day = addDays(day, 1);
      }
      return daysArray;
    }, [weekStart, weekEnd]);

   const parseISOStrict = (dateString: string | undefined): Date | null => {
       if (!dateString) return null;
       const date = parseISO(dateString + 'T00:00:00');
       if (isNaN(date.getTime())) {
           console.error("Invalid date string received:", dateString);
           return null;
       }
       return date;
   }

   const tasksByDay = useMemo(() => {
       const groupedTasks: { [key: string]: Task[] } = {};
       if (!tasks || !Array.isArray(tasks)) {
           console.error("Tasks data is invalid:", tasks);
           return groupedTasks;
       }
       const safeCompletedTasks = completedTasks instanceof Set ? completedTasks : new Set<string>();


       days.forEach(day => {
           const dateStr = format(day, 'yyyy-MM-dd');
           if (isNaN(day.getTime())) {
               console.error("Invalid day generated:", day);
               groupedTasks[dateStr] = [];
               return;
           }

            const currentDayOfWeek = day.getDay(); // 0 for Sunday, 1 for Monday, etc.


           groupedTasks[dateStr] = tasks
            .filter(task => {
                if (!task || !task.date) return false;
                const taskDate = parseISOStrict(task.date);
                if (!taskDate) return false; // Skip if date is invalid


                if (task.recurring) {
                    const taskStartDayOfWeek = taskDate.getDay();
                     // Check if the current day matches the task's start day of the week AND
                    // if the current day is on or after the task's initial start date.
                    return taskStartDayOfWeek === currentDayOfWeek && day >= taskDate;
                } else {
                    return isSameDay(taskDate, day);
                }
           })
            .sort((a, b) => { // Sort within the filtered tasks for the day
                const aCompleted = safeCompletedTasks.has(a.id);
                const bCompleted = safeCompletedTasks.has(b.id);

                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1; // Completed tasks go to the bottom
                }

                // If completion status is the same, maintain original relative order *within this day*
                // This requires finding their original index *among all tasks*
                const originalAIndex = tasks.findIndex(t => t && t.id === a.id);
                const originalBIndex = tasks.findIndex(t => t && t.id === b.id);

                if (originalAIndex === -1 || originalBIndex === -1) {
                     // Should not happen if tasks are filtered correctly, but handle defensively
                     return 0;
                }

                return originalAIndex - originalBIndex;
            });
       });
       return groupedTasks;
     }, [tasks, days, completedTasks]); // Rerun when tasks, days, or completedTasks change


   const activeTask = useMemo(() => tasks.find(task => task && task.id === activeId), [tasks, activeId]);

  const sensors = useSensors(
      useSensor(PointerSensor, {
        // Require the mouse to move by 10 pixels before activating
        activationConstraint: {
          distance: 8, // Increased distance slightly
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
  );

    const modifiers = useMemo(() => [
        restrictToVerticalAxis, // Only allow vertical movement
        // restrictToParentElement // Restrict movement within the SortableContext container (day column)
        restrictToWindowEdges, // Prevent dragging outside the window entirely (fallback)
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
     setActiveId(null);


    if (over && active.id !== over.id) {
       // Determine the date string from the 'over' element's context
       // The containerId should be the date string 'yyyy-MM-dd' we set on SortableContext
       const overSortableContextId = over.data?.current?.sortable?.containerId;

        if (!overSortableContextId || typeof overSortableContextId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(overSortableContextId)) {
             console.warn("Could not determine the valid date context of the drop target.", over.data?.current?.sortable);
             return; // Don't proceed if we can't identify the target day
         }

       const overDateStr = overSortableContextId;

        // Get the current task IDs *for that specific day* from the memoized tasksByDay
        // Use optional chaining and provide a default empty array
        const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => task.id);

       // Find the old and new indices within this specific day's task list
       const oldIndex = currentTaskIdsForDate.indexOf(active.id as string);
       const newIndex = currentTaskIdsForDate.indexOf(over.id as string);


      if (oldIndex !== -1 && newIndex !== -1) {
         // Perform the array move *only on the IDs for this day*
         const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
         // Call updateTaskOrder with the specific date and the reordered list for that date
         updateTaskOrder(overDateStr, reorderedTaskIds);
      } else {
          // Handle edge case: Dragged onto the container itself (e.g., empty space) or index not found
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
           // If dropped onto the container (over.id might be the dateStr) and oldIndex is valid, move to end
           if (over.id === overDateStr && oldIndex !== -1) {
               console.log(`Task ${active.id} dropped onto container ${overDateStr}. Moving to end.`);
               const targetIndex = currentTaskIdsForDate.length; // Move to the end
               // Ensure moving from oldIndex to targetIndex-1 because arrayMove is inclusive of the target
               const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, targetIndex);
               updateTaskOrder(overDateStr, reorderedTaskIds);
           }
           // If newIndex is -1 but over.id is a task ID (shouldn't normally happen with closestCenter), log it
           else if (newIndex === -1 && currentTaskIdsForDate.includes(over.id as string)) {
               console.error(`Task ${active.id} drag failed: newIndex is -1 but over.id (${over.id}) exists.`);
           }
      }

    }
  };

  const handleDragCancel = () => {
      setActiveId(null);
  };

  const goToPreviousWeek = () => {
    setCurrentDate(subDays(weekStart, 7));
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(weekStart, 7));
  };

    const handleTaskDoubleClick = (task: Task) => {
        setSelectedTask(task);
    };

  const handleCloseTaskDetails = () => {
    setSelectedTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={modifiers} // Apply modifiers here
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Ensure containers are measured
    >
      <div className="p-1 md:p-2 w-full">
        <div className="flex items-center justify-between mb-1">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} aria-label="Previous week" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base md:text-lg font-semibold text-primary text-center flex-grow px-1">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="Next week" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full"> {/* Reduced gap */}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             const dayTasks = tasksByDay?.[dateStr] ?? []; // Use nullish coalescing for safety
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[500px] md:h-[700px] overflow-hidden", // Increased height
                  isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50 border-transparent'
                  )}>
                <CardHeader className="p-1 text-center shrink-0"> {/* Reduced padding */}
                  <CardTitle className="text-xs font-medium">
                    {format(day, 'EEE')}
                  </CardTitle>
                  <CardDescription className={cn("text-sm font-bold", isToday ? 'text-accent' : 'text-foreground')}>
                    {format(day, 'd')}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-0.5 px-1 py-0 text-[9px]">Today</Badge>}
                </CardHeader>
                <Separator className="shrink-0 my-0.5"/> {/* Reduced margin */}
                {/* Wrap SortableContext in ScrollArea */}
                <ScrollArea className="flex-grow">
                  <CardContent className="p-1 space-y-1" data-testid={`day-content-${dateStr}`}> {/* Reduced padding */}
                     {/* SortableContext needs a stable ID based on the day */}
                     <SortableContext
                         id={dateStr} // Use the date string as the stable ID for the droppable container
                         items={dayTasks.map(task => task.id)} // Provide the IDs of the sortable items
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             // Map over the tasks for this day
                             dayTasks.map((task) => (
                               <SortableTask
                                 key={task.id}
                                 task={task}
                                 isCompleted={completedTasks.has(task.id)} // Check completion status
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 deleteTask={deleteTask}
                                 onTaskDoubleClick={handleTaskDoubleClick} // Pass handler
                               />
                             ))
                         )}
                       </SortableContext>
                  </CardContent>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      </div>
        {/* DragOverlay renders the item being dragged */}
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask ? (
                <TaskItem
                    task={activeTask}
                    isCompleted={completedTasks.has(activeId)}
                    isDragging // Add a prop to style the dragged item differently
                    // Provide dummy functions or context if needed by TaskItem for display
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                    onTaskDoubleClick={() => {}}
                />
            ) : null}
        </DragOverlay>
        {/* Task Details Dialog */}
        <TaskDetailsDialog
            task={selectedTask}
            onClose={handleCloseTaskDetails}
            updateTaskDetails={updateTaskDetails} // Pass the update function
        />
    </DndContext>
  );
}
