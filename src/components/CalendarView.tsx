
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
  type Modifiers,
} from '@dnd-kit/core';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
  restrictToParentElement, // Import restrictToParentElement
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

// Helper function to truncate text dynamically based on container width (approximate)
const truncateText = (text: string | undefined, charLimit: number): string => {
    if (!text) return '';
    if (text.length <= charLimit) {
        return text;
    }
    return text.slice(0, charLimit) + '...';
}

// Non-sortable Task Item for DragOverlay
function TaskItem({ task, isCompleted, isDragging }: SortableTaskProps) {
    // Use approximate character limits, adjust as needed
    const nameDisplay = truncateText(task.name, 12); // Shorter limit for smaller cards
    const descriptionDisplay = truncateText(task.description, 20); // Shorter limit

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between", // Reduced padding, min-height
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow"> {/* Reduced gap */}
            {/* Drag Handle Area */}
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0"> {/* Adjusted padding */}
                <GripVertical className="h-3 w-3" /> {/* Smaller icon */}
             </div>
            {/* Task Content */}
            <div className="flex-grow min-w-0 pr-1">
              <p className={cn(
                  "text-xs font-medium break-words whitespace-normal", // Smaller base text size
                  isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                {nameDisplay}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal", // Even smaller text size, reduced margin
                     isCompleted && 'line-through'
                    )}
                    title={task.description}
                 >
                  {descriptionDisplay}
                </p>
              )}
            </div>
            {/* Action Buttons Area */}
            <div className="flex flex-col items-center space-y-0.5 shrink-0"> {/* Reduced space */}
               <div className="h-5 w-5 flex items-center justify-center"> {/* Smaller button area */}
                  {isCompleted ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Circle className="h-3 w-3" />} {/* Smaller icons */}
                </div>
               <div className="h-5 w-5 flex items-center justify-center"> {/* Smaller button area */}
                  <Trash2 className="h-3 w-3 text-destructive" /> {/* Smaller icon */}
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
  };

  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault();
      toggleTaskCompletion(task.id);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    deleteTask(task.id);
  }

   // Use approximate character limits, adjust as needed
    const nameDisplay = truncateText(task.name, 12); // Shorter limit for smaller cards
    const descriptionDisplay = truncateText(task.description, 20); // Shorter limit


  return (
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes} className="mb-1 touch-none"> {/* Reduced margin-bottom */}
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between", // Reduced padding, min-height
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                isCompleted ? 'border-2 border-accent animate-pulse' : '',
                'transition-all duration-300 ease-in-out',
                "relative"
            )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow"> {/* Reduced gap */}
             {/* Drag Handle */}
             <button
                {...listeners}
                className="cursor-grab pt-0.5 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0" // Adjusted padding, reduced ring
                aria-label="Drag task"
              >
                <GripVertical className="h-3 w-3" /> {/* Smaller icon */}
             </button>
            {/* Task Content */}
             <div className="flex-grow min-w-0 pr-1">
               <p
                 className={cn(
                   "text-xs font-medium break-words whitespace-normal", // Smaller text size
                   isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                 {nameDisplay}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal", // Even smaller text, reduced margin
                     isCompleted && 'line-through'
                   )}
                   title={task.description}
                 >
                   {descriptionDisplay}
                 </p>
               )}
             </div>

            {/* Action Buttons */}
            <div className="flex flex-col items-center space-y-0.5 shrink-0"> {/* Reduced space */}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-green-600 hover:text-green-700 focus-visible:ring-1 focus-visible:ring-ring rounded" // Smaller size, reduced ring
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />} {/* Smaller icons */}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded" // Smaller size, reduced ring
                onClick={handleDeleteTask}
                aria-label="Delete task"
                disabled={isCompleted}
              >
                <Trash2 className="h-3 w-3" /> {/* Smaller icon */}
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
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() -1;

        groupedTasks[dateStr] = tasks.filter(task => {
            if (!task.date) return false;
            try {
                const taskDate = parseISO(task.date + 'T00:00:00');
                 if (isNaN(taskDate.getTime())) {
                     console.error("Invalid task date detected:", task.date);
                     return false;
                 }

                if (task.recurring) {
                    const taskDayOfWeek = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
                    return taskDayOfWeek === dayOfWeek && taskDate <= day;
                 }
                 return isSameDay(taskDate, day);
            } catch (e) {
                console.error("Error parsing task date:", task.date, e);
                return false;
            }
        });

         groupedTasks[dateStr].sort((a, b) => {
             const aCompleted = completedTasks?.has(a.id);
             const bCompleted = completedTasks?.has(b.id);

             if (aCompleted !== bCompleted) {
                 return aCompleted ? 1 : -1;
             }

             const originalAIndex = tasks.findIndex(t => t.id === a.id);
             const originalBIndex = tasks.findIndex(t => t.id === b.id);
             return originalAIndex - originalBIndex;
         });


      });
      return groupedTasks;
    }, [tasks, days, completedTasks]);


   // Find the active task details when activeId changes
   const activeTask = useMemo(() => tasks.find(task => task.id === activeId), [tasks, activeId]);


  const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8, // Slightly reduced distance
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
  );

    // Define modifiers for DndContext
    const modifiers: Modifiers = useMemo(() => [
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
       const overSortableContextId = over.data?.current?.sortable?.containerId;

        if (!overSortableContextId || typeof overSortableContextId !== 'string') {
             console.warn("Could not determine the date context of the drop target.");
             return;
         }

       const overDateStr = overSortableContextId;

       const currentTaskIdsForDate = (tasksByDay[overDateStr] || []).map(task => task.id);

       const oldIndex = currentTaskIdsForDate.indexOf(active.id as string);
       const newIndex = currentTaskIdsForDate.indexOf(over.id as string);


      if (oldIndex !== -1 && newIndex !== -1) {
         const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
         updateTaskOrder(overDateStr, reorderedTaskIds);
      } else {
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
          if (over.id === overDateStr && oldIndex !== -1) {
              const targetIndex = currentTaskIdsForDate.length;
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
           <div className="p-2 md:p-4"> {/* Reduced padding */}
                <div className="flex items-center justify-between mb-2"> {/* Reduced margin */}
                  <span className="w-8 h-8 bg-muted rounded"></span> {/* Smaller placeholder */}
                  <h2 className="text-lg md:text-xl font-semibold text-primary">Loading...</h2> {/* Slightly smaller text */}
                  <span className="w-8 h-8 bg-muted rounded"></span> {/* Smaller placeholder */}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1 md:gap-2"> {/* Reduced gap */}
                    {Array.from({ length: 7 }).map((_, index) => (
                        <Card key={index} className="flex flex-col h-[350px] md:h-[450px] overflow-hidden bg-secondary/50"> {/* Reduced height */}
                            <CardHeader className="p-2 text-center shrink-0"> {/* Reduced padding */}
                                <div className="h-3 bg-muted rounded w-1/2 mx-auto mb-1"></div> {/* Smaller skeleton */}
                                <div className="h-5 bg-muted rounded w-1/4 mx-auto"></div> {/* Smaller skeleton */}
                            </CardHeader>
                            <Separator className="shrink-0"/>
                            <CardContent className="p-2 space-y-1 flex-grow"> {/* Reduced padding and space */}
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
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div className="p-2 md:p-4"> {/* Reduced padding */}
        <div className="flex items-center justify-between mb-2"> {/* Reduced margin */}
          <Button variant="outline" size="icon" onClick={goToPreviousWeek} aria-label="Previous week" className="h-8 w-8"> {/* Smaller button */}
            <ChevronLeft className="h-4 w-4" /> {/* Smaller icon */}
          </Button>
          <h2 className="text-lg md:text-xl font-semibold text-primary text-center flex-grow px-2"> {/* Slightly smaller text, added text-center and flex-grow */}
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextWeek} aria-label="Next week" className="h-8 w-8"> {/* Smaller button */}
            <ChevronRight className="h-4 w-4" /> {/* Smaller icon */}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1 md:gap-2"> {/* Reduced gap */}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             const dayTasks = tasksByDay[dateStr] || [];
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[350px] md:h-[450px] overflow-hidden", // Reduced height
                  isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50 border-transparent' // Use transparent border for non-today
                  )}>
                <CardHeader className="p-2 text-center shrink-0"> {/* Reduced padding */}
                  <CardTitle className="text-xs font-medium"> {/* Smaller text */}
                    {format(day, 'EEE')}
                  </CardTitle>
                  <CardDescription className={cn("text-base font-bold", isToday ? 'text-accent' : 'text-foreground')}> {/* Slightly smaller text */}
                    {format(day, 'd')}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-0.5 px-1.5 py-0 text-[10px]">Today</Badge>} {/* Adjusted badge styles */}
                </CardHeader>
                <Separator className="shrink-0"/>
                <ScrollArea className="flex-grow">
                  <CardContent className="p-2 space-y-1" data-testid={`day-content-${dateStr}`}> {/* Reduced padding and space */}
                     <SortableContext
                         id={dateStr}
                         items={dayTasks.map(task => task.id)}
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p> /* Smaller text */
                         ) : (
                             dayTasks.map((task) => (
                               <SortableTask
                                 key={task.id}
                                 task={task}
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
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask ? (
                <TaskItem
                    task={activeTask}
                    isCompleted={completedTasks?.has(activeId) ?? false}
                    isDragging
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                />
            ) : null}
        </DragOverlay>
    </DndContext>
  );
}

