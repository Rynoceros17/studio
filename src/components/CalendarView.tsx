
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
} from '@dnd-kit/core';
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

interface CalendarViewProps {
  tasks: Task[];
  deleteTask: (id: string) => void;
  updateTaskOrder: (date: string, orderedTaskIds: string[]) => void;
}

interface SortableTaskProps {
  task: Task;
  isCompleted: boolean;
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
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
    transition,
    zIndex: isDragging ? 10 : 'auto', // Ensure dragged item is on top
    opacity: isDragging ? 0.8 : 1, // Slightly fade dragged item
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 transition-colors duration-200 touch-none relative", // Add touch-none
        isCompleted ? 'bg-muted opacity-60' : 'bg-card',
        isDragging && 'shadow-lg scale-105' // Add shadow and slight scale when dragging
      )}
    >
      <div className="flex items-start justify-between gap-2">
         {/* Drag Handle */}
         <div {...attributes} {...listeners} className="cursor-grab p-1 -ml-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
         </div>
        <div className="flex-grow">
          <p className={cn("text-sm font-medium", isCompleted && 'line-through')}>{task.name}</p>
          {task.description && (
            <p className={cn("text-xs text-muted-foreground", isCompleted && 'line-through')}>{task.description}</p>
          )}
        </div>
        <div className="flex flex-col items-center space-y-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-green-600 hover:text-green-700"
            onClick={() => toggleTaskCompletion(task.id)}
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive/80"
            onClick={() => deleteTask(task.id)}
            aria-label="Delete task"
            disabled={isCompleted} // Optionally disable delete for completed tasks
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}


export function CalendarView({ tasks, deleteTask, updateTaskOrder }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Load completed tasks from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompleted = window.localStorage.getItem('completedTasks');
      if (storedCompleted) {
        setCompletedTasks(new Set(JSON.parse(storedCompleted)));
      }
    }
  }, []);

  // Update local storage when completed tasks change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('completedTasks', JSON.stringify(Array.from(completedTasks)));
    }
  }, [completedTasks]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start week on Monday
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

  // Keep tasks grouped by day, this structure is needed for dnd-kit
  const tasksByDay = useMemo(() => {
    const groupedTasks: { [key: string]: Task[] } = {};
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      // Make sure tasks for the day are already sorted by their original order (if any)
      // In this case, we rely on the order from the main tasks array which is sorted by date
      groupedTasks[dateStr] = tasks.filter(task => isSameDay(parseISO(task.date), day));
    });
    return groupedTasks;
  }, [tasks, days]);


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Require a small drag distance
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, activatorEvent } = event;

    // Find the date column the drag occurred in
    // This assumes the droppable container has an ID like 'droppable-yyyy-MM-dd'
    const findDateContainer = (element: HTMLElement | null): string | null => {
        while (element) {
            if (element.id?.startsWith('droppable-')) {
                return element.id.replace('droppable-', '');
            }
            element = element.parentElement;
        }
        return null;
    };

    const dateStr = findDateContainer(activatorEvent.target as HTMLElement);


    if (dateStr && over && active.id !== over.id) {
      const currentTasks = tasksByDay[dateStr] || [];
      const oldIndex = currentTasks.findIndex(task => task.id === active.id);
      const newIndex = currentTasks.findIndex(task => task.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedTaskIds = arrayMove(currentTasks, oldIndex, newIndex).map(task => task.id);
          updateTaskOrder(dateStr, reorderedTaskIds);
      }
    }
  };


  const goToPreviousWeek = () => {
    setCurrentDate(subDays(weekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentDate(addDays(weekEnd, 1));
  };

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
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
            const dayTasks = tasksByDay[dateStr] || [];
            const isToday = isSameDay(day, new Date());

            return (
              <Card key={dateStr} id={`droppable-${dateStr}`} className={cn("flex flex-col h-[400px] md:h-[500px]", isToday ? 'border-accent border-2 shadow-md' : 'bg-secondary/50')}>
                <CardHeader className="p-3 text-center">
                  <CardTitle className="text-sm font-medium">
                    {format(day, 'EEE')} {/* Day name */}
                  </CardTitle>
                  <CardDescription className={cn("text-lg font-bold", isToday ? 'text-accent' : 'text-foreground')}>
                    {format(day, 'd')} {/* Day number */}
                  </CardDescription>
                  {isToday && <Badge variant="outline" className="border-accent text-accent mt-1">Today</Badge>}
                </CardHeader>
                <Separator />
                <ScrollArea className="flex-grow">
                  <CardContent className="p-3 space-y-2">
                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center pt-4">No tasks</p>
                    ) : (
                       <SortableContext
                         items={dayTasks.map(task => task.id)}
                         strategy={verticalListSortingStrategy}
                       >
                         {dayTasks.map((task) => (
                           <SortableTask
                             key={task.id}
                             task={task}
                             isCompleted={completedTasks.has(task.id)}
                             toggleTaskCompletion={toggleTaskCompletion}
                             deleteTask={deleteTask}
                           />
                         ))}
                       </SortableContext>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
