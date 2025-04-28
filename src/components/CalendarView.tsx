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
  restrictToParentElement,
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
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea


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
  updateTaskDetails: (id: string, details: string) => void;
}

interface SortableTaskProps {
  task: Task;
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
  isDragging?: boolean;
  onTaskDoubleClick: (task: Task) => void;
}

const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

const BASE_TITLE_LIMIT = 15;
const BASE_DESC_LIMIT = 25;

function TaskItem({ task, isCompleted, isDragging, onTaskDoubleClick }: SortableTaskProps) {
    const titleLimit = BASE_TITLE_LIMIT;
    const descLimit = BASE_DESC_LIMIT;

    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = truncateText(task.description, descLimit);

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words",
            isCompleted ? 'bg-muted opacity-60' : 'bg-card',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden">
              <p className={cn(
                  "text-xs font-medium break-words",
                  isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                {nameDisplay}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words",
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

  const handleDoubleClick = () => {
    onTaskDoubleClick(task);
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`task-${task.id}`} {...attributes} className="mb-1 touch-none" onDoubleClick={handleDoubleClick}>
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words",
                isCompleted ? 'bg-muted opacity-60' : 'bg-card',
                 isCompleted ? 'animate-pulse border-2 border-accent' : '',
                 'transition-all duration-300 ease-in-out',
                 "relative"
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
             <div className="flex-grow min-w-0 pr-1 overflow-hidden">
               <p
                 className={cn(
                   "text-xs font-medium break-words",
                   isCompleted && 'line-through'
                 )}
                 title={task.name}
               >
                 {nameDisplay}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-[10px] text-muted-foreground mt-0.5 break-words",
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
  updateTaskDetails: (id: string, details: string) => void;
}

function TaskDetailsDialog({ task, onClose, updateTaskDetails }: TaskDetailsDialogProps) {
  const [taskDetails, setTaskDetails] = useState(task?.details || '');

  const handleSave = () => {
    if (task) {
      updateTaskDetails(task.id, taskDetails);
      onClose();
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Task Details</DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="details"
                className="text-right text-sm font-medium leading-none text-primary"
              >
                Additional Details:
              </label>
              <div className="col-span-3">
                <Textarea
                  id="details"
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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


  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const days = useMemo(() => {
      const daysArray = [];
      let day = weekStart;
      while (day <= weekEnd) {
        daysArray.push(new Date(day));
        day = addDays(day, 1);
      }
      return daysArray;
    }, [weekStart, weekEnd]);


   const tasksByDay = useMemo(() => {
       const groupedTasks: { [key: string]: Task[] } = {};
       if (!tasks || !Array.isArray(tasks)) {
           console.error("Tasks data is invalid:", tasks);
           return groupedTasks;
       }
       if (!(completedTasks instanceof Set)) {
          console.warn("completedTasks is not a Set, defaulting to empty set");
          completedTasks = new Set();
       }

       days.forEach(day => {
         const dateStr = format(day, 'yyyy-MM-dd');
         if (isNaN(day.getTime())) {
             console.error("Invalid day generated:", day);
             groupedTasks[dateStr] = [];
             return;
         }
         const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() - 1;

         groupedTasks[dateStr] = tasks.filter(task => {
             if (!task || !task.date) return false;
             try {
                 if (typeof task.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
                    console.warn("Invalid task date format detected:", task.date, "for task:", task.id);
                    return false;
                 }
                 const taskDate = parseISO(task.date + 'T00:00:00');
                  if (isNaN(taskDate.getTime())) {
                      console.error("Invalid task date parsed:", task.date, "for task:", task.id);
                      return false;
                  }

                 if (task.recurring) {
                     const taskStartDayOfWeek = taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1;
                     return taskStartDayOfWeek === dayOfWeek && taskDate <= day;
                  }
                  return isSameDay(taskDate, day);
             } catch (e) {
                 console.error("Error processing task date:", task.date, "for task:", task.id, e);
                 return false;
             }
         });

          groupedTasks[dateStr]?.sort((a, b) => {
              const aCompleted = completedTasks.has(a.id);
              const bCompleted = completedTasks.has(b.id);

              if (aCompleted !== bCompleted) {
                  return aCompleted ? 1 : -1;
              }

              const originalAIndex = tasks.findIndex(t => t && t.id === a.id);
              const originalBIndex = tasks.findIndex(t => t && t.id === b.id);

               if (originalAIndex === -1 || originalBIndex === -1) {
                   return 0;
               }

              return originalAIndex - originalBIndex;
          });


       });
       return groupedTasks;
     }, [tasks, days, completedTasks]);


   const activeTask = useMemo(() => tasks.find(task => task && task.id === activeId), [tasks, activeId]);

  const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 5,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
  );

    const modifiers = useMemo(() => [
        restrictToVerticalAxis,
        restrictToParentElement,
        restrictToWindowEdges
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
     setActiveId(null);


    if (over && active.id !== over.id) {
       const overSortableContextId = over.data?.current?.sortable?.containerId;

        if (!overSortableContextId || typeof overSortableContextId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(overSortableContextId)) {
             console.warn("Could not determine the valid date context of the drop target.", over.data?.current?.sortable);
             return;
         }

       const overDateStr = overSortableContextId;

       const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => task.id);


       const oldIndex = currentTaskIdsForDate.indexOf(active.id as string);
       const newIndex = currentTaskIdsForDate.indexOf(over.id as string);


      if (oldIndex !== -1 && newIndex !== -1) {
         const reorderedTaskIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
         updateTaskOrder(overDateStr, reorderedTaskIds);
      } else {
          console.warn(`Could not find oldIndex (${oldIndex}) or newIndex (${newIndex}) for task ${active.id} in date ${overDateStr}`);
           if (over.id === overDateStr && oldIndex !== -1) {
               console.log(`Task ${active.id} dropped onto container ${overDateStr}. Moving to end.`);
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
      modifiers={modifiers}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             const dayTasks = tasksByDay?.[dateStr] || [];
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[500px] md:h-[600px] overflow-hidden",
                  isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50 border-transparent'
                  )}>
                <CardHeader className="p-1 text-center shrink-0">
                  <CardTitle className="text-xs font-medium">
                    {format(day, 'EEE')}
                  </CardTitle>
                  <CardDescription className={cn("text-sm font-bold", isToday ? 'text-accent' : 'text-foreground')}>
                    {format(day, 'd')}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-0.5 px-1 py-0 text-[9px]">Today</Badge>}
                </CardHeader>
                <Separator className="shrink-0 my-0.5"/>
                <ScrollArea className="flex-grow">
                  <CardContent className="p-1 space-y-1" data-testid={`day-content-${dateStr}`}>
                     <SortableContext
                         id={dateStr}
                         items={dayTasks.map(task => task.id)}
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             dayTasks.map((task) => (
                               <SortableTask
                                 key={task.id}
                                 task={task}
                                 isCompleted={completedTasks.has(task.id)}
                                 toggleTaskCompletion={toggleTaskCompletion}
                                 deleteTask={deleteTask}
                                 onTaskDoubleClick={handleTaskDoubleClick}
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
                    isCompleted={completedTasks.has(activeId)}
                    isDragging
                    toggleTaskCompletion={() => {}}
                    deleteTask={() => {}}
                    onTaskDoubleClick={() => {}}
                />
            ) : null}
        </DragOverlay>
        <TaskDetailsDialog
            task={selectedTask}
            onClose={handleCloseTaskDetails}
            updateTaskDetails={updateTaskDetails}
        />
    </DndContext>
  );
}
