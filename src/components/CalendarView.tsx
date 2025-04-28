
"use client";

import type * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay, // Import DragOverlay
  defaultDropAnimationSideEffects, // Import default drop animation
  type DropAnimation,
  MeasuringStrategy, // Import MeasuringStrategy
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'; // Import modifiers directly


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';


// Define the drop animation configuration
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
  completedTasks: Set<string>; // Ensure this is expected as a Set
}


interface SortableTaskProps {
  task: Task;
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
  isDragging?: boolean; // Add isDragging prop for styling during DragOverlay
}

// Helper function to truncate text
const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
}

// Non-sortable Task Item for DragOverlay
function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
    // Reduced truncation limits for 7-column view
    const nameDisplay = truncateText(task.name, 15); // Limit name length
    const descriptionDisplay = truncateText(task.description, 25); // Limit description length

    return (
        <Card
          className={cn(
            "p-3 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[70px] flex flex-col justify-between", // Ensure height allows content, flex layout
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse', // Style for DragOverlay
            'transition-all duration-300 ease-in-out' // Smooth transition for completion animation
          )}
        >
          <div className="flex items-start justify-between gap-2 flex-grow">
            {/* Drag Handle Area (no functionality needed in static item) */}
             <div className="pt-1 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-4 w-4" />
             </div>
            {/* Task Content */}
            <div className="flex-grow min-w-0 pr-1"> {/* Ensure flex item can shrink, added padding */}
              <p className={cn(
                  "text-sm font-medium break-words whitespace-normal", // Allow wrapping
                  isCompleted && 'line-through'
                 )}
                 title={task.name} // Add title attribute for full text on hover
               >
                {nameDisplay}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-xs text-muted-foreground mt-1 break-words whitespace-normal", // Allow wrapping
                     isCompleted && 'line-through'
                    )}
                    title={task.description} // Add title attribute for full text on hover
                 >
                  {descriptionDisplay}
                </p>
              )}
            </div>
            {/* Action Buttons Area (no functionality needed in static item) */}
            <div className="flex flex-col items-center space-y-1 shrink-0">
               <div className="h-6 w-6 flex items-center justify-center">
                  {isCompleted ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4" />}
                </div>
               <div className="h-6 w-6 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
            </div>
          </div>
        </Card>
    );
}


// Component for individual sortable task item
function SortableTask({ task, isCompleted, toggleTaskCompletion, deleteTask }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // Use isDragging to apply styles while dragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease', // Ensure transition is always applied
    opacity: isDragging ? 0 : 1, // Hide original item when dragging
    // zIndex: isDragging ? 10 : 'auto', // Ensure dragged item is on top - Handled by DragOverlay now
  };

  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent drag initiation on click
      toggleTaskCompletion(task.id);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent drag initiation on click
    deleteTask(task.id);
  }

  // Reduced truncation limits for 7-column view
  const nameDisplay = truncateText(task.name, 15); // Limit name length
  const descriptionDisplay = truncateText(task.description, 25); // Limit description length


  return (
    // The div itself handles the dragging and positioning
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes} className="mb-2 touch-none">
        {/* The Card is the visual representation */}
        <Card
            className={cn(
                "p-3 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[70px] flex flex-col justify-between", // Ensure height allows content, flex layout, overflow hidden
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                // isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse', // Style moved to DragOverlay item
                isCompleted ? 'border-2 border-accent animate-pulse' : '', // Gold border on completion with subtle pulse
                'transition-all duration-300 ease-in-out', // Smooth transition for completion animation
                "relative" // Keep relative positioning if needed for internal elements
            )}
        >
          <div className="flex items-start justify-between gap-2 flex-grow">
             {/* Drag Handle */}
             <button
                {...listeners} // Attach drag listeners here
                className="cursor-grab pt-1 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-2 focus-visible:ring-ring rounded shrink-0" // Added touch-none and focus style
                aria-label="Drag task"
              >
                <GripVertical className="h-4 w-4" />
             </button>
            {/* Task Content */}
             <div className="flex-grow min-w-0 pr-1"> {/* Ensure flex item can shrink, added padding */}
               <p
                 className={cn(
                   "text-sm font-medium break-words whitespace-normal", // Allow wrapping
                   isCompleted && 'line-through'
                 )}
                 title={task.name} // Add title attribute for full text on hover
               >
                 {nameDisplay}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-xs text-muted-foreground mt-1 break-words whitespace-normal", // Allow wrapping
                     isCompleted && 'line-through'
                   )}
                   title={task.description} // Add title attribute for full text on hover
                 >
                   {descriptionDisplay}
                 </p>
               )}
             </div>

            {/* Action Buttons */}
            <div className="flex flex-col items-center space-y-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-600 hover:text-green-700 focus-visible:ring-2 focus-visible:ring-ring rounded"
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive/80 focus-visible:ring-2 focus-visible:ring-ring rounded"
                onClick={handleDeleteTask}
                aria-label="Delete task"
                disabled={isCompleted} // Optionally disable delete for completed tasks
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
}

