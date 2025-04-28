
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';


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
  completedTasks: Set<string>;
  activeId: string | null; // Add activeId to props
  handleDragStart: (event: any) => void; // Add handleDragStart
  handleDragEnd: (event: DragEndEvent) => void; // Add handleDragEnd
  handleDragCancel: () => void; // Add handleDragCancel
}


interface SortableTaskProps {
  task: Task;
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
  isDragging?: boolean; // Add isDragging prop for styling during DragOverlay
}


// Non-sortable Task Item for DragOverlay
function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
    return (
        <Card
          className={cn(
            "p-3 rounded-md shadow-sm w-full overflow-hidden", // Base styles, ensure overflow is hidden
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse', // Style for DragOverlay
            'transition-all duration-300 ease-in-out' // Smooth transition for completion animation
          )}
        >
          <div className="flex items-start justify-between gap-2">
            {/* Drag Handle Area (no functionality needed in static item) */}
             <div className="p-1 -ml-1 text-muted-foreground cursor-grab">
                <GripVertical className="h-4 w-4" />
             </div>
            {/* Task Content */}
            <div className="flex-grow min-w-0"> {/* Ensure flex item can shrink */}
              <p className={cn(
                  "text-sm font-medium truncate", // Apply truncate
                  isCompleted && 'line-through'
                 )}
                 title={task.name} // Add title attribute for full text on hover
               >
                {task.name}
              </p>
              {task.description && (
                <p className={cn(
                    "text-xs text-muted-foreground truncate", // Apply truncate
                     isCompleted && 'line-through'
                    )}
                    title={task.description} // Add title attribute for full text on hover
                 >
                  {task.description}
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

  return (
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes}>
        <Card
            className={cn(
                "p-3 rounded-md shadow-sm w-full overflow-hidden", // Added w-full, overflow-hidden
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                // isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse', // Style moved to DragOverlay item
                isCompleted ? 'border-2 border-accent' : '', // Gold border on completion
                'transition-all duration-300 ease-in-out', // Smooth transition for completion animation
                "relative mb-2" // Added margin-bottom for spacing
            )}
        >
          <div className="flex items-start justify-between gap-2">
             {/* Drag Handle */}
             <button
                {...listeners} // Attach drag listeners here
                className="cursor-grab p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-2 focus-visible:ring-ring rounded" // Added touch-none and focus style
                aria-label="Drag task"
              >
                <GripVertical className="h-4 w-4" />
             </button>
            {/* Task Content */}
             <div className="flex-grow min-w-0"> {/* Ensure flex item can shrink */}
               <p
                 className={cn(
                   "text-sm font-medium truncate", // Apply truncate
                   isCompleted && 'line-through'
                 )}
                 title={task.name} // Add title attribute for full text on hover
               >
                 {task.name}
               </p>
               {task.description && (
                 <p
                   className={cn(
                     "text-xs text-muted-foreground truncate", // Apply truncate
                     isCompleted && 'line-through'
                   )}
                   title={task.description} // Add title attribute for full text on hover
                 >
                   {task.description}
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


export function CalendarView({ tasks, deleteTask, updateTaskOrder, toggleTaskCompletion, completedTasks }: Omit<CalendarViewProps, 'activeId' | 'handleDragStart' | 'handleDragEnd' | 'handleDragCancel'>) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);


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
      console.log("Recalculating tasksByDay"); // Debug log
      const groupedTasks: { [key: string]: Task[] } = {};
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        groupedTasks[dateStr] = tasks.filter(task => {
            // Ensure tasks are correctly filtered for the day
            if (!task.date) return false;
            try {
                // Handle potential recurring tasks by checking if the task's date's day of the week matches the current day's day of the week within the view
                const taskDate = parseISO(task.date); // Parse once
                 if (task.recurring) {
                    // If recurring, check if the day of the week matches AND the task's start date is on or before the current week's end
                     return taskDate.getDay() === day.getDay() && taskDate <= weekEnd;
                 }
                 // If not recurring, check for exact date match
                 return isSameDay(taskDate, day);
            } catch (e) {
                console.error("Error parsing task date:", task.date, e);
                return false; // Skip task if date is invalid
            }
        });

        // Sort tasks within the day: non-completed first, then completed
         groupedTasks[dateStr].sort((a, b) => {
             const aCompleted = completedTasks.has(a.id);
             const bCompleted = completedTasks.has(b.id);
             if (aCompleted === bCompleted) {
                 // If completion status is the same, maintain original order (or sort by name/time if needed)
                 // We rely on the stable sort nature or initial load order here.
                 // Re-find original index if needed, but arrayMove handles order persistence mostly.
                 const originalAIndex = tasks.findIndex(t => t.id === a.id);
                 const originalBIndex = tasks.findIndex(t => t.id === b.id);
                 return originalAIndex - originalBIndex;
             }
             return aCompleted ? 1 : -1; // Non-completed tasks first (false is -1)
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
       const activeDateStr = tasks.find(t => t.id === active.id)?.date;
       const overSortableContextId = over.data?.current?.sortable?.containerId; // ID of the SortableContext (day column)

        if (!activeDateStr || !overSortableContextId) {
            console.warn("Could not determine date string or over container ID");
            return;
        }

      // Find the date associated with the 'over' container
      // This assumes the droppable container has an ID like 'droppable-yyyy-MM-dd'
      const overDateStr = overSortableContextId; // Assuming SortableContext ID is the date string

      const currentTasksForDate = tasksByDay[overDateStr] || [];
      const oldIndex = currentTasksForDate.findIndex(task => task.id === active.id);
      const newIndex = currentTasksForDate.findIndex(task => task.id === over.id);


      if (oldIndex !== -1 && newIndex !== -1) {
         // Ensure we are operating on the correct day's task list
         if (tasksByDay[overDateStr]) {
             const reorderedTaskIds = arrayMove(tasksByDay[overDateStr], oldIndex, newIndex).map(task => task.id);
             console.log(`Reordering tasks for date ${overDateStr}:`, reorderedTaskIds); // Debug log
             updateTaskOrder(overDateStr, reorderedTaskIds);
         } else {
            console.warn(`No tasks found for date ${overDateStr} in tasksByDay`);
         }
      } else {
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
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


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]} // Restrict movement
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
            // console.log(`Rendering day ${dateStr}, tasks:`, dayTasks.length); // Debug log


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
                                 isCompleted={completedTasks.has(task.id)}
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
                    isCompleted={completedTasks.has(activeId)}
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
