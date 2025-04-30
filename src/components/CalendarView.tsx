
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
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil, Star, Palette, MoveLeft, MoveRight } from 'lucide-react'; // Added Palette, MoveLeft, MoveRight
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
  rectIntersection, // Import rectIntersection for dragging between columns
} from '@dnd-kit/core';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
  restrictToFirstScrollableAncestor // Add this modifier
} from '@dnd-kit/modifiers';
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
import { cn, truncateText, getMaxLength } from '@/lib/utils'; // Import truncateText and getMaxLength from utils
import {
  Dialog as ShadDialog, // Use ShadDialog alias to avoid conflict
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription as ShadDialogDesc, // Renamed to avoid conflict
} from "@/components/ui/dialog";
import { EditTaskDialog } from './EditTaskDialog'; // Import the renamed EditTaskDialog
import { TaskDetailsDisplayDialog } from './TaskDetailsDisplayDialog'; // Import the new TaskDetailsDisplayDialog
import { useToast } from "@/hooks/use-toast"; // Import useToast

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
    // Update task signature to include color
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => void;
    completedCount: number; // Add completedCount prop
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
  onMoveTask: (taskId: string, direction: 'prev' | 'next') => void; // Add move handler
}


function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
    const [titleLimit, setTitleLimit] = useState(getMaxLength('title', 'calendar'));
    const [descLimit, setDescLimit] = useState(getMaxLength('desc', 'calendar'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title', 'calendar'));
            setDescLimit(getMaxLength('desc', 'calendar'));
        };
        window.addEventListener('resize', handleResize);
        // Initial check
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = truncateText(task.description, descLimit);
    const taskBackgroundColor = task.color; // Get color from task

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words border", // Added border for base styling
            isCompleted
              ? 'bg-muted opacity-60 border-transparent' // Completed styling - removed gold border
              : task.highPriority
                ? 'bg-card border-accent border-2' // High priority, not completed: white bg, gold border
                : 'border-border',      // Default border
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
           // Apply background color dynamically, falling back to card default
           style={{ backgroundColor: !isCompleted ? taskBackgroundColor : undefined }}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Ensures div takes space but content can wrap */}
              <p className={cn(
                  "text-xs font-medium break-words whitespace-normal line-clamp-1", // Allow wrapping, Limit to 1 line
                  isCompleted && 'line-through',
                  taskBackgroundColor && !isCompleted && 'text-primary-foreground mix-blend-hard-light' // Adjust text color for contrast on custom background
                 )}
                 title={task.name}
               >
                {nameDisplay}
                {/* Optional: Add a visual indicator for high priority within the card */}
                {task.highPriority && !isCompleted && <Star className="inline-block h-3 w-3 ml-1 text-accent fill-accent" />}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal line-clamp-2", // Allow wrapping, Limit to 2 lines
                     isCompleted && 'line-through',
                     taskBackgroundColor && !isCompleted && 'text-primary-foreground/80 mix-blend-hard-light' // Adjust muted text color
                    )}
                    title={task.description}
                 >
                  {descriptionDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center space-y-0.5 shrink-0">
               <div className="h-5 w-5 flex items-center justify-center">
                  {/* Adjust icon colors based on background */}
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

function SortableTask({ task, dateStr, isCompleted, toggleTaskCompletion, requestDeleteTask, onTaskClick, onEditClick, onMoveTask }: SortableTaskProps) {
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

  const [titleLimit, setTitleLimit] = useState(getMaxLength('title', 'calendar'));
  const [descLimit, setDescLimit] = useState(getMaxLength('desc', 'calendar'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title', 'calendar'));
            setDescLimit(getMaxLength('desc', 'calendar'));
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial set
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Trigger animation when isCompleted changes
     useEffect(() => {
         let timer: NodeJS.Timeout | null = null;
         if (isCompleted) {
             setIsCompletedAnim(true);
             // Remove animation class after duration to allow revert styles if needed
             timer = setTimeout(() => setIsCompletedAnim(false), 500); // Match animation duration
         } else {
            // Explicitly remove class if marked incomplete
            setIsCompletedAnim(false);
         }

         return () => {
             if (timer) clearTimeout(timer);
         };
       }, [isCompleted]); // Depend only on isCompleted


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

    const handleMoveClick = (e: React.MouseEvent, direction: 'prev' | 'next') => {
        e.preventDefault();
        e.stopPropagation();
        onMoveTask(task.id, direction);
    };


  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = truncateText(task.description, descLimit);
  const taskBackgroundColor = task.color; // Get color from task

  const handleClick = () => {
    onTaskClick(task); // Use single click handler
  };

  return (
    <div
        ref={setNodeRef}
        style={style}
        data-testid={`task-${task.id}-${dateStr}`} // Use unique test ID
        {...attributes} // Keep dnd attributes here
        className="mb-1 touch-none relative group" // Added relative and group for chevron positioning
        onClick={handleClick}
    >
        {/* Previous Day Chevron */}
        <Button
            variant="ghost"
            size="icon"
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            onClick={(e) => handleMoveClick(e, 'prev')}
            aria-label="Move task to previous day"
            // Prevent drag initiation when clicking chevron
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <MoveLeft className="h-4 w-4" />
        </Button>

        {/* Task Card */}
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words cursor-pointer border", // Base styles + border
                isCompleted
                  ? 'bg-muted opacity-60 border-transparent' // Completed style - removed gold border
                  : task.highPriority
                    ? 'border-accent border-2' // High priority, not completed: gold border
                    : 'border-border',       // Default border
                isCompletedAnim && 'animate-task-complete', // Apply animation when completing
                'transition-all duration-300 ease-in-out'
            )}
             // Apply background color dynamically, falling back to card default if no color set or completed
            style={{ backgroundColor: !isCompleted ? taskBackgroundColor : undefined }}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <button
                {...listeners} // Apply drag listeners only to the handle
                className={cn(
                    "cursor-grab pt-0.5 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0",
                    taskBackgroundColor && !isCompleted && 'text-primary-foreground/80 hover:text-primary-foreground' // Adjust handle color
                )}
                aria-label="Drag task"
                onClick={(e) => e.stopPropagation()} // Prevent card click when dragging
              >
                <GripVertical className="h-3 w-3" />
             </button>
             <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Ensures div takes space */}
               <p
                 className={cn(
                   "text-xs font-medium break-words whitespace-normal line-clamp-1", // Allow wrapping, Limit to 1 line
                   isCompleted && 'line-through',
                   taskBackgroundColor && !isCompleted && 'text-primary-foreground mix-blend-hard-light' // Adjust text color
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
                     "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal line-clamp-2", // Allow wrapping, Limit to 2 lines
                     isCompleted && 'line-through',
                     taskBackgroundColor && !isCompleted && 'text-primary-foreground/80 mix-blend-hard-light' // Adjust muted text color
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
                className={cn(
                    "h-5 w-5 text-green-600 hover:text-green-700 focus-visible:ring-1 focus-visible:ring-ring rounded",
                    taskBackgroundColor && !isCompleted && 'text-primary-foreground/80 hover:text-primary-foreground' // Adjust button color
                )}
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                 className={cn(
                    "h-5 w-5 text-primary hover:text-primary/80 focus-visible:ring-1 focus-visible:ring-ring rounded",
                    taskBackgroundColor && !isCompleted && 'text-primary-foreground/80 hover:text-primary-foreground' // Adjust button color
                )}
                onClick={handleEditClickInternal} // Use internal handler
                aria-label="Edit task details"
               >
                 <Pencil className="h-3 w-3" />
               </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded",
                    taskBackgroundColor && !isCompleted && 'text-red-300 hover:text-red-200' // Adjust button color
                )}
                onClick={handleDeleteTask} // Use the updated handler
                aria-label="Delete task"
                // disabled={isCompleted} // Removing disable on complete for now
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Next Day Chevron */}
        <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            onClick={(e) => handleMoveClick(e, 'next')}
            aria-label="Move task to next day"
             // Prevent drag initiation when clicking chevron
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <MoveRight className="h-4 w-4" />
        </Button>
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
    updateTask, // Destructure new prop
    completedCount, // Destructure completedCount
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null); // Can be `${taskId}_${dateStr}` or just `${dateStr}` for container
  const [isClient, setIsClient] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null); // State for task being edited
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog visibility
  const { toast } = useToast(); // Get toast function

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

   const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
       if (!dateString) return null;
       // Ensure the input is just the date part before appending time
       const datePart = dateString.split('T')[0];
       const date = parseISO(datePart + 'T00:00:00'); // Add time part for consistent parsing
       if (isNaN(date.getTime())) {
           console.error("Invalid date string received:", dateString);
           return null; // Return null for invalid dates
       }
       return date;
   }, []); // Added useCallback with empty dependency array


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
       // restrictToVerticalAxis, // Allow horizontal movement now
       restrictToFirstScrollableAncestor, // Keep within the scrollable day column
       restrictToWindowEdges, // Prevent dragging outside the window entirely (fallback)
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string); // active.id is now `${taskId}_${dateStr}`
  };


   const handleDragEnd = (event: DragEndEvent) => {
       const { active, over } = event;
       const activeIdStr = active.id as string; // e.g., "taskId_2024-05-15"
       const overIdStr = over?.id as string | undefined; // e.g., "otherTaskId_2024-05-16" or "2024-05-16" (container)

       setActiveId(null);

       if (!over || !overIdStr) {
           console.log("Drag ended outside a valid target.");
           return; // No valid drop target
       }

       const [activeTaskId, activeDateStr] = activeIdStr.split('_');

       // Determine the target date string
       let overDateStr: string;
       let isOverContainer = false;

       // Check if 'over' is a task or a container (date string)
       if (overIdStr.includes('_')) {
           // Dropped onto another task
           overDateStr = overIdStr.split('_')[1];
       } else if (/^\d{4}-\d{2}-\d{2}$/.test(overIdStr)) {
           // Dropped onto a date container
           overDateStr = overIdStr;
           isOverContainer = true;
       } else {
           console.warn("Invalid drop target ID:", overIdStr);
           return; // Invalid target ID format
       }

       // Get the original task object
       const taskToMove = tasks.find(task => task.id === activeTaskId);
       if (!taskToMove) {
           console.error("Could not find task to move:", activeTaskId);
           return;
       }

       // Case 1: Dragging within the same day column (reordering)
       if (activeDateStr === overDateStr) {
           console.log(`Reordering task ${activeTaskId} within ${activeDateStr}`);
           const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => `${task.id}_${overDateStr}`); // Use unique instance IDs

           const oldIndex = currentTaskIdsForDate.indexOf(activeIdStr);
            // If dropping onto container, newIndex is end. Otherwise, find index of item dropped over.
           const newIndex = isOverContainer ? currentTaskIdsForDate.length : currentTaskIdsForDate.indexOf(overIdStr);

           if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
               const reorderedInstanceIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
               const reorderedTaskIds = reorderedInstanceIds.map(instanceId => instanceId.split('_')[0]);
               updateTaskOrder(overDateStr, reorderedTaskIds);
           } else {
                console.warn(`Could not reorder: oldIndex=${oldIndex}, newIndex=${newIndex}, activeId=${activeIdStr}, overId=${overIdStr}`);
           }
       }
       // Case 2: Dragging to a different day column (changing date)
       else {
            console.log(`Moving task ${activeTaskId} from ${activeDateStr} to ${overDateStr}`);

           // Check if the task is recurring
            if (taskToMove.recurring) {
                // For recurring tasks, add an exception for the original date
                 const updatedExceptions = [...(taskToMove.exceptions || []), activeDateStr];
                 // Create a *new* non-recurring task for the target date
                 const newTaskData: Omit<Task, 'id'> = {
                     ...taskToMove,
                     date: overDateStr,
                     recurring: false, // New task is not recurring
                     exceptions: [], // New task has no exceptions initially
                 };
                  // Call updateTask to add the exception to the original
                 updateTask(activeTaskId, { exceptions: updatedExceptions });

                 // Call addTask (assuming it exists on the parent component) to create the new task
                 // Need to lift addTask up or pass it down
                 // For now, log that addTask needs to be called
                  console.warn("Need to call 'addTask' to create new instance for recurring task move.");
                  toast({
                    title: "Recurring Task Moved (Instance)",
                    description: `Added an exception for "${taskToMove.name}" on ${format(parseISOStrict(activeDateStr) ?? new Date(), 'PPP')} and created a new instance on ${format(parseISOStrict(overDateStr) ?? new Date(), 'PPP')}.`,
                    variant: "default",
                  });
                  // If addTask was available:
                  // addTask(newTaskData);

                  // Remove completion status for the original date instance if it existed
                   toggleTaskCompletion(activeTaskId, activeDateStr); // Toggles it off if it was on


            } else {
                 // For non-recurring tasks, simply update the date
                 updateTask(activeTaskId, { date: overDateStr });
                  toast({
                    title: "Task Moved",
                    description: `"${taskToMove.name}" moved to ${format(parseISOStrict(overDateStr) ?? new Date(), 'PPP')}.`,
                    variant: "default",
                 });
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

    // Function to handle moving a task to the previous or next day
    const handleMoveTask = useCallback((taskId: string, direction: 'prev' | 'next') => {
        const taskToMove = tasks.find(t => t.id === taskId);
        if (!taskToMove || !taskToMove.date) return;

        const currentDate = parseISOStrict(taskToMove.date);
        if (!currentDate) return;

        const targetDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');

         let message = '';
         let title = '';

        // Handle recurring tasks differently: Add exception and create new instance
        if (taskToMove.recurring) {
             const originalDateStr = format(currentDate, 'yyyy-MM-dd');
             const updatedExceptions = [...(taskToMove.exceptions || []), originalDateStr];

             // Create a new, non-recurring task for the target date
              const newTaskData: Omit<Task, 'id'> = {
                  ...taskToMove,
                  date: targetDateStr,
                  recurring: false,
                  exceptions: [],
              };

             // Update original recurring task with the exception
             updateTask(taskId, { exceptions: updatedExceptions });

             // TODO: Call addTask here if lifted up from page.tsx
              console.warn("Need to call 'addTask' to create new instance for recurring task move via chevron.");
              title = "Recurring Task Moved (Instance)";
              message = `Skipped "${taskToMove.name}" for ${format(currentDate, 'PPP')} and created a new one for ${format(targetDate, 'PPP')}.`;

             // Remove completion status for the original date instance if it existed
              const completionKey = `${taskId}_${originalDateStr}`;
              if (completedTasks.has(completionKey)) {
                   toggleTaskCompletion(taskId, originalDateStr); // This toggles it off
              }

        } else {
             // Simple update for non-recurring tasks
             updateTask(taskId, { date: targetDateStr });
             title = "Task Moved";
             message = `"${taskToMove.name}" moved to ${format(targetDate, 'PPP')}.`;
        }

         toast({
             title: title,
             description: message,
         });
     }, [tasks, updateTask, parseISOStrict, toast, completedTasks, toggleTaskCompletion]); // Added dependencies


  return (
    <DndContext
      sensors={sensors}
      // Use rectIntersection for better detection when dragging between columns
      collisionDetection={rectIntersection}
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
          {/* Center the date range and add completed count badge */}
          <div className="flex-grow text-center flex items-center justify-center gap-2">
              <h2 className="text-base md:text-lg font-semibold text-primary">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
              {/* Render counter only on client */}
              {isClient && (
                <Badge variant="secondary" className="ml-2 flex items-center gap-1.5 px-2 py-1 text-xs">
                  <Star className="h-3 w-3" /> {/* Assuming CheckSquare was meant to be Star or similar */}
                  {completedCount} Completed
                </Badge>
              )}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="Next week" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full"> {/* Reduced gap */}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             // Ensure tasksByDay is accessed only after initialization and is an object
             // Initialize dayTasks safely
             const dayTasks = (isClient && tasksByDay && typeof tasksByDay === 'object' && Array.isArray(tasksByDay[dateStr])) ? tasksByDay[dateStr] : [];
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[700px] md:h-[700px] overflow-hidden", // Increased height
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
                  <CardContent className="p-1 space-y-1 h-full" data-testid={`day-content-${dateStr}`}> {/* Reduced padding, ensure h-full */}
                     {/* SortableContext needs a stable ID based on the day */}
                     <SortableContext
                         id={dateStr} // Use the date string as the stable ID for the droppable container
                         // items need to be unique per instance: `${taskId}_${dateStr}`
                         items={dayTasks.map(task => `${task.id}_${dateStr}`)}
                         strategy={verticalListSortingStrategy}
                       >
                         {!isClient ? (
                            <p className="text-[10px] text-muted-foreground text-center pt-4">Loading...</p> // Show loading state during SSR or hydration
                         ) : dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             // Map over the tasks for this day
                             dayTasks.map((task) => {
                                if (!task) return null; // Add a null check for safety
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
                                     onMoveTask={handleMoveTask} // Pass move handler
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
            {activeId && activeTask && activeId.includes('_') ? (() => { // Ensure activeId is a task ID
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
                        onMoveTask={() => {}} // Add dummy move handler
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

    