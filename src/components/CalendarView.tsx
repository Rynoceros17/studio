
"use client";

import type * as React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
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
import { ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, GripVertical, Pencil, Star, ArrowLeftCircle, ArrowRightCircle, Edit, PlusCircle, Loader2, SendHorizonal, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';

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
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Task, SingleTaskOutput } from '@/lib/types';
import { cn, truncateText, getMaxLength, parseISOStrict } from '@/lib/utils';
import { colorTagToHexMap } from '@/lib/color-map';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';
import { EditTaskDialog } from './EditTaskDialog';
import { TaskDetailsDisplayDialog } from './TaskDetailsDisplayDialog';
import { useToast } from "@/hooks/use-toast";
import { GoalOfWeekEditor } from './GoalOfWeekEditor';
import { TaskForm } from './TaskForm';

interface CalendarViewProps {
    currentDisplayDate: Date;
    setCurrentDisplayDate: (date: Date) => void;
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
  'hsl(var(--task-color-1))',
  'hsl(var(--task-color-2))',
  'hsl(var(--task-color-3))',
  'hsl(var(--task-color-4))',
  'hsl(var(--task-color-5))',
  'hsl(var(--task-color-6))',
  'hsl(var(--task-color-7))',
  'hsl(var(--task-color-8))',
  'hsl(var(--task-color-9))',
  'hsl(var(--task-color-10))',
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
    let cardBorderStyle = 'border-border';

    const cardCustomStyle: React.CSSProperties = {};
    