// Omit the props that will be managed internally by this component's state hooks
export function CalendarView({ tasks, deleteTask, updateTaskOrder, toggleTaskCompletion, completedTasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false); // State to track client-side rendering

  useEffect(() => {
      setIsClient(true); // Set to true once component mounts
  }, []);


  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start week on Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });


  // Memoize the days array
  const days = useMemo(() => {
      const daysArray = [];
      let day = weekStart;
      while (day <= weekEnd) {
        daysArray.push(new Date(day));
        day = addDays(day, 1);
      }
      return daysArray;
    }, [weekStart, weekEnd]); // Recalculate only when weekStart/weekEnd changes


  // Memoize tasks grouped by day
  const tasksByDay = useMemo(() => {
      // console.log("Recalculating tasksByDay, completedTasks:", completedTasks); // Debug log
      const groupedTasks: { [key: string]: Task[] } = {};
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() -1; // Adjust Sunday (0) to 6, Monday (1) to 0 etc. to match ISO week day

        groupedTasks[dateStr] = tasks.filter(task => {
            // Ensure tasks are correctly filtered for the day
            if (!task.date) return false;
            try {
                const taskDate = parseISO(task.date + 'T00:00:00'); // Ensure local timezone parsing
                 if (isNaN(taskDate.getTime())) {
                     console.error("Invalid task date detected:", task.date);
                     return false;
                 }

                if (task.recurring) {
                    // Check if the task's original day of the week matches the current day's day of the week
                    // AND the task's start date is on or before the current day being checked
                    const taskDayOfWeek = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1; // Adjust Sunday (0) to 6
                    return taskDayOfWeek === dayOfWeek && taskDate <= day;
                 }
                 // If not recurring, check for exact date match
                 return isSameDay(taskDate, day);
            } catch (e) {
                console.error("Error parsing task date:", task.date, e);
                return false; // Skip task if date is invalid
            }
        });

        // Sort tasks within the day: non-completed first, then completed
        // This sorting should respect the order potentially modified by updateTaskOrder
         groupedTasks[dateStr].sort((a, b) => {
             const aCompleted = completedTasks?.has(a.id); // Safely access .has
             const bCompleted = completedTasks?.has(b.id); // Safely access .has

             // If completion status is different, sort by it (incomplete first)
             if (aCompleted !== bCompleted) {
                 return aCompleted ? 1 : -1; // Non-completed (false) comes before completed (true)
             }

            // If completion status is the same, maintain the current relative order
            // Find index in the *original* tasks array before filtering, to preserve DnD order somewhat stably
             const originalAIndex = tasks.findIndex(t => t.id === a.id);
             const originalBIndex = tasks.findIndex(t => t.id === b.id);
             return originalAIndex - originalBIndex;
         });


      });
      return groupedTasks;
    }, [tasks, days, completedTasks]); // Depend on tasks, days, and completedTasks


   // Find the active task details when activeId changes
   const activeTask = useMemo(() => tasks.find(task => task.id === activeId), [tasks, activeId]);


  const sensors = useSensors(
      useSensor(PointerSensor, {
        // Require the mouse to move by 10 pixels before initiating drag
        // Or a touch pointer to move by 5 pixels
        activationConstraint: {
          distance: 10, // Increased distance for mouse
           // delay: 150, // Optional delay
           // tolerance: 5, // Optional tolerance
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
     setActiveId(null); // Reset activeId


    if (over && active.id !== over.id) {
       // Find the date string associated with the *over* element's sortable context
       const overSortableContextId = over.data?.current?.sortable?.containerId;

        if (!overSortableContextId || typeof overSortableContextId !== 'string') {
             console.warn("Could not determine the date context of the drop target.");
             return;
         }

       const overDateStr = overSortableContextId; // The ID of the SortableContext is the date string

       // Get the current list of task IDs for the target date from tasksByDay
       const currentTaskIdsForDate = (tasksByDay[overDateStr] || []).map(task => task.id);

       const oldIndex = currentTaskIdsForDate.indexOf(active.id as string);
       const newIndex = currentTaskIdsForDate.indexOf(over.id as string);


      if (oldIndex !== -1 && newIndex !== -1) {
         const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
         console.log(`Reordering tasks for date ${overDateStr}:`, reorderedTaskIds); // Debug log
         updateTaskOrder(overDateStr, reorderedTaskIds);
      } else {
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
          // Handle potential case where item is dragged to an empty list?
          // Or if the over.id is the container itself?
          // This might require adjusting how indices are found or how arrayMove is used.
          // For now, we log a warning. If dragging onto the container itself is the issue,
          // check over.id structure.
          if (over.id === overDateStr && oldIndex !== -1) {
              // Attempting to drop onto the container (e.g., end of list)
              // Calculate newIndex based on desired drop position (e.g., end)
              const targetIndex = currentTaskIdsForDate.length; // Place at the end
              const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, targetIndex);
              updateTaskOrder(overDateStr, reorderedTaskIds);
          }
      }

    }
  };

  const handleDragCancel = () => {
      setActiveId(null);
  };

  const goToPreviousWeek = () => {
    setCurrentDate(subDays(weekStart, 7)); // Go back 7 days
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(weekStart, 7)); // Go forward 7 days
  };

  // Avoid rendering DndContext on server or during hydration mismatch
  if (!isClient) {
      // Render a placeholder or null during server render / initial client render
      // to prevent hydration errors related to DndContext setup
      return (
           <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  {/* Placeholder buttons or simplified header */}
                  <span className="w-10 h-10 bg-muted rounded"></span>
                  <h2 className="text-xl md:text-2xl font-semibold text-primary">Loading...</h2>
                  <span className="w-10 h-10 bg-muted rounded"></span>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-4">
                    {/* Render skeleton loaders for days */}
                    {Array.from({ length: 7 }).map((_, index) => (
                        <Card key={index} className="flex flex-col h-[400px] md:h-[500px] overflow-hidden bg-secondary/50">
                            <CardHeader className="p-3 text-center shrink-0">
                                <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-1"></div>
                                <div className="h-6 bg-muted rounded w-1/4 mx-auto"></div>
                            </CardHeader>
                            <Separator className="shrink-0"/>
                            <CardContent className="p-3 space-y-2 flex-grow">
                                <div className="h-16 bg-muted rounded w-full mb-2"></div>
                                <div className="h-16 bg-muted rounded w-full"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
      );
  }


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]} // Use imported modifiers
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Add measuring strategy
    >
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} aria-label="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl md:text-2xl font-semibold text-primary">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-4">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            // Use the memoized tasksByDay
             const dayTasks = tasksByDay[dateStr] || [];
            const isToday = isSameDay(day, new Date());
            // console.log(`Rendering day ${dateStr}, tasks:`, dayTasks.length, completedTasks); // Debug log


            return (
              <Card key={dateStr} className={cn("flex flex-col h-[400px] md:h-[500px] overflow-hidden", isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50')}>
                <CardHeader className="p-3 text-center shrink-0">
                  <CardTitle className="text-sm font-medium">
                    {format(day, 'EEE')} {/* Day name */}
                  </CardTitle>
                  <CardDescription className={cn("text-lg font-bold", isToday ? 'text-accent' : 'text-foreground')}>
                    {format(day, 'd')} {/* Day number */}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-1">Today</Badge>}
                </CardHeader>
                <Separator className="shrink-0"/>
                <ScrollArea className="flex-grow">
                  <CardContent className="p-3 space-y-2" data-testid={`day-content-${dateStr}`}>
                     {/* Wrap task list in SortableContext */}
                     <SortableContext
                         id={dateStr} // Use date string as the ID for the context/droppable area
                         items={dayTasks.map(task => task.id)}
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.length === 0 ? (
                           <p className="text-xs text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             dayTasks.map((task) => (
                               <SortableTask
                                 key={task.id}
                                 task={task}
                                 // Ensure completedTasks is valid before calling .has
                                 isCompleted={completedTasks?.has(task.id) ?? false}
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 deleteTask={deleteTask}
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
      {/* Drag Overlay */}
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask ? (
                <TaskItem
                    task={activeTask}
                    // Ensure completedTasks is valid before calling .has
                    isCompleted={completedTasks?.has(activeId) ?? false}
                    isDragging // Pass isDragging to apply overlay styles
                    // Provide dummy functions for actions as they are not needed in overlay
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                />
            ) : null}
        </DragOverlay>
    </DndContext>
  );
}

