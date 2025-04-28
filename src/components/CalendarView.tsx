
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
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
  restrictToParentElement,
} from '@dnd-kit/modifiers'; // Correct import path
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

// Helper function to truncate text dynamically
const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

// Base character limits (adjust as needed)
const BASE_TITLE_LIMIT = 15;
const BASE_DESC_LIMIT = 25;

// Non-sortable Task Item for DragOverlay
function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
    const titleLimit = BASE_TITLE_LIMIT;
    const descLimit = BASE_DESC_LIMIT;

    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = truncateText(task.description, descLimit);

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words", // Added break-words
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Added overflow-hidden */}
              <p className={cn(
                  "text-xs font-medium break-words", // Keep break-words
                  isCompleted && 'line-through'
                 )}
                 title={task.name} // Keep full title for tooltip
               >
                {nameDisplay}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words", // Keep break-words
                     isCompleted && 'line-through'
                    )}
                    title={task.description} // Keep full description for tooltip
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


// Component for individual sortable task item
function SortableTask({ task, isCompleted, toggleTaskCompletion, deleteTask }: SortableTaskProps) {
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
    // Removed width setting from here - let flexbox handle it
  };

  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault();
      toggleTaskCompletion(task.id);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteTask(task.id);
  }

  const titleLimit = BASE_TITLE_LIMIT;
  const descLimit = BASE_DESC_LIMIT;

  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = truncateText(task.description, descLimit);


  return (
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes} className="mb-1 touch-none">
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words", // Added break-words
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                 isCompleted ? 'animate-pulse border-2 border-accent' : '', // Animation on completion
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
             <div className="flex-grow min-w-0 pr-1 overflow-hidden"> {/* Added overflow-hidden */}
               <p
                 className={cn(
                   "text-xs font-medium break-words", // Keep break-words
                   isCompleted && 'line-through'
                 )}
                 title={task.name} // Keep full title for tooltip
               >
                 {nameDisplay}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-[10px] text-muted-foreground mt-0.5 break-words", // Keep break-words
                     isCompleted && 'line-through'
                   )}
                   title={task.description} // Keep full description for tooltip
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
       const groupedTasks: { [key: string]: Task[] } = {};
       if (!tasks || !Array.isArray(tasks)) {
           console.error("Tasks data is invalid:", tasks);
           return groupedTasks; // Return empty if tasks are invalid
       }
       if (!(completedTasks instanceof Set)) {
          console.warn("completedTasks is not a Set, defaulting to empty set");
          completedTasks = new Set(); // Ensure completedTasks is a Set
       }

       days.forEach(day => {
         const dateStr = format(day, 'yyyy-MM-dd');
         // Ensure day is valid before proceeding
         if (isNaN(day.getTime())) {
             console.error("Invalid day generated:", day);
             groupedTasks[dateStr] = [];
             return;
         }
         const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() - 1; // Monday is 0, Sunday is 6

         groupedTasks[dateStr] = tasks.filter(task => {
             if (!task || !task.date) return false; // Basic validation for task object and date
             try {
                 // Ensure task.date is a valid date string before parsing
                 if (typeof task.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
                    console.warn("Invalid task date format detected:", task.date, "for task:", task.id);
                    return false;
                 }

                 // Parse with explicit time to avoid timezone issues if date is just 'yyyy-MM-dd'
                 const taskDate = parseISO(task.date + 'T00:00:00');
                  if (isNaN(taskDate.getTime())) {
                      console.error("Invalid task date parsed:", task.date, "for task:", task.id);
                      return false;
                  }

                 if (task.recurring) {
                     const taskStartDayOfWeek = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
                     // Check if the recurring task's start day matches the current day of the week
                     // AND if the current day is on or after the task's start date
                     return taskStartDayOfWeek === dayOfWeek && taskDate <= day;
                  }
                  // For non-recurring tasks, check if the date is the same
                  return isSameDay(taskDate, day);
             } catch (e) {
                 console.error("Error processing task date:", task.date, "for task:", task.id, e);
                 return false;
             }
         });

          // Sort tasks within the day: non-completed first, then completed, maintaining DnD order within status
          groupedTasks[dateStr]?.sort((a, b) => {
              const aCompleted = completedTasks.has(a.id);
              const bCompleted = completedTasks.has(b.id);

              if (aCompleted !== bCompleted) {
                  return aCompleted ? 1 : -1; // Non-completed first
              }

              // If completion status is the same, maintain relative order from the main `tasks` array
              const originalAIndex = tasks.findIndex(t => t && t.id === a.id); // Add check for t
              const originalBIndex = tasks.findIndex(t => t && t.id === b.id); // Add check for t

                // Handle cases where index might not be found (shouldn't happen with valid data)
               if (originalAIndex === -1 || originalBIndex === -1) {
                   return 0; // Maintain original order or place unfound items at the end
               }

              return originalAIndex - originalBIndex;
          });


       });
       return groupedTasks;
     }, [tasks, days, completedTasks]); // completedTasks is now guaranteed to be a Set


   // Find the active task details when activeId changes
   const activeTask = useMemo(() => tasks.find(task => task && task.id === activeId), [tasks, activeId]);


  const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 5, // Start drag after moving 5px
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
  );

    // Define modifiers for DndContext
    const modifiers = useMemo(() => [
        restrictToVerticalAxis,
        restrictToParentElement, // Keep item within its SortableContext parent
        restrictToWindowEdges // Fallback for edge cases
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
     setActiveId(null); // Reset activeId


    if (over && active.id !== over.id) {
       // Determine the date context (container ID) of the drop target
       const overSortableContextId = over.data?.current?.sortable?.containerId;

        // Ensure we have a valid date string as the container ID
        if (!overSortableContextId || typeof overSortableContextId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(overSortableContextId)) {
             console.warn("Could not determine the valid date context of the drop target.", over.data?.current?.sortable);
             return;
         }

       const overDateStr = overSortableContextId;

       // Get the current task IDs for that specific date, ensuring tasksByDay and the date exist
       const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => task.id);


       const oldIndex = currentTaskIdsForDate.indexOf(active.id as string);
       const newIndex = currentTaskIdsForDate.indexOf(over.id as string);


      if (oldIndex !== -1 && newIndex !== -1) {
         const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
         updateTaskOrder(overDateStr, reorderedTaskIds);
      } else {
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
           // Handle dropping onto the container itself (e.g., end of the list)
           if (over.id === overDateStr && oldIndex !== -1) {
               console.log(`Task ${active.id} dropped onto container ${overDateStr}. Moving to end.`);
               const targetIndex = currentTaskIdsForDate.length; // Index to move to the end
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
    setCurrentDate(subDays(weekStart, 7));
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(weekStart, 7));
  };

  if (!isClient) {
      return (
           <div className="p-1 md:p-2"> {/* Reduced padding */}
                <div className="flex items-center justify-between mb-1"> {/* Reduced margin */}
                  <span className="w-8 h-8 bg-muted rounded"></span> {/* Smaller placeholder */}
                  <h2 className="text-base md:text-lg font-semibold text-primary">Loading...</h2> {/* Slightly smaller text */}
                  <span className="w-8 h-8 bg-muted rounded"></span> {/* Smaller placeholder */}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1"> {/* Reduced gap */}
                    {Array.from({ length: 7 }).map((_, index) => (
                        <Card key={index} className="flex flex-col h-[450px] md:h-[600px] overflow-hidden bg-secondary/50"> {/* Increased height */}
                            <CardHeader className="p-1 text-center shrink-0"> {/* Reduced padding */}
                                <div className="h-3 bg-muted rounded w-1/2 mx-auto mb-0.5"></div> {/* Smaller skeleton */}
                                <div className="h-5 bg-muted rounded w-1/4 mx-auto"></div> {/* Smaller skeleton */}
                            </CardHeader>
                            <Separator className="shrink-0 my-0.5"/> {/* Reduced margin */}
                            <CardContent className="p-1 space-y-1 flex-grow"> {/* Reduced padding and space */}
                                <div className="h-12 bg-muted rounded w-full mb-1"></div> {/* Smaller skeleton */}
                                <div className="h-12 bg-muted rounded w-full"></div> {/* Smaller skeleton */}
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
      modifiers={modifiers} // Apply modifiers here
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Ensure consistent measuring
    >
      <div className="p-1 md:p-2 w-full"> {/* Reduced padding, ensure full width */}
        <div className="flex items-center justify-between mb-1"> {/* Reduced margin */}
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} aria-label="Previous week" className="h-8 w-8"> {/* Smaller button */}
            <ChevronLeft className="h-4 w-4" /> {/* Smaller icon */}
          </Button>
          <h2 className="text-base md:text-lg font-semibold text-primary text-center flex-grow px-1"> {/* Slightly smaller text, reduced padding */}
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="Next week" className="h-8 w-8"> {/* Smaller button */}
            <ChevronRight className="h-4 w-4" /> {/* Smaller icon */}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full"> {/* Reduced gap, ensure full width */}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             // Safely access tasks for the day, default to empty array if undefined
             const dayTasks = tasksByDay?.[dateStr] || [];
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[450px] md:h-[600px] overflow-hidden", // Adjusted height
                  isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50 border-transparent' // Use transparent border for non-today
                  )}>
                <CardHeader className="p-1 text-center shrink-0"> {/* Reduced padding */}
                  <CardTitle className="text-xs font-medium"> {/* Smaller text */}
                    {format(day, 'EEE')}
                  </CardTitle>
                  <CardDescription className={cn("text-sm font-bold", isToday ? 'text-accent' : 'text-foreground')}> {/* Slightly smaller text */}
                    {format(day, 'd')}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-0.5 px-1 py-0 text-[9px]">Today</Badge>} {/* Adjusted badge styles */}
                </CardHeader>
                <Separator className="shrink-0 my-0.5"/> {/* Reduced margin */}
                <ScrollArea className="flex-grow">
                  <CardContent className="p-1 space-y-1" data-testid={`day-content-${dateStr}`}> {/* Reduced padding and space */}
                     <SortableContext
                         id={dateStr} // Use the date string as the ID for the context
                         items={dayTasks.map(task => task.id)} // Pass task IDs
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p> /* Smaller text */
                         ) : (
                             dayTasks.map((task) => (
                               <SortableTask
                                 key={task.id}
                                 task={task}
                                 isCompleted={completedTasks.has(task.id)} // Safely check Set
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
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask ? (
                <TaskItem
                    task={activeTask}
                    isCompleted={completedTasks.has(activeId)} // Safely check Set
                    isDragging
                    // Dummy functions for overlay item
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                />
            ) : null}
        </DragOverlay>
    </DndContext>
  );
}

    