    if (isPending) {
        cardBgClass = 'bg-background/30 backdrop-blur-sm';
        cardBorderStyle = 'border-dashed border-primary/50';
    } else if (isCompleted) {
        cardBgClass = 'bg-muted opacity-60';
        cardBorderStyle = 'border-transparent';
    } else {
        cardBorderStyle = task.highPriority ? 'border-accent border-2' : 'border-border';

        if (task.color) {
            cardCustomStyle.backgroundColor = task.color;
            cardBgClass = ''; // Use style prop to override class
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
             <div className={cn("pt-0.5 cursor-grab shrink-0", "text-neutral-800")}>
                <GripVertical className="h-3 w-3" />
             </div>
            <div className="flex-grow min-w-0 pr-1 overflow-hidden">
              <p className={cn( "text-xs font-medium break-words whitespace-normal line-clamp-1", "text-neutral-800", isCompleted && 'line-through' )} title={task.name} >
                {nameDisplay}
              </p>
              {timeDisplay && (
                <p className={cn("text-[10px] font-mono", "text-neutral-800", isCompleted && 'line-through')}>{timeDisplay}</p>
              )}
              {descriptionDisplay && !timeDisplay && (
                <p className={cn("text-[10px] mt-0.5 break-words whitespace-normal line-clamp-2", "text-neutral-800", isCompleted && 'line-through')} title={task.description ?? ''}>
                  {descriptionDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center space-y-0.5 shrink-0">
               <div className={cn("h-5 w-5 flex items-center justify-center", isCompleted ? 'text-green-600' : "text-neutral-800" )}>
                  {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                </div>
               <div className={cn("h-5 w-5 flex items-center justify-center", "text-neutral-800" )}>
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
    const iconButtonClass = 'text-neutral-600 hover:text-neutral-800';
    let completeIconClass = 'text-neutral-600';
    let cardBorderStyle = 'border-border';

    const cardCustomStyle: React.CSSProperties = {};

    if (isPending) {
        cardBgClass = 'bg-background/30 backdrop-blur-sm';
        cardBorderStyle = 'border-dashed border-primary/50';
    } else if (isCompleted) {
        cardBgClass = 'bg-muted opacity-60';
        completeIconClass = 'text-green-600';
        cardBorderStyle = 'border-transparent';
    } else {
        cardBorderStyle = task.highPriority ? 'border-accent border-2' : 'border-border';

        if (task.color) {
            cardCustomStyle.backgroundColor = task.color;
            cardBgClass = ''; // Use style prop to override class
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
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                iconButtonClass,
                isPending && "hidden"
            )}
            onClick={(e) => handleMoveClick(e, 'prev')}
            aria-label="Move task to previous day"
            >
            <ArrowLeftCircle className="h-3 w-3" />
        </Button>

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
               <p className={cn( "text-xs font-medium break-words whitespace-normal line-clamp-1", "text-neutral-800", isCompleted && 'line-through' )} title={task.name} >
                 {nameDisplay}
               </p>
              {timeDisplay && (
                <p className={cn("text-[10px] font-mono", "text-neutral-800", isCompleted && 'line-through')}>{timeDisplay}</p>
              )}
              {descriptionDisplay && !timeDisplay && (
                <p className={cn("text-[10px] mt-0.5 break-words whitespace-normal line-clamp-2", "text-neutral-800", isCompleted && 'line-through')} title={task.description ?? ''}>
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
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                iconButtonClass,
                isPending && "hidden"
            )}
            onClick={(e) => handleMoveClick(e, 'next')}
            aria-label="Move task to next day"
            >
            <ArrowRightCircle className="h-3 w-3" />
        </Button>
    </div>
  );
}


export const CalendarView = forwardRef<
  { addTask: (task: Omit<Task, 'id'>) => void },
  CalendarViewProps
>(({ currentDisplayDate, setCurrentDisplayDate }, ref) => {
  const { user, authLoading } = useAuth();
  const { toast } = useToast();

  // State moved from page.tsx
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [weekNames, setWeekNames] = useState<Record<string, string>>({});
  const [goalsByWeek, setGoalsByWeek] = useState<Record<string, string>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const isInitialLoad = useRef(true);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isParsingTask, setIsParsingTask] = useState(false);
  const [pendingAiTasks, setPendingAiTasks] = useState<SingleTaskOutput[]>([]);
  const [isAiConfirmOpen, setIsAiConfirmOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [moveRecurringConfirmation, setMoveRecurringConfirmation] = useState<{ task: Task; originalDateStr: string; newDateStr: string; } | null>(null);

  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  // Effect to sync data with Firestore OR load from localStorage
  useEffect(() => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }
    setIsDataLoaded(false);
    isInitialLoad.current = true;

    if (user && db) {
      setTasks([]);
      setCompletedTaskIds([]);
      setWeekNames({});
      setGoalsByWeek({});
      
      const userDocRef = doc(db, 'users', user.uid);
      firestoreUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setTasks(Array.isArray(userData.tasks) ? userData.tasks : []);
          setCompletedTaskIds(Array.isArray(userData.completedTaskIds) ? userData.completedTaskIds : []);
          setWeekNames(userData.weekNames && typeof userData.weekNames === 'object' ? userData.weekNames : {});
          setGoalsByWeek(userData.goalsByWeek && typeof userData.goalsByWeek === 'object' ? userData.goalsByWeek : {});
        } else {
          setTasks([]);
          setCompletedTaskIds([]);
          setWeekNames({});
          setGoalsByWeek({});
        }
        isInitialLoad.current = false;
        setIsDataLoaded(true);
      }, (error) => {
        console.error("Error with Firestore listener:", error);
        toast({ title: "Sync Error", description: "Could not sync data in real-time.", variant: "destructive" });
        setIsDataLoaded(true);
      });
    } else if (!authLoading && !user) {
      try {
        setTasks(JSON.parse(localStorage.getItem('weekwise-tasks') || '[]'));
        setCompletedTaskIds(JSON.parse(localStorage.getItem('weekwise-completed-tasks') || '[]'));
        setWeekNames(JSON.parse(localStorage.getItem('weekwise-week-names') || '{}'));
        setGoalsByWeek(JSON.parse(localStorage.getItem('weekwise-goals-by-week') || '{}'));
      } catch (error) {
        console.warn("Could not parse local storage data.", error);
        setTasks([]);
        setCompletedTaskIds([]);
        setWeekNames({});
        setGoalsByWeek({});
      }
      isInitialLoad.current = false;
      setIsDataLoaded(true);
    }

    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
      }
    };
  }, [user, authLoading, toast]);


  // Effect to automatically save data
  useEffect(() => {
    if (isInitialLoad.current || authLoading) {
      return;
    }

    const autoSave = async () => {
      const dataToSave = {
        tasks: tasks,
        completedTaskIds: completedTaskIds,
        weekNames: weekNames,
        goalsByWeek: goalsByWeek,
      };

      if (user && db) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, dataToSave, { merge: true });
        } catch (error) {
          console.error("Error auto-saving user data to Firestore:", error);
          toast({ title: "Sync Failed", description: "Your latest changes could not be saved.", variant: "destructive" });
        }
      } else {
         localStorage.setItem('weekwise-tasks', JSON.stringify(dataToSave.tasks));
         localStorage.setItem('weekwise-completed-tasks', JSON.stringify(dataToSave.completedTaskIds));
         localStorage.setItem('weekwise-week-names', JSON.stringify(dataToSave.weekNames));
         localStorage.setItem('weekwise-goals-by-week', JSON.stringify(dataToSave.goalsByWeek));
      }
    };

    const handler = setTimeout(autoSave, 1000);
    return () => clearTimeout(handler);
  }, [tasks, completedTaskIds, weekNames, goalsByWeek, user, authLoading, toast]);

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
     const newTask: Task = {
         id: crypto.randomUUID(),
         name: newTaskData.name,
         date: newTaskData.date,
         description: newTaskData.description || null,
         recurring: newTaskData.recurring ?? false,
         highPriority: newTaskData.highPriority ?? false,
         color: newTaskData.color || null,
         exceptions: newTaskData.exceptions || [],
         details: newTaskData.details || null,
         dueDate: newTaskData.dueDate || null,
         startTime: newTaskData.startTime || null,
         endTime: newTaskData.endTime || null,
     };

     setTasks((prevTasks) => {
         const updatedTasks = [...prevTasks, newTask];
         updatedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;
             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;
             if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
             return 0;
         });
         return updatedTasks;
     });

     if (!isParsingTask && !(moveRecurringConfirmation && newTaskData.name === moveRecurringConfirmation.task.name)) {
        const taskDate = parseISOStrict(newTaskData.date);
        toast({
            title: "Task Added",
            description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
        });
     }
     setIsFormOpen(false);
  }, [setTasks, toast, isParsingTask, moveRecurringConfirmation]);

  useImperativeHandle(ref, () => ({
    addTask,
  }));

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
      setTasks(prevTasks => {
          let needsResort = false;
          const updatedTasks = prevTasks.map(task => {
              if (task.id === id) {
                  const updatedTask = { ...task, ...updates };
                  if ((updates.date && updates.date !== task.date) ||
                      (updates.highPriority !== undefined && updates.highPriority !== task.highPriority) ||
                      (updates.color !== undefined && updates.color !== task.color)
                    ) {
                      needsResort = true;
                  }
                  return updatedTask;
              }
              return task;
          });

          if (needsResort) {
              updatedTasks.sort((a, b) => {
                  const dateA = parseISOStrict(a.date);
                  const dateB = parseISOStrict(b.date);
                  if (!dateA && !dateB) return 0;
                  if (!dateA) return 1;
                  if (!dateB) return -1;
                  const dateComparison = dateA.getTime() - dateB.getTime();
                  if (dateComparison !== 0) return dateComparison;
                  if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
                  return 0;
              });
          }
          return updatedTasks;
      });
      if (!moveRecurringConfirmation) {
          toast({
            title: "Task Updated",
            description: "Task details have been updated.",
          });
      }
  }, [setTasks, toast, moveRecurringConfirmation]);

  const requestMoveRecurringTask = (task: Task, originalDateStr: string, newDateStr: string) => {
    setMoveRecurringConfirmation({ task, originalDateStr, newDateStr });
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

  const [viewMode, setViewMode] = useState<'week' | 'today'>('week');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  const currentWeekKey = useMemo(() => {
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    return format(weekStart, 'yyyy-MM-dd');
  }, [currentDisplayDate]);

  const weekName = weekNames[currentWeekKey] || '';

  const handleWeekNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setWeekNames(prev => ({ ...prev, [currentWeekKey]: newName }));
  };

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
  }, [isClient, setCurrentDisplayDate]);


   const days = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    return [currentDisplayDate];
  }, [currentDisplayDate, viewMode]);


   const tasksByDay = useMemo(() => {
       const groupedTasks: { [key: string]: (Task & { isPending?: boolean })[] } = {};
       days.forEach(day => {
           const dateStr = format(day, 'yyyy-MM-dd');
           const regularTasks = tasks.filter(task => {
                const taskDate = parseISOStrict(task.date);
                if (!taskDate) return false;
                if (task.exceptions?.includes(dateStr)) return false;
                if (task.recurring) {
                    return taskDate.getDay() === day.getDay() && day >= taskDate;
                }
                return isSameDay(taskDate, day);
           });
           
           const pendingTasksForDay = pendingAiTasks.filter(task => task.date === dateStr).map((pt, i) => ({ ...pt, id: `pending_${dateStr}_${i}`, isPending: true, details: null, dueDate: undefined, exceptions: [] }));
           groupedTasks[dateStr] = [...regularTasks, ...pendingTasksForDay].sort((a, b) => {
              const aCompleted = completedTasks.has(`${a.id}_${dateStr}`);
              const bCompleted = completedTasks.has(`${b.id}_${dateStr}`);
              if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
              if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
              return 0; // Keep original DND order if other things are equal
           });
       });
       return groupedTasks;
     }, [tasks, pendingAiTasks, days, completedTasks]);


    const activeTask = useMemo(() => {
        if (!activeId) return null;
        const taskId = activeId.split('_')[0];
        if (taskId.startsWith('pending')) {
            const dateStr = activeId.split('_')[1];
            return tasksByDay[dateStr]?.find(t => t.id === activeId);
        }
        return tasks.find(task => task.id === taskId);
    }, [activeId, tasks, tasksByDay]);

   const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
   const modifiers = useMemo(() => [restrictToFirstScrollableAncestor, restrictToVerticalAxis], []);

  const handleDragStart = (event: DragEndEvent) => setActiveId(event.active.id as string);
  const handleDragCancel = () => setActiveId(null);
  
  const handleDragEnd = (event: DragEndEvent) => {
     const { active, over } = event;
     setActiveId(null);
     if (!over || active.id === over.id) return;
  
     const activeIdStr = active.id as string;
     const overIdStr = over.id as string;
  
     const [activeTaskId, activeDateStr] = activeIdStr.split('_');
     const overDateStr = overIdStr.includes('_') ? overIdStr.split('_')[1] : overIdStr;
     const isOverContainer = !overIdStr.includes('_');
  
     const taskToMove = tasks.find(task => task.id === activeTaskId);
     if (!taskToMove) return;
  
     if (activeDateStr === overDateStr) { // Reordering
         const taskIdsForDate = tasksByDay[overDateStr].map(task => task.id);
         const oldIndex = taskIdsForDate.findIndex(id => id === activeTaskId);
         const newIndex = isOverContainer ? taskIdsForDate.length : taskIdsForDate.findIndex(id => id === overIdStr.split('_')[0]);
  
         if (oldIndex !== -1 && newIndex !== -1) {
             const reorderedTaskIds = arrayMove(taskIdsForDate, oldIndex, newIndex);
             updateTaskOrder(overDateStr, reorderedTaskIds);
         }
     } else { // Moving day
         if (taskToMove.recurring) {
             requestMoveRecurringTask(taskToMove, activeDateStr, overDateStr);
         } else {
             updateTask(activeTaskId, { ...taskToMove, date: overDateStr });
             toast({ title: "Task Moved", description: `"${taskToMove.name}" moved to ${format(parseISOStrict(overDateStr)!, 'PPP')}.` });
         }
     }
  };

  const updateTaskOrder = useCallback((date: string, orderedTaskIds: string[]) => {
    setTasks(prevTasks => {
        const tasksForDate = prevTasks.filter(task => {
            const taskDate = parseISOStrict(task.date);
            if (!taskDate) return false;
            if (task.recurring) return taskDate.getDay() === parseISOStrict(date)!.getDay() && parseISOStrict(date)! >= taskDate;
            return isSameDay(taskDate, parseISOStrict(date)!);
        });
        const otherTasks = prevTasks.filter(task => !tasksForDate.find(t => t.id === task.id));
        const reorderedTasks = orderedTaskIds.map(id => tasksForDate.find(t => t.id === id)).filter(Boolean) as Task[];
        const finalTasks = [...otherTasks, ...reorderedTasks];
        finalTasks.sort((a, b) => (parseISOStrict(a.date)!.getTime() - parseISOStrict(b.date)!.getTime()));
        return finalTasks;
    });
  }, [setTasks]);

  const toggleTaskCompletion = useCallback((taskId: string, dateStr: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setCompletedTaskIds(prevIds => {
        const currentCompletedKeys = new Set(prevIds);
        const completionKey = `${taskId}_${dateStr}`;
        const wasCompleted = currentCompletedKeys.has(completionKey);
        wasCompleted ? currentCompletedKeys.delete(completionKey) : currentCompletedKeys.add(completionKey);
        return Array.from(currentCompletedKeys);
    });

    setTimeout(() => toast({ title: `Task ${completedTasks.has(`${taskId}_${dateStr}`) ? 'Incomplete' : 'Completed!'}`, description: `"${task.name}" on ${format(parseISOStrict(dateStr)!, 'PPP')}` }), 0);
  }, [tasks, toast, completedTasks, setCompletedTaskIds]);

  const deleteAllOccurrences = useCallback((id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    setTasks(prev => prev.filter(task => task.id !== id));
    setCompletedTaskIds(prev => prev.filter(key => !key.startsWith(`${id}_`)));
    if (taskToDelete) toast({ title: "Task Deleted", description: `"${taskToDelete.name}" and all future occurrences removed.`, variant: "destructive" });
    setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);

  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
    const task = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, exceptions: [...(t.exceptions || []), dateStr] } : t));
    setCompletedTaskIds(prev => prev.filter(key => key !== `${taskId}_${dateStr}`));
    if (task) toast({ title: "Task Instance Skipped", description: `"${task.name}" for ${format(parseISOStrict(dateStr)!, 'PPP')} will be skipped.` });
    setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);

  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      task.recurring ? setDeleteConfirmation({ task, dateStr }) : deleteAllOccurrences(task.id);
  }, [deleteAllOccurrences]);

  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => {
     setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
     toast({ title: "Task Details Updated" });
  }, [setTasks, toast]);

  const handleConfirmAiTasks = useCallback(() => {
    pendingAiTasks.forEach(pt => addTask({
        name: pt.name || "Unnamed Task",
        date: pt.date,
        description: pt.description || null,
        startTime: pt.startTime || null,
        endTime: pt.endTime || null,
        recurring: pt.recurring,
        highPriority: pt.highPriority,
        color: pt.color && colorTagToHexMap[pt.color as keyof typeof colorTagToHexMap] || colorTagToHexMap['#col1'],
        details: null,
        dueDate: null,
        exceptions: [],
    }));
    setPendingAiTasks([]);
    if (pendingAiTasks.length > 0) toast({ title: "Tasks Confirmed", description: `${pendingAiTasks.length} task(s) added.` });
    setIsAiConfirmOpen(false);
  }, [pendingAiTasks, addTask, toast]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isParsingTask) return;
    setIsParsingTask(true);
    setPendingAiTasks([]);
    try {
        const parsed = await parseNaturalLanguageTask({ query: chatInput.trim() });
        if (parsed.length > 0) {
            setPendingAiTasks(parsed);
            setIsAiConfirmOpen(true);
            setChatInput('');
        } else {
            toast({ title: "No Tasks Detected", description: "Try being more specific.", variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "AI Error", description: e.message || "Could not process request.", variant: "destructive" });
    } finally {
        setIsParsingTask(false);
    }
  };

  const handleMoveRecurringInstanceOnly = () => {
    if (!moveRecurringConfirmation) return;
    const { task, originalDateStr, newDateStr } = moveRecurringConfirmation;
    addTask({ ...task, date: newDateStr, recurring: false, exceptions: [] });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, exceptions: [...(t.exceptions || []), originalDateStr] } : t));
    toast({ title: "Recurring Instance Moved", description: `A single instance of "${task.name}" was moved to ${format(parseISOStrict(newDateStr)!, 'PPP')}.` });
    setMoveRecurringConfirmation(null);
  };
  
  const handleMoveAllRecurringOccurrences = () => {
    if (!moveRecurringConfirmation) return;
    const { task, newDateStr } = moveRecurringConfirmation;
    updateTask(task.id, { date: newDateStr, exceptions: [] });
    setCompletedTaskIds(prev => prev.filter(id => !id.startsWith(`${task.id}_`)));
    toast({ title: "Recurring Task Series Moved", description: `All occurrences of "${task.name}" will now start from ${format(parseISOStrict(newDateStr)!, 'PPP')}.` });
    setMoveRecurringConfirmation(null);
  };

  const handleTaskClick = (task: Task) => setSelectedTaskForDetails(task);
  const handleEditClick = (task: Task) => { setIsEditDialogOpen(true); setEditingTask(task); };
  const handleCloseTaskDetails = () => setSelectedTaskForDetails(null);
  const handleCloseEditDialog = () => { setIsEditDialogOpen(false); setEditingTask(null); };

  const headerTitle = useMemo(() => {
    if (!isClient) return "Loading...";
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    if (viewMode === 'week') return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    return format(currentDisplayDate, 'MMMM do, yyyy');
  }, [currentDisplayDate, viewMode, isClient]);

  if (!isClient) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} modifiers={modifiers} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
       <div className="w-full mb-4">
            <Card className="shadow-sm bg-transparent border-none">
                <CardContent className="p-3 flex items-center space-x-2">
                    <Button onClick={handleSendChatMessage} className="h-10 px-3 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isParsingTask || !chatInput.trim()}>
                        {isParsingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                        <span className="sr-only">Send Task Query</span>
                    </Button>
                    <Input
                        ref={chatInputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Add tasks with just english! e.g. Urgent meeting tomorrow or Assignment due on next Thursday"
                        className="h-10 text-sm flex-grow"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        disabled={isParsingTask}
                        maxLength={100}
                    />
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Add new task manually">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader><DialogTitle className="text-primary">Add New Task</DialogTitle></DialogHeader>
                          <TaskForm addTask={addTask} onTaskAdded={() => setIsFormOpen(false)} initialData={null} />
                        </DialogContent>
                      </Dialog>
                </CardContent>
            </Card>
        </div>
        <div className="relative w-full">
          <div className="p-1 md:p-2">
            <div className="flex items-center justify-between mb-1">
                <Button variant="outline" size="icon" onClick={() => setCurrentDisplayDate(subDays(currentDisplayDate, viewMode === 'week' ? 7 : 1))} aria-label="Previous period" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex-grow text-center flex items-center justify-center gap-2">
                  <h2 className="text-base md:text-lg font-semibold text-primary">{headerTitle}</h2>
                  <Input value={weekName} onChange={handleWeekNameChange} placeholder="Name of Week" maxLength={12} className="h-8 text-base font-semibold text-center bg-transparent border-0 border-b rounded-none focus-visible:ring-0 focus-visible:border-primary w-auto max-w-[150px]" />
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentDisplayDate(addDays(currentDisplayDate, viewMode === 'week' ? 7 : 1))} aria-label="Next period" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-1 w-full">
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDay[dateStr] || [];
                const isActualToday = today ? isSameDay(day, today) : false;
                return (
                  <Card key={dateStr} className={cn("flex flex-col h-[700px] overflow-hidden", isActualToday ? 'border-accent dark:border-white border-2 shadow-md bg-card dark:bg-muted' : 'bg-secondary/30 border-transparent')}>
                    <CardHeader className="p-1 text-center shrink-0">
                      <CardTitle className="text-xs font-medium">{format(day, 'EEE')}</CardTitle>
                      <CardDescription className={cn("text-sm font-bold", isActualToday ? 'text-accent' : 'text-foreground')}>{format(day, 'd')}</CardDescription>
                    </CardHeader>
                    <Separator className="shrink-0 my-0.5"/>
                    <ScrollArea className="flex-grow"><CardContent className="p-1 space-y-1 h-full" data-testid={`day-content-${dateStr}`}>
                      <SortableContext id={dateStr} items={dayTasks.map(t => `${t.id}_${dateStr}`)} strategy={verticalListSortingStrategy}>
                        {dayTasks.length === 0 ? <p className="text-[10px] text-muted-foreground text-center pt-4">No tasks</p> : dayTasks.map(task => (
                          <SortableTask key={`${task.id}_${dateStr}`} task={task} dateStr={dateStr} isCompleted={completedTasks.has(`${task.id}_${dateStr}`)} isPending={task.isPending} toggleTaskCompletion={toggleTaskCompletion} requestDeleteTask={requestDeleteTask} onTaskClick={handleTaskClick} onEditClick={handleEditClick} onMoveTask={handleMoveTask} />
                        ))}
                      </SortableContext>
                    </CardContent></ScrollArea>
                  </Card>
                );
              })}
            </div>
          </div>
      </div>
        <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTask && activeId.includes('_') ? (() => {
                const activeDateStr = activeId.split('_')[1];
                return <TaskItem task={activeTask} dateStr={activeDateStr} isCompleted={completedTasks.has(activeId)} isPending={activeTask.isPending} isDragging toggleTaskCompletion={()=>{}} requestDeleteTask={()=>{}} onTaskClick={()=>{}} onEditClick={()=>{}} onMoveTask={()=>{}} />;
            })() : null}
        </DragOverlay>
        <TaskDetailsDisplayDialog task={selectedTaskForDetails} onClose={handleCloseTaskDetails} updateTaskDetails={updateTaskDetails} />
        <EditTaskDialog task={editingTask} isOpen={isEditDialogOpen} onClose={handleCloseEditDialog} updateTask={updateTask} />
        <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Recurring Task</AlertDialogTitle><AlertDialogDescription>Delete only this occurrence of "{deleteConfirmation?.task?.name}" or all future occurrences?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmation(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteRecurringInstance(deleteConfirmation!.task.id, deleteConfirmation!.dateStr)} className={cn("text-foreground")}>This Occurrence Only</AlertDialogAction>
                  <AlertDialogAction onClick={() => deleteAllOccurrences(deleteConfirmation!.task.id)} className={cn(buttonVariants({ variant: "destructive" }))}>All Occurrences</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!moveRecurringConfirmation} onOpenChange={(open) => !open && setMoveRecurringConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Move Recurring Task</AlertDialogTitle><AlertDialogDescription>How would you like to move "{moveRecurringConfirmation?.task?.name}"?</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setMoveRecurringConfirmation(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleMoveAllRecurringOccurrences} className={cn("text-foreground")}>Move All Occurrences</AlertDialogAction>
                    <AlertDialogAction onClick={handleMoveRecurringInstanceOnly} className={cn("text-foreground")}>Move This Instance Only</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isAiConfirmOpen} onOpenChange={setIsAiConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Confirm AI Tasks</AlertDialogTitle><AlertDialogDescription>Add {pendingAiTasks.length} task(s) to your calendar?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setPendingAiTasks([]); setIsAiConfirmOpen(false); }}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmAiTasks}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </DndContext>
  );
});

CalendarView.displayName = 'CalendarView';
