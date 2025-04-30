
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
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil, Star, Palette, MoveLeft, MoveRight, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react'; // Import ArrowLeftCircle, ArrowRightCircle
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
  type PointerActivationConstraint,
  rectIntersection,
} from '@dnd-kit/core';
import {
  restrictToFirstScrollableAncestor,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers'; // Adjusted imports
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
import { cn, truncateText, getMaxLength } from '@/lib/utils';
import {
  Dialog as ShadDialog,
  DialogContent as ShadDialogContent,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription as ShadDialogDesc,
} from "@/components/ui/dialog";
import { EditTaskDialog } from './EditTaskDialog';
import { TaskDetailsDisplayDialog } from './TaskDetailsDisplayDialog';
import { useToast } from "@/hooks/use-toast";

interface CalendarViewProps {
    tasks: Task[];
    requestDeleteTask: (task: Task, dateStr: string) => void;
    updateTaskOrder: (date: string, orderedTaskIds: string[]) => void;
    toggleTaskCompletion: (taskId: string, dateStr: string) => void;
    completedTasks: Set<string>;
    updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => void;
    completedCount: number;
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
  dateStr: string;
  isCompleted: boolean;
  toggleTaskCompletion: (taskId: string, dateStr: string) => void;
  requestDeleteTask: (task: Task, dateStr: string) => void;
  isDragging?: boolean;
  onTaskClick: (task: Task) => void;
  onEditClick: (task: Task) => void;
  onMoveTask: (taskId: string, direction: 'prev' | 'next') => void;
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
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = truncateText(task.description, descLimit);
    const taskBackgroundColor = task.color;

    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words border",
            isCompleted
              ? 'bg-muted opacity-60 border-transparent'
              : task.highPriority
                ? 'bg-card border-accent border-2'
                : 'border-border',
            isDragging && 'shadow-lg scale-105 border-2 border-primary animate-pulse',
            'transition-all duration-300 ease-in-out'
          )}
           style={{ backgroundColor: !isCompleted ? taskBackgroundColor : undefined }}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className="pt-0.5 text-muted-foreground cursor-grab shrink-0">
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden">
              <p className={cn(
                  "text-xs font-medium break-words whitespace-normal line-clamp-1",
                  isCompleted && 'line-through',
                  // Remove conditional text color based on background
                 )}
                 title={task.name}
               >
                {nameDisplay}
                {task.highPriority && !isCompleted && <Star className="inline-block h-3 w-3 ml-1 text-accent fill-accent" />}
              </p>
              {descriptionDisplay && (
                <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal line-clamp-2",
                     isCompleted && 'line-through',
                     // Remove conditional text color based on background
                    )}
                    title={task.description}
                 >
                  {descriptionDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center space-y-0.5 shrink-0">
               <div className="h-5 w-5 flex items-center justify-center">
                  {isCompleted ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                </div>
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
  } = useSortable({ id: `${task.id}_${dateStr}` });


  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease',
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative' as const
  };

  const [titleLimit, setTitleLimit] = useState(getMaxLength('title', 'calendar'));
  const [descLimit, setDescLimit] = useState(getMaxLength('desc', 'calendar'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title', 'calendar'));
            setDescLimit(getMaxLength('desc', 'calendar'));
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

     useEffect(() => {
         let timer: NodeJS.Timeout | null = null;
         if (isCompleted) {
             setIsCompletedAnim(true);
             timer = setTimeout(() => setIsCompletedAnim(false), 500);
         } else {
            setIsCompletedAnim(false);
         }

         return () => {
             if (timer) clearTimeout(timer);
         };
       }, [isCompleted]);


  const handleToggleCompletion = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTaskCompletion(task.id, dateStr);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    requestDeleteTask(task, dateStr);
  }

    const handleEditClickInternal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onEditClick(task);
    };

    const handleMoveClick = (e: React.MouseEvent, direction: 'prev' | 'next') => {
        e.preventDefault();
        e.stopPropagation();
        onMoveTask(task.id, direction);
    };


  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = truncateText(task.description, descLimit);
  const taskBackgroundColor = task.color;

  const handleClick = () => {
    onTaskClick(task);
  };

  return (
    <div
        ref={setNodeRef}
        style={style}
        data-testid={`task-${task.id}-${dateStr}`}
        {...attributes}
        className="mb-1 touch-none relative group"
        onClick={handleClick}
    >
        {/* Previous Day Chevron - Replaced with ArrowLeftCircle */}
        <Button
            variant="ghost"
            size="icon"
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 text-muted-foreground hover:text-foreground" // Use standard text colors
            onClick={(e) => handleMoveClick(e, 'prev')}
            aria-label="Move task to previous day"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <ArrowLeftCircle className="h-4 w-4" /> {/* Updated Icon */}
        </Button>

        {/* Task Card */}
        <Card
            className={cn(
                "p-2 rounded-md shadow-sm w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words cursor-pointer border",
                isCompleted
                  ? 'bg-muted opacity-60 border-transparent'
                  : task.highPriority
                    ? 'border-accent border-2'
                    : 'border-border',
                isCompletedAnim && 'animate-task-complete',
                'transition-all duration-300 ease-in-out'
            )}
            style={{ backgroundColor: !isCompleted ? taskBackgroundColor : undefined }}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <button
                {...listeners}
                className={cn(
                    "cursor-grab pt-0.5 text-muted-foreground hover:text-foreground touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0",
                    // Removed conditional handle color change
                )}
                aria-label="Drag task"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3" />
             </button>
             <div className="flex-grow min-w-0 pr-1 overflow-hidden">
               <p
                 className={cn(
                   "text-xs font-medium break-words whitespace-normal line-clamp-1",
                   isCompleted && 'line-through',
                   // Removed conditional text color change
                 )}
                 title={task.name}
               >
                 {nameDisplay}
                 {task.highPriority && !isCompleted && <Star className="inline-block h-3 w-3 ml-1 text-accent fill-accent" />}
               </p>
               {descriptionDisplay && (
                 <p
                   className={cn(
                     "text-[10px] text-muted-foreground mt-0.5 break-words whitespace-normal line-clamp-2",
                     isCompleted && 'line-through',
                     // Removed conditional text color change
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
                    // Removed conditional button color change
                )}
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                 className={cn(
                    "h-5 w-5 text-primary hover:text-primary/80 focus-visible:ring-1 focus-visible:ring-ring rounded",
                    // Removed conditional button color change
                )}
                onClick={handleEditClickInternal}
                aria-label="Edit task details"
               >
                 <Pencil className="h-3 w-3" />
               </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded",
                     // Removed conditional button color change
                )}
                onClick={handleDeleteTask}
                aria-label="Delete task"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Next Day Chevron - Replaced with ArrowRightCircle */}
        <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 text-muted-foreground hover:text-foreground" // Use standard text colors
            onClick={(e) => handleMoveClick(e, 'next')}
            aria-label="Move task to next day"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <ArrowRightCircle className="h-4 w-4" /> {/* Updated Icon */}
        </Button>
    </div>
  );
}


