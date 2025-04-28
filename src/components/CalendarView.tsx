
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
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil } from 'lucide-react'; // Added Pencil
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
  PointerActivationConstraint, // Import PointerActivationConstraint
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

import { Button } from '@/components/ui/button';
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
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
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

function SortableTask({ task, isCompleted, toggleTaskCompletion, deleteTask, onTaskClick, onEditClick }: SortableTaskProps) {
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
      e.stopPropagation(); // Prevent click event propagation
      toggleTaskCompletion(task.id);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click event propagation
    deleteTask(task.id);
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
        data-testid={`task-${task.id}`}
        {...attributes} // Keep dnd attributes here
        className="mb-1 touch-none"
        onClick={handleClick} // Changed from onDoubleClick
    >
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words cursor-pointer", // Added cursor-pointer
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                // Removed gold border animation: isCompleted ? 'animate-pulse border-2 border-accent' : '',
                'transition-all duration-300 ease-in-out',
                "relative" // Ensure relative positioning for children if needed
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
                onClick={handleDeleteTask}
                aria-label="Delete task"
                disabled={isCompleted} // Optionally disable delete for completed tasks
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
    deleteTask,
    updateTaskOrder,
    toggleTaskCompletion,
    completedTasks,
    updateTaskDetails,
    updateTask // Destructure new prop
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
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
       // Ensure completedTasks is a Set before using .has()
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
     }, [tasks, days, completedTasks, parseISOStrict]); // Rerun when tasks, days, or completedTasks change


   const activeTask = useMemo(() => tasks.find(task => task && task.id === activeId), [tasks, activeId]);

   // Configure pointer sensor for drag-and-drop activation
   const pointerSensor = useSensor(PointerSensor, {
       activationConstraint: {
         distance: 5, // Start dragging after moving 5 pixels
       } satisfies PointerActivationConstraint, // Use PointerActivationConstraint type
     });

   // Configure keyboard sensor
   const keyboardSensor = useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     });

   const sensors = useSensors(pointerSensor, keyboardSensor);


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

    const handleTaskClick = (task: Task) => { // Changed from handleTaskDoubleClick
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
             const dayTasks = (tasksByDay && typeof tasksByDay === 'object' && tasksByDay[dateStr]) ? tasksByDay[dateStr] : [];
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
                                 isCompleted={completedTasks?.has(task.id) ?? false} // Check completion status safely
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 deleteTask={deleteTask}
                                 onTaskClick={handleTaskClick} // Changed from onTaskDoubleClick
                                 onEditClick={handleEditClick} // Pass edit handler
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
                    isCompleted={completedTasks?.has(activeId) ?? false} // Check completion status safely
                    isDragging // Add a prop to style the dragged item differently
                    // Provide dummy functions or context if needed by TaskItem for display
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                    onTaskClick={() => {}} // Changed from onTaskDoubleClick
                    onEditClick={() => {}} // Add dummy edit handler
                />
            ) : null}
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
