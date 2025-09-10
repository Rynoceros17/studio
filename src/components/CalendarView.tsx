
"use client";

import type * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil, Star, ArrowLeftCircle, ArrowRightCircle, Edit } from 'lucide-react';
import { useTheme } from 'next-themes';
import useLocalStorage from '@/hooks/useLocalStorage';

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
  restrictToVerticalAxis,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import type { Task, SingleTaskOutput } from '@/lib/types';
import { cn, truncateText, getMaxLength, parseISOStrict } from '@/lib/utils';

import { EditTaskDialog } from './EditTaskDialog';
import { TaskDetailsDisplayDialog } from './TaskDetailsDisplayDialog';
import { useToast } from "@/hooks/use-toast";

interface CalendarViewProps {
    tasks: Task[];
    pendingAiTasks: SingleTaskOutput[];
    requestDeleteTask: (task: Task, dateStr: string) => void;
    updateTaskOrder: (date: string, orderedTaskIds: string[]) => void;
    toggleTaskCompletion: (taskId: string, dateStr: string) => void;
    completedTasks: Set<string>;
    updateTaskDetails: (id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    completedCount: number;
    requestMoveRecurringTask: (task: Task, originalDateStr: string, newDateStr: string) => void;
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
  task: Task & { isPending?: boolean };
  dateStr: string;
  isCompleted: boolean;
  isPending?: boolean;
  toggleTaskCompletion: (taskId: string, dateStr: string) => void;
  requestDeleteTask: (task: Task, dateStr: string) => void;
  isDragging?: boolean;
  onTaskClick: (task: Task) => void;
  onEditClick: (task: Task) => void;
  onMoveTask: (taskId: string, dateStr: string, direction: 'prev' | 'next') => void;
}

const lightBackgroundColors = [
  'hsl(0 0% 100%)',
  'hsl(259 67% 88%)',
  'hsl(259 67% 92%)',
  'hsl(50, 100%, 90%)',
  'hsl(45, 90%, 85%)',
  'hsl(55, 80%, 80%)',
  'hsl(259 67% 82%)',
];

function TaskItem({ task, isCompleted, isDragging, isPending }: SortableTaskProps) {
    const { theme } = useTheme();
    const [titleLimit, setTitleLimit] = useState(getMaxLength('title', 'calendar'));
    const [descLimit, setDescLimit] = useState(getMaxLength('desc', 'calendar'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title', 'calendar'));
            setDescLimit(getMaxLength('desc', 'calendar'));
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
            handleResize();
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);


    const nameDisplay = truncateText(task.name, titleLimit);
    const descriptionDisplay = task.description ? truncateText(task.description, descLimit) : null;
    const timeDisplay = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : null;

    let cardBgClass = 'bg-card';
    let textColorClass = 'text-card-foreground';
    let descColorClass = 'text-muted-foreground';
    let cardBorderStyle = 'border-border';

    const cardCustomStyle: React.CSSProperties = {};
    
    if (isPending) {
        cardBgClass = 'bg-background/30 backdrop-blur-sm';
        cardBorderStyle = 'border-dashed border-primary/50';
    } else if (isCompleted) {
        cardBgClass = 'bg-muted opacity-60';
        textColorClass = 'text-muted-foreground';
        descColorClass = 'text-muted-foreground';
        cardBorderStyle = 'border-transparent';
    } else {
        cardBorderStyle = task.highPriority ? 'border-accent border-2' : 'border-border';

        const isDefaultWhite = task.color === 'hsl(0 0% 100%)';
        const isDarkMode = theme === 'dark';
        let colorToApply = task.color;

        if (isDefaultWhite && isDarkMode) {
            colorToApply = 'hsl(259 67% 82%)';
        }

        if (colorToApply) {
            cardCustomStyle.backgroundColor = colorToApply;
            cardBgClass = ''; // Use style prop
        }

        const isLightColor = colorToApply && lightBackgroundColors.includes(colorToApply);

        if (isLightColor) {
            textColorClass = 'text-neutral-800';
            descColorClass = 'text-neutral-700';
        } else {
            textColorClass = 'text-card-foreground';
            descColorClass = 'text-muted-foreground';
        }
    }


    return (
        <Card
          className={cn(
            "p-2 rounded-md shadow-md w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words",
            cardBorderStyle,
            cardBgClass,
            isDragging && 'shadow-xl scale-105',
            'transition-all duration-300 ease-in-out'
          )}
          style={cardCustomStyle}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <div className={cn("pt-0.5 cursor-grab shrink-0", textColorClass)}>
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden">
              <p className={cn( "text-xs font-medium break-words whitespace-normal line-clamp-1", textColorClass, isCompleted && 'line-through' )} title={task.name} >
                {nameDisplay}
              </p>
              {timeDisplay && (
                <p className={cn("text-[10px] font-mono", descColorClass, isCompleted && 'line-through')}>{timeDisplay}</p>
              )}
              {descriptionDisplay && !timeDisplay && (
                <p className={cn("text-[10px] mt-0.5 break-words whitespace-normal line-clamp-2", descColorClass, isCompleted && 'line-through')} title={task.description ?? ''}>
                  {descriptionDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center space-y-0.5 shrink-0">
               <div className={cn("h-5 w-5 flex items-center justify-center", isCompleted ? 'text-green-600' : textColorClass )}>
                  {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                </div>
               <div className={cn("h-5 w-5 flex items-center justify-center", textColorClass )}>
                 <Edit className="h-3 w-3" />
               </div>
               <div className="h-5 w-5 flex items-center justify-center text-destructive">
                  <Trash2 className="h-3 w-3" />
                </div>
            </div>
          </div>
        </Card>
    );
}

function SortableTask({ task, dateStr, isCompleted, toggleTaskCompletion, requestDeleteTask, onTaskClick, onEditClick, onMoveTask, isPending }: SortableTaskProps) {
  const { theme } = useTheme();
  const [isCompletedAnim, setIsCompletedAnim] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${task.id}_${dateStr}`, disabled: isPending });


  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease',
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative' as const,
  };

  const [titleLimit, setTitleLimit] = useState(getMaxLength('title', 'calendar'));
  const [descLimit, setDescLimit] = useState(getMaxLength('desc', 'calendar'));

    useEffect(() => {
        const handleResize = () => {
            setTitleLimit(getMaxLength('title', 'calendar'));
            setDescLimit(getMaxLength('desc', 'calendar'));
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
            handleResize();
            return () => window.removeEventListener('resize', handleResize);
        }
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
      e.stopPropagation();
      toggleTaskCompletion(task.id, dateStr);
  };

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteTask(task, dateStr);
  }

    const handleEditClickInternal = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEditClick(task);
    };

    const handleMoveClick = (e: React.MouseEvent, direction: 'prev' | 'next') => {
        e.stopPropagation();
        onMoveTask(task.id, dateStr, direction);
    };


  const nameDisplay = truncateText(task.name, titleLimit);
  const descriptionDisplay = task.description ? truncateText(task.description, descLimit) : null;
  const timeDisplay = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : null;


    let cardBgClass = 'bg-card';
    let textColorClass = 'text-card-foreground';
    let descColorClass = 'text-muted-foreground';
    let iconButtonClass = 'text-muted-foreground hover:text-foreground';
    let completeIconClass = 'text-muted-foreground';
    let cardBorderStyle = 'border-border';

    const cardCustomStyle: React.CSSProperties = {};

    if (isPending) {
        cardBgClass = 'bg-background/30 backdrop-blur-sm';
        cardBorderStyle = 'border-dashed border-primary/50';
    } else if (isCompleted) {
        cardBgClass = 'bg-muted opacity-60';
        textColorClass = 'text-muted-foreground';
        descColorClass = 'text-muted-foreground';
        iconButtonClass = 'text-muted-foreground';
        completeIconClass = 'text-green-600';
        cardBorderStyle = 'border-transparent';
    } else {
        cardBorderStyle = task.highPriority ? 'border-accent border-2' : 'border-border';

        const isDefaultWhite = task.color === 'hsl(0 0% 100%)';
        const isDarkMode = theme === 'dark';
        let colorToApply = task.color;

        if (isDefaultWhite && isDarkMode) {
            colorToApply = 'hsl(259 67% 82%)';
        }

        if (colorToApply) {
            cardCustomStyle.backgroundColor = colorToApply;
            cardBgClass = ''; // Use style prop
        }

        const isLightColor = colorToApply && lightBackgroundColors.includes(colorToApply);

        if (isLightColor) {
            textColorClass = 'text-neutral-800';
            descColorClass = 'text-neutral-700';
            iconButtonClass = 'text-neutral-600 hover:text-neutral-800';
            completeIconClass = 'text-neutral-600';
        } else {
            textColorClass = 'text-card-foreground';
            descColorClass = 'text-muted-foreground';
            iconButtonClass = 'text-muted-foreground hover:text-foreground';
            completeIconClass = 'text-muted-foreground';
        }
    }

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !isPending) {
        onTaskClick(task);
    } else {
        e.preventDefault();
    }
  };


  return (
    <div
        ref={setNodeRef}
        style={style}
        data-testid={`task-${task.id}_${dateStr}`}
        {...attributes}
        className={cn("mb-1 touch-none relative", !isPending && "group")}
        onClick={handleClick}
    >
       {!isPending && (
         <>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100",
                    iconButtonClass
                )}
                onClick={(e) => handleMoveClick(e, 'prev')}
                aria-label="Move task to previous day"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <ArrowLeftCircle className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100",
                    iconButtonClass
                    )}
                onClick={(e) => handleMoveClick(e, 'next')}
                aria-label="Move task to next day"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <ArrowRightCircle className="h-4 w-4" />
            </Button>
         </>
       )}

        <Card
            className={cn(
                "p-2 rounded-md shadow-md w-full overflow-hidden h-auto min-h-[60px] flex flex-col justify-between break-words transition-all duration-200",
                !isPending && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
                cardBorderStyle,
                cardBgClass,
                isCompletedAnim && 'animate-task-complete'
            )}
            style={cardCustomStyle}
        >
          <div className="flex items-start justify-between gap-1 flex-grow">
             <button
                {...listeners}
                className={cn(
                    "cursor-grab pt-0.5 touch-none focus-visible:ring-1 focus-visible:ring-ring rounded shrink-0",
                     iconButtonClass,
                     isPending && "cursor-not-allowed opacity-50"
                )}
                aria-label="Drag task"
                onClick={(e) => e.stopPropagation()}
                disabled={isPending}
              >
                <GripVertical className="h-3 w-3" />
             </button>
             <div className="flex-grow min-w-0 pr-1 overflow-hidden">
               <p className={cn( "text-xs font-medium break-words whitespace-normal line-clamp-1", textColorClass, isCompleted && 'line-through' )} title={task.name} >
                 {nameDisplay}
               </p>
              {timeDisplay && (
                <p className={cn("text-[10px] font-mono", descColorClass, isCompleted && 'line-through')}>{timeDisplay}</p>
              )}
              {descriptionDisplay && !timeDisplay && (
                <p className={cn("text-[10px] mt-0.5 break-words whitespace-normal line-clamp-2", descColorClass, isCompleted && 'line-through')} title={task.description ?? ''}>
                  {descriptionDisplay}
                </p>
              )}
             </div>

            <div className="flex flex-col items-center space-y-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-5 w-5 focus-visible:ring-1 focus-visible:ring-ring rounded", completeIconClass, isCompleted && 'hover:text-green-700', !isCompleted && 'hover:text-foreground')}
                onClick={handleToggleCompletion}
                aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                disabled={isPending}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                 className={cn("h-5 w-5 focus-visible:ring-1 focus-visible:ring-ring rounded", iconButtonClass)}
                onClick={handleEditClickInternal}
                aria-label="Edit task details"
                disabled={isPending}
               >
                 <Edit className="h-3 w-3" />
               </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-5 w-5 text-destructive hover:text-destructive/80 focus-visible:ring-1 focus-visible:ring-ring rounded")}
                onClick={handleDeleteTask}
                aria-label="Delete task"
                disabled={isPending}
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
    pendingAiTasks,
    requestDeleteTask,
    updateTaskOrder,
    toggleTaskCompletion,
    completedTasks,
    updateTaskDetails,
    updateTask,
    completedCount,
    requestMoveRecurringTask,
}: CalendarViewProps) {
  const [currentDisplayDate, setCurrentDisplayDate] = useState(() => startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<'week' | 'today'>('week');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [today, setToday] = useState<Date | null>(null);
  const [weekName, setWeekName] = useLocalStorage('weekwise-week-name', 'My Week');

  useEffect(() => {
      setIsClient(true);
      setToday(startOfDay(new Date()));
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
        const newViewMode = window.innerWidth >= 768 ? 'week' : 'today';
        setViewMode(currentInternalViewMode => {
            if (currentInternalViewMode !== newViewMode) {
                if (newViewMode === 'today') {
                    setCurrentDisplayDate(startOfDay(new Date()));
                } else {
                    setCurrentDisplayDate(prevDate => startOfWeek(prevDate, { weekStartsOn: 1 }));
                }
            }
            return newViewMode;
        });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isClient]);


   const days = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const daysArray = [];
      let day = weekStart;
      while (day <= weekEnd) {
        daysArray.push(new Date(day));
        day = addDays(day, 1);
      }
      return daysArray;
    } else {
      return [currentDisplayDate];
    }
  }, [currentDisplayDate, viewMode]);


   const tasksByDay = useMemo(() => {
       const groupedTasks: { [key: string]: (Task & { isPending?: boolean })[] } = {};
       if (!tasks || !Array.isArray(tasks)) {
           console.error("Tasks data is invalid:", tasks);
           return groupedTasks;
       }

       days.forEach(day => {
           const dateStr = format(day, 'yyyy-MM-dd');
           const currentDayOfWeek = day.getDay();
           
           const regularTasks = tasks
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
                 const aCompleted = completedTasks?.has(aCompletionKey);
                 const bCompleted = completedTasks?.has(bCompletionKey);

                if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
                if (!aCompleted && !bCompleted && a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
                
                const originalAIndex = tasks.findIndex(t => t && t.id === a.id);
                const originalBIndex = tasks.findIndex(t => t && t.id === b.id);
                if (originalAIndex === -1 || originalBIndex === -1) return 0;
                return originalAIndex - originalBIndex;
            });
            
            const pendingTasksForDay = (pendingAiTasks || [])
                .filter(task => task.date === dateStr)
                .map((pendingTask, index) => ({
                    ...pendingTask,
                    id: `pending_${dateStr}_${index}`,
                    isPending: true,
                    details: null, 
                    dueDate: undefined,
                    exceptions: [],
                }));

            groupedTasks[dateStr] = [...regularTasks, ...pendingTasksForDay];
       });
       return groupedTasks;
     }, [tasks, pendingAiTasks, days, completedTasks]);


    const activeTask = useMemo(() => {
        if (!activeId) return null;
        const taskId = activeId.split('_')[0];
        if (taskId.startsWith('pending')) {
            return tasksByDay[activeId.split('_')[1]].find(t => t.id === activeId);
        }
        return tasks.find(task => task && task.id === taskId);
    }, [activeId, tasks, tasksByDay]);


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
       restrictToVerticalAxis,
      ], []);


  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };


   const handleDragEnd = (event: DragEndEvent) => {
       const { active, over } = event;
       const activeIdStr = active.id as string;
       const overIdStr = over?.id as string | undefined;

       setActiveId(null);

       if (!over || !overIdStr) {
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
           return;
       }

       const taskToMove = tasks.find(task => task.id === activeTaskId);
       if (!taskToMove) return;

       if (activeDateStr === overDateStr) { // Reordering within the same day
           const currentTaskIdsForDate = (tasksByDay?.[overDateStr] || []).map(task => `${task.id}_${overDateStr}`);
           const oldIndex = currentTaskIdsForDate.indexOf(activeIdStr);
           const newIndex = isOverContainer ? currentTaskIdsForDate.length : currentTaskIdsForDate.indexOf(overIdStr);

           if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
               const reorderedInstanceIds = arrayMove(currentTaskIdsForDate, oldIndex, newIndex);
               const reorderedTaskIds = reorderedInstanceIds.map(instanceId => instanceId.split('_')[0]);
               updateTaskOrder(overDateStr, reorderedTaskIds);
           }
       } else { // Moving to a different day
            if (taskToMove.recurring) {
                requestMoveRecurringTask(taskToMove, activeDateStr, overDateStr);
            } else {
                 updateTask(activeTaskId, { ...taskToMove, date: overDateStr });
                 toast({
                    title: "Task Moved",
                    description: `"${taskToMove.name}" moved to ${format(parseISOStrict(overDateStr)!, 'PPP')}.`,
                 });
            }
       }
   };

  const handleDragCancel = () => setActiveId(null);

  const goToPrevious = () => {
    setCurrentDisplayDate(prev => {
        if (viewMode === 'week') {
            return subDays(prev, 7);
        } else {
            return subDays(prev, 1);
        }
    });
  };

  const goToNext = () => {
    setCurrentDisplayDate(prev => {
        if (viewMode === 'week') {
            return addDays(prev, 7);
        } else {
            return addDays(prev, 1);
        }
    });
  };

    const handleTaskClick = (task: Task) => setSelectedTaskForDetails(task);
    const handleEditClick = (task: Task) => {
        setEditingTask(task);
        setIsEditDialogOpen(true);
    };
    const handleCloseTaskDetails = () => setSelectedTaskForDetails(null);
    const handleCloseEditDialog = () => {
      setEditingTask(null);
      setIsEditDialogOpen(false);
   };

    const handleMoveTask = useCallback((taskId: string, currentTaskDateStr: string, direction: 'prev' | 'next') => {
        const taskToMove = tasks.find(t => t.id === taskId);
        if (!taskToMove) return;

        const currentInstanceDate = parseISOStrict(currentTaskDateStr);
        if (!currentInstanceDate) return;

        const targetDate = direction === 'prev' ? subDays(currentInstanceDate, 1) : addDays(currentInstanceDate, 1);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');

        if (taskToMove.recurring) {
            requestMoveRecurringTask(taskToMove, currentTaskDateStr, targetDateStr);
        } else {
             updateTask(taskId, { ...taskToMove, date: targetDateStr });
             toast({
                title: "Task Moved",
                description: `"${taskToMove.name}" moved to ${format(targetDate, 'PPP')}.`,
             });
        }
     }, [tasks, updateTask, toast, requestMoveRecurringTask]);

  const headerTitle = useMemo(() => {
    if (!isClient) return "Loading...";
    if (viewMode === 'week') {
      const weekStartForTitle = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
      const weekEndForTitle = endOfWeek(weekStartForTitle, { weekStartsOn: 1 });
      return `${format(weekStartForTitle, 'MMM d')} - ${format(weekEndForTitle, 'MMM d, yyyy')}`;
    } else {
      return format(currentDisplayDate, 'MMMM do, yyyy');
    }
  }, [currentDisplayDate, viewMode, isClient]);


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
        <div className="relative w-full">
            <Link href="/timetable" passHref legacyBehavior>
                <a className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), "hidden md:flex absolute top-1/2 -left-12 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center")} aria-label="Go to Timetable">
                    <ArrowLeftCircle className="h-6 w-6" />
                </a>
            </Link>
            <Link href="/goals" passHref legacyBehavior>
                <a className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), "hidden md:flex absolute top-1/2 -right-12 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center")} aria-label="Go to Goals">
                    <ArrowRightCircle className="h-6 w-6" />
                </a>
            </Link>

          <div className="p-1 md:p-2">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToPrevious} aria-label="Previous period" className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>

              <div className="flex-grow text-center flex items-center justify-center gap-2">
                  <h2 className="text-base md:text-lg font-semibold text-primary">
                    {headerTitle}
                  </h2>
                  <Input
                      value={weekName}
                      onChange={(e) => setWeekName(e.target.value)}
                      placeholder="Name of Week"
                      maxLength={12}
                      size={Math.max(weekName.length, 1)}
                      className="h-8 text-base font-semibold text-center bg-transparent border-0 border-b rounded-none focus-visible:ring-0 focus-visible:border-primary w-auto"
                    />
                  {isClient && theme && (
                    <Tabs
                      value={theme === 'system' ? 'light' : theme}
                      onValueChange={setTheme}
                      className="ml-2 w-[100px]"
                    >
                      <TabsList className="grid w-full grid-cols-2 h-8 p-0.5">
                        <TabsTrigger value="light" className="text-xs h-6 px-2">Light</TabsTrigger>
                        <TabsTrigger value="dark" className="text-xs h-6 px-2">Dark</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
              </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToNext} aria-label="Next period" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-1 w-full">
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayTasks = (isClient && tasksByDay && typeof tasksByDay === 'object' && Array.isArray(tasksByDay[dateStr])) ? tasksByDay[dateStr] : [];
                const isActualToday = today ? isSameDay(day, today) : false;


                return (
                  <Card key={dateStr} className={cn(
                      "flex flex-col h-[700px] md:h-[700px] overflow-hidden",
                      isActualToday ? 'border-accent border-2 shadow-md bg-card dark:bg-muted' :
                      viewMode === 'today' && !isActualToday ? 'bg-card border-border shadow-sm' :
                      'bg-secondary/30 border-transparent'
                      )}>
                    <CardHeader className="p-1 text-center shrink-0">
                      <CardTitle className="text-xs font-medium">
                        {format(day, 'EEE')}
                      </CardTitle>
                      <CardDescription className={cn(
                          "text-sm font-bold",
                          isActualToday ? 'text-accent' : 'text-foreground'
                          )}>
                        {format(day, 'd')}
                      </CardDescription>
                      
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
                                <div className="p-4 text-center text-xs text-muted-foreground">Loading tasks...</div>
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
                                         isPending={task.isPending}
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
                        isPending={activeTask.isPending}
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
