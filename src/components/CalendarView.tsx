
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
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil, Star } from 'lucide-react'; // Added Star back for high priority indicator
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
  type PointerActivationConstraint, // Import PointerActivationConstraint
} from '@dnd-kit/core';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Task, FileMetaData } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog as ShadDialog, // Use ShadDialog alias to avoid conflict
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription as ShadDialogDesc, // Renamed to avoid conflict
} from "@/components/ui/dialog";
import { EditTaskDialog } from './EditTaskDialog'; // Import the renamed EditTaskDialog
import { TaskDetailsDisplayDialog } from './TaskDetailsDisplayDialog'; // Import the new TaskDetailsDisplayDialog

interface CalendarViewProps {
    tasks: Task[];
    // Updated prop for initiating delete process
    requestDeleteTask: (task: Task, dateStr: string) => void;
    updateTaskOrder: (date: string, orderedTaskIds: string[]) => void;
    // Now accepts taskId and dateStr for completion logic
    toggleTaskCompletion: (taskId: string, dateStr: string) => void;
    // Set of completion keys (e.g., `${taskId}_${dateStr}`)
    completedTasks: Set<string>;
    // Removed highPriority from the updateTaskDetails type definition here
    updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => void;
}


const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

interface SortableTaskProps {
  task: Task;
  dateStr: string; // Add the specific date string for this instance of the task
  isCompleted: boolean;
  toggleTaskCompletion: (taskId: string, dateStr: string) => void; // Update signature
  // Updated prop: initiates the deletion process
  requestDeleteTask: (task: Task, dateStr: string) => void;
  isDragging?: boolean;
  onTaskClick: (task: Task) => void; // Changed from onTaskDoubleClick
  onEditClick: (task: Task) => void; // Add handler for edit click
}

// Determine max lengths based on viewport width (example breakpoints)
const getMaxLength = (limitType: 'title' | 'desc'): number => {
    const BASE_TITLE_LIMIT_SM = 10; // Mobile (e.g., 1-2 cols)
    const BASE_DESC_LIMIT_SM = 15;
    const BASE_TITLE_LIMIT_MD = 15; // Tablet (e.g., 3-4 cols)
    const BASE_DESC_LIMIT_MD = 25;
    const BASE_TITLE_LIMIT_LG = 20; // Desktop (7 cols) - Adjust based on actual column width
    const BASE_DESC_LIMIT_LG = 30; // Desktop (7 cols) - Adjust based on actual column width

    if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) { // sm screens
            return limitType === 'title' ? BASE_TITLE_LIMIT_SM : BASE_DESC_LIMIT_SM;
        } else if (window.innerWidth < 1024) { // md screens
            return limitType === 'title' ? BASE_TITLE_LIMIT_MD : BASE_DESC_LIMIT_MD;
        } else { // lg screens and up
            return limitType === 'title' ? BASE_TITLE_LIMIT_LG : BASE_DESC_LIMIT_LG;
        }
    }
    // Default for SSR or if window is undefined
    return limitType === 'title' ? BASE_TITLE_LIMIT_LG : BASE_DESC_LIMIT_LG; // Default to desktop
};


const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};


function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
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
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words border", // Added border for base styling
            isCompleted
              ? 'bg-muted opacity-60 border-transparent' // Completed styling - removed gold border
              : task.highPriority
                ? 'bg-card border-accent border-2' // High priority, not completed: white bg, gold border
                : 'bg-card border-border',      // Default background and border
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
                {/* Optional: Add a visual indicator for high priority within the card */}
                {task.highPriority && !isCompleted && <Star className="inline-block h-3 w-3 ml-1 text-accent fill-accent" />}
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
               {/* Edit and Delete Icons Placeholder for DragOverlay */}
               <div className="h-5 w-5 flex items-center justify-center">
                 <Pencil className="h-3 w-3 text-muted-foreground" />
               </div>
               <div className="h-5 w-5 flex items-center justify-center">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </div>
            </div>
          </div>
        </Card>
    );
}