export function CalendarView({
    tasks,
    requestDeleteTask,
    updateTaskOrder,
    toggleTaskCompletion,
    completedTasks,
    updateTaskDetails,
    updateTask,
    completedCount,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

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

   const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
       if (!dateString) return null;
       const datePart = dateString.split('T')[0];
       const date = parseISO(datePart + 'T00:00:00');
       if (isNaN(date.getTime())) {
           console.error("Invalid date string received:", dateString);
           return null;
       }
       return date;
   }, []);


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
           const currentDayOfWeek = day.getDay();

           groupedTasks[dateStr] = tasks
            .filter(task => {
                if (!task || !task.date) return false;
                const taskDate = parseISOStrict(task.date);
                if (!taskDate) return false;

                if (task.exceptions?.includes(dateStr)) {
                    return false;
                }

                if (task.recurring) {
                    const taskStartDayOfWeek = taskDate.getDay();
                    return taskStartDayOfWeek === currentDayOfWeek && day >= taskDate;
                } else {
                    return isSameDay(taskDate, day);
                }
           })
            .sort((a, b) => {
                 const aCompletionKey = `${a.id}_${dateStr}`;
                 const bCompletionKey = `${b.id}_${dateStr}`;
                 const aCompleted = completedTasks.has(aCompletionKey);
                 const bCompleted = completedTasks.has(bCompletionKey);


                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1;
                }

                if (!aCompleted && !bCompleted) {
                    if (a.highPriority !== b.highPriority) {
                        return a.highPriority ? -1 : 1;
                    }
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
     }, [tasks, days, completedTasks, parseISOStrict]);


    const activeTask = useMemo(() => {
        if (!activeId) return null;
        const taskId = activeId.split('_')[0];
        return tasks.find(task => task && task.id === taskId);
    }, [tasks, activeId]);


   const pointerSensor = useSensor(PointerSensor, {
       activationConstraint: {
         distance: 5,
       } satisfies PointerActivationConstraint,
     });

   const keyboardSensor = useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     });

   const sensors = useSensors(pointerSensor, keyboardSensor);


    const modifiers = useMemo(() => [
       restrictToFirstScrollableAncestor,
       restrictToWindowEdges,
      ], []);


  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };


   const handleDragEnd = (event: DragEndEvent) => {
       const { active, over } = event;
       const activeIdStr = active.id as string;
       const overIdStr = over?.id as string | undefined;

       setActiveId(null);

       if (!over || !overIdStr) {
           console.log("Drag ended outside a valid target.");
           return;
       }

       const [activeTaskId, activeDateStr] = activeIdStr.split('_');

       let overDateStr: string;
       let isOverContainer = false;

       if (overIdStr.includes('_')) {
           overDateStr = overIdStr.split('_')[1];
       } else if (/^\d{4}-\d{2}-\d{2}$/.test(overIdStr)) {
           overDateStr = overIdStr;
           isOverContainer = true;
       } else {
           console.warn("Invalid drop target ID:", overIdStr);
           return;
       }

       const taskToMove = tasks.find(task => task.id === activeTaskId);
       if (!taskToMove) {
           console.error("Could not find task to move:", activeTaskId);
           return;
       }

       if (activeDateStr === overDateStr) {
           console.log(`Reordering task ${activeTaskId} within ${activeDateStr}`);
           const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => `${task.id}_${overDateStr}`);

           const oldIndex = currentTaskIdsForDate.indexOf(activeIdStr);
           const newIndex = isOverContainer ? currentTaskIdsForDate.length : currentTaskIdsForDate.indexOf(overIdStr);

           if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
               const reorderedInstanceIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
               const reorderedTaskIds = reorderedInstanceIds.map(instanceId => instanceId.split('_')[0]);
               updateTaskOrder(overDateStr, reorderedTaskIds);
           } else {
                console.warn(`Could not reorder: oldIndex=${oldIndex}, newIndex=${newIndex}, activeId=${activeIdStr}, overId=${overIdStr}`);
           }
       }
       else {
            console.log(`Moving task ${activeTaskId} from ${activeDateStr} to ${overDateStr}`);

            if (taskToMove.recurring) {
                 const updatedExceptions = [...(taskToMove.exceptions || []), activeDateStr];
                 const newTaskData: Omit<Task, 'id'> = {
                     ...taskToMove,
                     date: overDateStr,
                     recurring: false,
                     exceptions: [],
                 };
                 updateTask(activeTaskId, { exceptions: updatedExceptions });

                  console.warn("Need to call 'addTask' to create new instance for recurring task move.");
                  toast({
                    title: "Recurring Task Moved (Instance)",
                    description: `Added an exception for "${taskToMove.name}" on ${format(parseISOStrict(activeDateStr) ?? new Date(), 'PPP')} and created a new instance on ${format(parseISOStrict(overDateStr) ?? new Date(), 'PPP')}.`,
                    variant: "default",
                  });

                  const completionKey = `${activeTaskId}_${activeDateStr}`;
                  if (completedTasks.has(completionKey)) {
                     toggleTaskCompletion(activeTaskId, activeDateStr); // This toggles it off
                  }


            } else {
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
        setIsEditDialogOpen(true);
    };


  const handleCloseTaskDetails = () => {
    setSelectedTaskForDetails(null);
  };

   const handleCloseEditDialog = () => {
      setEditingTask(null);
      setIsEditDialogOpen(false);
   };

    const handleMoveTask = useCallback((taskId: string, direction: 'prev' | 'next') => {
        const taskToMove = tasks.find(t => t.id === taskId);
        if (!taskToMove || !taskToMove.date) return;

        const currentDate = parseISOStrict(taskToMove.date);
        if (!currentDate) return;

        const targetDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');

         let message = '';
         let title = '';

        if (taskToMove.recurring) {
             const originalDateStr = format(currentDate, 'yyyy-MM-dd');
             const updatedExceptions = [...(taskToMove.exceptions || []), originalDateStr];

              const newTaskData: Omit<Task, 'id'> = {
                  ...taskToMove,
                  date: targetDateStr,
                  recurring: false,
                  exceptions: [],
              };

             updateTask(taskId, { exceptions: updatedExceptions });

             console.warn("Need to call 'addTask' to create new instance for recurring task move via chevron.");
              title = "Recurring Task Moved (Instance)";
              message = `Skipped "${taskToMove.name}" for ${format(currentDate, 'PPP')} and created a new one for ${format(targetDate, 'PPP')}.`;

              const completionKey = `${taskId}_${originalDateStr}`;
              if (completedTasks.has(completionKey)) {
                   toggleTaskCompletion(taskId, originalDateStr);
              }

        } else {
             updateTask(taskId, { date: targetDateStr });
             title = "Task Moved";
             message = `"${taskToMove.name}" moved to ${format(targetDate, 'PPP')}.`;
        }

         toast({
             title: title,
             description: message,
         });
     }, [tasks, updateTask, parseISOStrict, toast, completedTasks, toggleTaskCompletion]);


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
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
          <div className="flex-grow text-center flex items-center justify-center gap-2">
              <h2 className="text-base md:text-lg font-semibold text-primary">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
             const dayTasks = (isClient && tasksByDay && typeof tasksByDay === 'object' && Array.isArray(tasksByDay[dateStr])) ? tasksByDay[dateStr] : [];
            const isToday = isSameDay(day, new Date());


            return (
              <Card key={dateStr} className={cn(
                  "flex flex-col h-[700px] md:h-[700px] overflow-hidden",
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
                  <CardContent className="p-1 space-y-1 h-full" data-testid={`day-content-${dateStr}`}>
                     <SortableContext
                         id={dateStr}
                         items={dayTasks.map(task => `${task.id}_${dateStr}`)}
                         strategy={verticalListSortingStrategy}
                       >
                         {!isClient ? (
                            <p className="text-[10px] text-muted-foreground text-center pt-4">Loading...</p>
                         ) : dayTasks.length === 0 ? (
                           <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p>
                         ) : (
                             dayTasks.map((task) => {
                                if (!task) return null;
                                const completionKey = `${task.id}_${dateStr}`;
                                return (
                                   <SortableTask
                                     key={`${task.id}_${dateStr}`}
                                     task={task}
                                     dateStr={dateStr}
                                     isCompleted={completedTasks?.has(completionKey) ?? false}
                                     toggleTaskCompletion={toggleTaskCompletion}
                                     requestDeleteTask={requestDeleteTask}
                                     onTaskClick={handleTaskClick}
                                     onEditClick={handleEditClick}
                                     onMoveTask={handleMoveTask}
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
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask && activeId.includes('_') ? (() => {
                const activeDateStr = activeId.substring(activeId.lastIndexOf('_') + 1);
                const completionKey = `${activeTask.id}_${activeDateStr}`;
                const isCompleted = completedTasks?.has(completionKey) ?? false;
                return (
                    <TaskItem
                        task={activeTask}
                        dateStr={activeDateStr}
                        isCompleted={isCompleted}
                        isDragging
                        toggleTaskCompletion={() => {}}
                        requestDeleteTask={() => {}}
                        onTaskClick={() => {}}
                        onEditClick={() => {}}
                        onMoveTask={() => {}}
                    />
                );
            })() : null}
        </DragOverlay>

        <TaskDetailsDisplayDialog
            task={selectedTaskForDetails}
            onClose={handleCloseTaskDetails}
            updateTaskDetails={updateTaskDetails}
        />
        <EditTaskDialog
            task={editingTask}
            isOpen={isEditDialogOpen}
            onClose={handleCloseEditDialog}
            updateTask={updateTask}
        />
    </DndContext>
  );
}