function SortableTask({ task, dateStr, isCompleted, toggleTaskCompletion, requestDeleteTask, onTaskClick, onEditClick }: SortableTaskProps) {
  const [isCompletedAnim, setIsCompletedAnim] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${task.id}_${dateStr}` }); // Unique ID per task instance on a date


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

    // Trigger animation when isCompleted changes to true
     useEffect(() => {
         if (isCompleted && !isCompletedAnim) {
           setIsCompletedAnim(true);
           // Remove animation class after duration
           const timer = setTimeout(() => setIsCompletedAnim(false), 500); // Match animation duration
           return () => clearTimeout(timer);
         }
       }, [isCompleted, isCompletedAnim]); // Depend on isCompleted and isCompletedAnim

  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent click event propagation
      toggleTaskCompletion(task.id, dateStr); // Pass both task ID and date string
  };

  // Updated to use requestDeleteTask
  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click event propagation
    requestDeleteTask(task, dateStr); // Initiate deletion process with task and date
  }

    const handleEditClickInternal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent click event propagation
        onEditClick(task);
    };


  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = truncateText(task.description, descLimit);

  const handleClick = () => {
    onTaskClick(task); // Use single click handler
  };

  return (
    <div
        ref={setNodeRef}
        style={style}
        data-testid={`task-${task.id}-${dateStr}`} // Use unique test ID
        {...attributes} // Keep dnd attributes here
        className="mb-1 touch-none" // Added touch-none
        onClick={handleClick}
    >
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words cursor-pointer border", // Base styles + border
                isCompleted
                  ? 'bg-muted opacity-60 border-transparent' // Completed style - removed gold border
                  : task.highPriority
                    ? 'bg-card border-accent border-2' // High priority, not completed: white bg, gold border
                    : 'bg-card border-border',       // Default background and border
                isCompletedAnim && 'animate-task-complete', // Apply animation when completing
                'transition-all duration-300 ease-in-out'
            )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <button
                {...listeners} // Apply drag listeners only to the handle
                className="cursor-grab pt-0.5 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0"
                aria-label="Drag task"
                onClick={(e) => e.stopPropagation()} // Prevent card click when dragging
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
                 {/* Optional: Add a visual indicator for high priority within the card */}
                 {task.highPriority && !isCompleted && <Star className="inline-block h-3 w-3 ml-1 text-accent fill-accent" />}
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
                className="h-5 w-5 text-primary hover:text-primary/80 focus-visible:ring-1 focus-visible:ring-ring rounded"
                onClick={handleEditClickInternal} // Use internal handler
                aria-label="Edit task details"
               >
                 <Pencil className="h-3 w-3" />
               </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded"
                onClick={handleDeleteTask} // Use the updated handler
                aria-label="Delete task"
                // disabled={isCompleted} // Removing disable on complete for now
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
}


export function CalendarView({
    tasks,
    requestDeleteTask, // Use the new prop
    updateTaskOrder,
    toggleTaskCompletion,
    completedTasks, // This is now a Set of completion keys `${taskId}_${dateStr}`
    updateTaskDetails,
    updateTask // Destructure new prop
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null); // Can be `${taskId}_${dateStr}`
  const [isClient, setIsClient] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null); // State for task being edited
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog visibility


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
       // Ensure the input is just the date part before appending time
       const datePart = dateString.split('T')[0];
       const date = parseISO(datePart + 'T00:00:00'); // Add time part for consistent parsing
       if (isNaN(date.getTime())) {
           console.error("Invalid date string received:", dateString);
           return null; // Return null for invalid dates
       }
       return date;
   }

   const tasksByDay = useMemo(() => {
       const groupedTasks: { [key: string]: Task[] } = {};
       if (!tasks || !Array.isArray(tasks)) {
           console.error("Tasks data is invalid:", tasks);
           return groupedTasks;
       }

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

                // Skip if the task has an exception for this specific date
                if (task.exceptions?.includes(dateStr)) {
                    return false;
                }

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
                 // Check completion status for this specific day instance
                 const aCompletionKey = `${a.id}_${dateStr}`;
                 const bCompletionKey = `${b.id}_${dateStr}`;
                 const aCompleted = completedTasks.has(aCompletionKey);
                 const bCompleted = completedTasks.has(bCompletionKey);


                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1; // Completed tasks go to the bottom
                }

                // If completion status is the same, prioritize high priority tasks if not completed
                if (!aCompleted && !bCompleted) {
                    if (a.highPriority !== b.highPriority) {
                        return a.highPriority ? -1 : 1; // High priority tasks go to the top
                    }
                }


                // If completion status and priority are the same, maintain original relative order *within this day*
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
     }, [tasks, days, completedTasks, parseISOStrict]); // Rerun when tasks, days, or completedTasks change


    // Find the active task based on the original taskId part of activeId
    const activeTask = useMemo(() => {
        if (!activeId) return null;
        const taskId = activeId.split('_')[0]; // Extract original task ID
        return tasks.find(task => task && task.id === taskId);
    }, [tasks, activeId]);


   // Configure pointer sensor for drag-and-drop activation
   // Adjust activation constraints if needed
   const pointerSensor = useSensor(PointerSensor, {
       activationConstraint: {
         distance: 5, // Start dragging after moving 5 pixels
         // delay: 150, // Optional: start drag after 150ms press
         // tolerance: 5, // Optional: allow 5px tolerance before activation
       } satisfies PointerActivationConstraint,
     });

   // Configure keyboard sensor
   const keyboardSensor = useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     });

   const sensors = useSensors(pointerSensor, keyboardSensor);


    const modifiers = useMemo(() => [
        restrictToVerticalAxis, // Only allow vertical movement
        restrictToWindowEdges, // Prevent dragging outside the window entirely (fallback)
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string); // active.id is now `${taskId}_${dateStr}`
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = active.id as string;
    const overIdStr = over?.id as string | undefined;

    setActiveId(null);

    if (over && overIdStr && activeIdStr !== overIdStr) {
        // Extract date string from the active element's ID
        const activeDateStr = activeIdStr.substring(activeIdStr.lastIndexOf('_') + 1);
        // Determine the date string from the 'over' element's context
        const overSortableContextId = over.data?.current?.sortable?.containerId;

        if (!overSortableContextId || typeof overSortableContextId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(overSortableContextId)) {
             console.warn("Could not determine the valid date context of the drop target.", over.data?.current?.sortable);
             return; // Don't proceed if we can't identify the target day
         }

        const overDateStr = overSortableContextId;

        // Ensure drag happens within the same day column for simplicity
        if (activeDateStr !== overDateStr) {
            console.log("Drag across different days is not supported yet.");
            return;
        }

        // Get the current task IDs *for that specific day* from the memoized tasksByDay
        const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => `${task.id}_${overDateStr}`); // Use unique instance IDs

        // Find the old and new indices using the unique instance IDs
        const oldIndex = currentTaskIdsForDate.indexOf(activeIdStr);
        const newIndex = currentTaskIdsForDate.indexOf(overIdStr);


        if (oldIndex !== -1 && newIndex !== -1) {
            // Perform the array move *only on the unique instance IDs for this day*
            const reorderedInstanceIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
             // Extract the original task IDs in the new order
            const reorderedTaskIds = reorderedInstanceIds.map(instanceId => instanceId.split('_')[0]);
            // Call updateTaskOrder with the specific date and the reordered list of original task IDs
            updateTaskOrder(overDateStr, reorderedTaskIds);
        } else {
            // Handle edge case: Dragged onto the container itself or index not found
            console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task instance ${activeIdStr} in date ${overDateStr}`);
             // If dropped onto the container (over.id might be the dateStr) and oldIndex is valid, move to end
             if (overIdStr === overDateStr && oldIndex !== -1) {
                  console.log(`Task ${activeIdStr} dropped onto container ${overDateStr}. Moving to end.`);
                  const targetIndex = currentTaskIdsForDate.length; // Move to the end
                  const reorderedInstanceIds = arrayMove(currentTaskIdsForDate, oldIndex, targetIndex);
                  const reorderedTaskIds = reorderedInstanceIds.map(instanceId => instanceId.split('_')[0]);
                  updateTaskOrder(overDateStr, reorderedTaskIds);
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

    const handleTaskClick = (task: Task) => {
        setSelectedTaskForDetails(task);
    };

    const handleEditClick = (task: Task) => {
        setEditingTask(task);
        setIsEditDialogOpen(true); // Open the edit dialog
    };


  const handleCloseTaskDetails = () => {
    setSelectedTaskForDetails(null);
  };

   const handleCloseEditDialog = () => {
      setEditingTask(null);
      setIsEditDialogOpen(false);
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
             // Ensure tasksByDay is accessed only after initialization and is an object
            const dayTasks = (isClient && tasksByDay && typeof tasksByDay === 'object' && tasksByDay[dateStr]) ? tasksByDay[dateStr] : [];
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
                         // items need to be unique per instance: `${taskId}_${dateStr}`
                         items={dayTasks.map(task => `${task.id}_${dateStr}`)}
                         strategy={verticalListSortingStrategy}
                       >
                         {!isClient || dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             // Map over the tasks for this day
                             dayTasks.map((task) => {
                                const completionKey = `${task.id}_${dateStr}`;
                                return (
                                   <SortableTask
                                     key={`${task.id}_${dateStr}`} // Unique key per instance
                                     task={task}
                                     dateStr={dateStr} // Pass the date string
                                     isCompleted={completedTasks?.has(completionKey) ?? false} // Check completion using the key
                                     toggleTaskCompletion={toggleTaskCompletion}
                                     requestDeleteTask={requestDeleteTask} // Pass the request delete function
                                     onTaskClick={handleTaskClick}
                                     onEditClick={handleEditClick} // Pass edit handler
                                   />
                                );
                             })
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
            {activeId && activeTask ? (() => {
                const activeDateStr = activeId.substring(activeId.lastIndexOf('_') + 1);
                const completionKey = `${activeTask.id}_${activeDateStr}`;
                const isCompleted = completedTasks?.has(completionKey) ?? false;
                return (
                    <TaskItem
                        task={activeTask}
                        dateStr={activeDateStr}
                        isCompleted={isCompleted}
                        isDragging // Add a prop to style the dragged item differently
                        // Provide dummy functions or context if needed by TaskItem for display
                        toggleTaskCompletion={() => {}}
                        requestDeleteTask={() => {}} // Pass dummy request delete
                        onTaskClick={() => {}}
                        onEditClick={() => {}} // Add dummy edit handler
                    />
                );
            })() : null}
        </DragOverlay>

        {/* Task Details Display Dialog (for single click) */}
        <TaskDetailsDisplayDialog
            task={selectedTaskForDetails}
            onClose={handleCloseTaskDetails}
            updateTaskDetails={updateTaskDetails}
        />
         {/* Edit Task Dialog (for edit icon click) */}
        <EditTaskDialog
            task={editingTask}
            isOpen={isEditDialogOpen}
            onClose={handleCloseEditDialog}
            updateTask={updateTask} // Pass the core update function
        />
    </DndContext>
  );
}
