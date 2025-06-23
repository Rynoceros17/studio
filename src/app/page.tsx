
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import type { Task, Goal, UpcomingItem } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as FormDialogTitle,
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
    AlertDialogTitle as AlertTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle as SheetDialogTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { TopTaskBar } from '@/components/TopTaskBar';
import { AuthButton } from '@/components/AuthButton';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, LogIn, SendHorizonal, Loader2, Save } from 'lucide-react';
import { format, parseISO, startOfDay, addDays, subDays, isValid } from 'date-fns';
import { cn, calculateGoalProgress, calculateTimeLeft, parseISOStrict } from '@/lib/utils';
import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';
import type { SingleTaskOutput } from '@/ai/flows/parse-natural-language-task-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { colorTagToHexMap } from '@/lib/color-map';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface MoveRecurringConfirmationState {
  task: Task;
  originalDateStr: string;
  newDateStr: string;
}


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const { user, authLoading } = useAuth();
  const isInitialLoad = useRef(true);

  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const completedCount = useMemo(() => {
      return completedTaskIds.length;
  }, [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false); // For manual task adding
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [moveRecurringConfirmation, setMoveRecurringConfirmation] = useState<MoveRecurringConfirmationState | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [isParsingTask, setIsParsingTask] = useState(false);


  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const initialX = window.innerWidth - 300 - 24;
        const initialY = 24;
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);
  
  // Effect to load data from Firestore on login, or clear it on logout
  useEffect(() => {
    isInitialLoad.current = true; // Prevents auto-save on data load
    const loadUserDataFromFirestore = async () => {
      if (user && db) {
        // User is logged in, try to load data from their main user document
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
              const userData = docSnap.data();
              // Load tasks and completed IDs from the user document
              const tasksData = userData.tasks || [];
              const completedIdsData = userData.completedTaskIds || [];
              setTasks(Array.isArray(tasksData) ? tasksData : []);
              setCompletedTaskIds(Array.isArray(completedIdsData) ? completedIdsData : []);
          } else {
              // Document doesn't exist for a new user, so local state remains empty
              setTasks([]);
              setCompletedTaskIds([]);
          }
        } catch (error) {
          console.error("Error loading user data from Firestore:", error);
          toast({ title: "Load Failed", description: "Could not load your data from the cloud.", variant: "destructive" });
        }
      } else if (!authLoading) {
        // No user is logged in (and auth check is complete), ensure local data is cleared
        setTasks([]);
        setCompletedTaskIds([]);
      }
    };

    loadUserDataFromFirestore();
  }, [user, authLoading, setTasks, setCompletedTaskIds, toast]);

  // Effect to automatically save data to Firestore when it changes
  useEffect(() => {
    // Skip the very first render/load to prevent unnecessary writes.
    if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
    }

    const autoSave = async () => {
        if (!user || !db) return; // Only save if user is logged in
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { 
                tasks: tasks, 
                completedTaskIds: completedTaskIds,
            }, { merge: true });
        } catch (error) {
            console.error("Error auto-saving user data to Firestore:", error);
            toast({ title: "Sync Failed", description: "Your latest changes could not be saved.", variant: "destructive" });
        }
    };

    autoSave();
  }, [tasks, completedTaskIds, user, db, toast]);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleTimerDragEnd = (event: DragEndEvent) => {
    if (event.active.id === 'pomodoro-timer') {
      setTimerPosition((prev) => ({
        x: prev.x + event.delta.x,
        y: prev.y + event.delta.y,
      }));
    }
  };


  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
     // Explicitly construct the task object to avoid undefined values.
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

             if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
             }

             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             if (originalAIndex === -1 && originalBIndex !== -1) return 1;
             if (originalAIndex !== -1 && originalBIndex === -1) return -1;
             if (originalAIndex === -1 && originalBIndex === -1) return 0;
             return originalAIndex - originalBIndex;

         });
         return updatedTasks;
     });

     // Conditional toast to avoid double toasting when called from moveRecurringConfirmation logic
     if (!isParsingTask && !(moveRecurringConfirmation && newTaskData.name === moveRecurringConfirmation.task.name)) {
        const taskDate = parseISOStrict(newTaskData.date);
        toast({
            title: "Task Added",
            description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
        });
     }
     setIsFormOpen(false);
  }, [setTasks, toast, isParsingTask, moveRecurringConfirmation]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => !completionKey.startsWith(`${id}_`)));
      if (taskToDelete) {
          toast({
              title: "Task Deleted",
              description: `"${taskToDelete.name}" and all its future occurrences have been removed.`,
              variant: "destructive",
          });
      }
       setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);


  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
      const taskToModify = tasks.find(task => task.id === taskId);
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              const updatedExceptions = [...(task.exceptions || []), dateStr];
              return { ...task, exceptions: updatedExceptions };
          }
          return task;
      }));
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);


  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr });
      } else {
          deleteAllOccurrences(task.id);
      }
  }, [deleteAllOccurrences]);


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

                  if (a.highPriority !== b.highPriority) {
                      return a.highPriority ? -1 : 1;
                  }
                  return 0;
              });
          }
          return updatedTasks;
      });
      // Avoid generic toast if called from moveRecurringConfirmation as it has its own toast
      if (!moveRecurringConfirmation) {
          toast({
            title: "Task Updated",
            description: "Task details have been updated.",
          });
      }
  }, [setTasks, toast, moveRecurringConfirmation]);


  const updateTaskOrder = useCallback((date: string, orderedTaskIds: string[]) => {
    setTasks(prevTasks => {
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date);
             if (!taskDateObj || !currentDay) return false;

             if (task.exceptions?.includes(date)) return false;

             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay();
                 const currentDayOfWeek = currentDay.getDay();
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });

        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true;
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true;

           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });

        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));

        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex;
                 }
             }

              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }

             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
              if (originalAIndex === -1 && originalBIndex === -1) return 0;
              if (originalAIndex === -1) return 1;
              if (originalBIndex === -1) return -1;
             return originalAIndex - originalBIndex;
        });
        return combinedTasks;
    });
  }, [setTasks]);


  const toggleTaskCompletion = useCallback((taskId: string, dateStr: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const completionKey = `${taskId}_${dateStr}`;
      const currentCompletedKeys = new Set(completedTaskIds);
      if (currentCompletedKeys.has(completionKey)) {
          currentCompletedKeys.delete(completionKey);
          toast({
              title: "Task Incomplete",
              description: `"${task.name}" on ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} marked as incomplete.`,
          });
      } else {
          currentCompletedKeys.add(completionKey);
          toast({
              title: "Task Completed!",
              description: `"${task.name}" on ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} marked as complete.`,
          });
      }
      setCompletedTaskIds(Array.from(currentCompletedKeys));
  }, [tasks, completedTaskIds, setCompletedTaskIds, toast]);


  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => {
   setTasks(prevTasks => {
      let needsResort = false;
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
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

               if (a.highPriority !== b.highPriority) {
                   return a.highPriority ? -1 : 1;
               }

               const dueDateA = parseISOStrict(a.dueDate);
               const dueDateB = parseISOStrict(b.dueDate);
               if (dueDateA && dueDateB) {
                   return dueDateA.getTime() - dueDateB.getTime();
               }
               if (dueDateA) return -1;
               if (dueDateB) return 1;
               return 0;
           });
       }
     return updatedTasks;
   });
   toast({
     title: "Task Details Updated",
     description: "Additional details have been updated.",
   });
  }, [setTasks, toast]);

  const toggleGoalPriority = useCallback((goalId: string) => {
    setGoals(prevGoals =>
      prevGoals.map(goal =>
        goal.id === goalId ? { ...goal, highPriority: !goal.highPriority } : goal
      )
    );
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
        toast({
            title: `Goal Priority ${!goal.highPriority ? 'Added' : 'Removed'}`,
            description: `"${goal.name}" is ${!goal.highPriority ? 'now' : 'no longer'} high priority.`,
        });
    }
  }, [goals, setGoals, toast]);


  const upcomingItemsForBar = useMemo((): UpcomingItem[] => {
    if (!isClient) return [];

    const today = startOfDay(new Date());

    const mappedTasks: UpcomingItem[] = tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const taskDueDate = parseISOStrict(task.dueDate);
        if (!taskDueDate) return false;
        const timeLeftDetails = calculateTimeLeft(task.dueDate);
        return timeLeftDetails && !timeLeftDetails.isPastDue;
      })
      .map(task => ({
        id: task.id,
        name: task.name,
        dueDate: task.dueDate!,
        type: 'task' as 'task',
        originalDate: task.date,
        description: task.description,
        taskHighPriority: task.highPriority,
        color: task.color,
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const goalDueDate = parseISOStrict(goal.dueDate);
        if (!goalDueDate) return false;
        const timeLeftDetails = calculateTimeLeft(goal.dueDate);
        if (!timeLeftDetails || timeLeftDetails.isPastDue) return false;
        if (calculateGoalProgress(goal) >= 100) return false;
        return true;
      })
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!,
        type: 'goal' as 'goal',
        goalHighPriority: goal.highPriority,
        progress: calculateGoalProgress(goal),
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    return combinedItems.sort((a, b) => {
      const aIsHighPriority = a.type === 'goal' ? a.goalHighPriority : a.taskHighPriority;
      const bIsHighPriority = b.type === 'goal' ? b.goalHighPriority : b.taskHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1;
      if (!aIsHighPriority && bIsHighPriority) return 1;

      const dueDateA = parseISOStrict(a.dueDate)!;
      const dueDateB = parseISOStrict(b.dueDate)!;
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient]);

  const handleSendChatMessage = async () => {
    if (chatInput.trim() && !isParsingTask) {
      setIsParsingTask(true);
      try {
        const parsedTasksArray: SingleTaskOutput[] = await parseNaturalLanguageTask({ query: chatInput.trim() });

        if (parsedTasksArray && parsedTasksArray.length > 0) {
            let tasksAddedCount = 0;
            parsedTasksArray.forEach(parsedTask => {
                let descriptionWithTime = parsedTask.description || "";
                if (parsedTask.parsedTime) {
                    descriptionWithTime = `${descriptionWithTime}${descriptionWithTime ? " " : ""}Time: ${parsedTask.parsedTime}.`.trim();
                }

                const taskDate = parseISOStrict(parsedTask.date);
                if (!taskDate || !isValid(taskDate)) {
                    console.warn("AI returned an invalid date for a task, skipping:", parsedTask);
                    return;
                }

                const finalColor = parsedTask.color && colorTagToHexMap[parsedTask.color]
                  ? colorTagToHexMap[parsedTask.color]
                  : undefined;


                addTask({
                    name: parsedTask.name || "Unnamed Task",
                    date: parsedTask.date,
                    description: descriptionWithTime,
                    recurring: parsedTask.recurring ?? false,
                    highPriority: parsedTask.highPriority ?? false,
                    color: finalColor,
                    details: '',
                    dueDate: undefined,
                    exceptions: []
                });
                tasksAddedCount++;
            });

            if (tasksAddedCount > 0) {
                toast({
                    title: tasksAddedCount === 1 ? "Task Added by AI" : `${tasksAddedCount} Tasks Added by AI`,
                    description: tasksAddedCount === 1
                        ? `Task "${parsedTasksArray.find(pt => pt.name)?.name || 'Unnamed Task'}" added to your calendar.`
                        : `${tasksAddedCount} tasks parsed and added to your calendar.`,
                });
            } else {
                 toast({
                    title: "AI Parsing Issue",
                    description: "The AI processed your request, but no valid tasks could be added. Please check your input or try rephrasing.",
                    variant: "destructive",
                });
            }
            setChatInput('');
        } else {
             toast({
                title: "No Tasks Detected",
                description: "The AI couldn't identify any tasks in your message. Try being more specific.",
                variant: "destructive",
            });
        }

      } catch (error: any) {
        console.error("Error parsing task with AI:", error);
        toast({
          title: "AI Processing Error",
          description: error.message || "Could not process your request. Please try again or add manually.",
          variant: "destructive",
        });
      } finally {
        setIsParsingTask(false);
      }
    }
  };

  const handleChatKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  };

  const requestMoveRecurringTask = (task: Task, originalDateStr: string, newDateStr: string) => {
    setMoveRecurringConfirmation({ task, originalDateStr, newDateStr });
  };

  const handleMoveRecurringInstanceOnly = () => {
    if (!moveRecurringConfirmation) return;
    const { task: originalRecurringTask, originalDateStr, newDateStr } = moveRecurringConfirmation;

    const newSingleInstanceTask: Task = {
      id: crypto.randomUUID(),
      name: originalRecurringTask.name,
      description: originalRecurringTask.description,
      date: newDateStr,
      recurring: false,
      highPriority: originalRecurringTask.highPriority,
      color: originalRecurringTask.color,
      details: originalRecurringTask.details,
      dueDate: originalRecurringTask.dueDate,
      exceptions: [],
    };

    setTasks(prevTasks => {
      const tasksWithNewInstance = [...prevTasks, newSingleInstanceTask];
      const finalTasks = tasksWithNewInstance.map(t => {
        if (t.id === originalRecurringTask.id) {
          return {
            ...t,
            exceptions: [...(t.exceptions || []), originalDateStr],
          };
        }
        return t;
      });

      finalTasks.sort((a, b) => {
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
      return finalTasks;
    });

    const completionKey = `${originalRecurringTask.id}_${originalDateStr}`;
    setCompletedTaskIds(prev => prev.filter(id => id !== completionKey));

    toast({
      title: "Recurring Instance Moved",
      description: `"${originalRecurringTask.name}" for ${format(parseISOStrict(originalDateStr)!, 'PPP')} moved to ${format(parseISOStrict(newDateStr)!, 'PPP')} as a single instance. Original series now has an exception.`,
    });
    setMoveRecurringConfirmation(null);
  };

  const handleMoveAllRecurringOccurrences = () => {
    if (!moveRecurringConfirmation) return;
    const { task, newDateStr } = moveRecurringConfirmation;

    updateTask(task.id, { date: newDateStr, exceptions: [] });

    setCompletedTaskIds(prev => prev.filter(id => !id.startsWith(`${task.id}_`)));

    toast({
      title: "Recurring Task Series Moved",
      description: `All occurrences of "${task.name}" will now start from ${format(parseISOStrict(newDateStr)!, 'PPP')}.`,
    });
    setMoveRecurringConfirmation(null);
  };


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <SyncStatusIndicator />
      <header
        className={cn(
          "bg-background border-b shadow-sm w-full",
          "flex flex-col"
        )}
      >
        <div className="relative flex justify-center items-center w-full px-4 h-12 md:h-14">
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
            WeekWise
          </h1>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <AuthButton />
          </div>
        </div>

        <nav className="flex justify-center items-center w-full py-2 space-x-1 md:space-x-2 border-t">
            <Link
              href="/timetable"
              className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10")}
              aria-label="Go to timetable"
            >
                <LayoutDashboard className="h-5 w-5" />
                <span className="ml-2 hidden md:inline">Timetable</span>
            </Link>
            <Link
               href="/study-tracker"
               className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10")}
               aria-label="Go to study tracker"
            >
                <BookOpen className="h-5 w-5" />
                <span className="ml-2 hidden md:inline">Study</span>
            </Link>
            <Link
              href="/goals"
              className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10")}
              aria-label="View goals"
            >
                <Target className="h-5 w-5" />
                <span className="ml-2 hidden md:inline">Goals</span>
            </Link>
            <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View bookmarks">
                        <BookmarkIcon className="h-5 w-5" />
                        <span className="ml-2 hidden md:inline">Bookmarks</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetDialogTitle className="text-primary">Bookmarks</SheetDialogTitle>
                    </SheetHeader>
                    <BookmarkListSheet />
                </SheetContent>
            </Sheet>
            <Button
                variant="ghost"
                className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10"
                aria-label="Toggle Pomodoro Timer"
                onClick={() => setIsTimerVisible(!isTimerVisible)}
            >
                <TimerIcon className="h-5 w-5" />
                <span className="ml-2 hidden md:inline">Timer</span>
            </Button>
            <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Open scratchpad">
                        <List className="h-5 w-5" />
                        <span className="ml-2 hidden md:inline">Scratchpad</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetDialogTitle className="text-primary">Scratchpad</SheetDialogTitle>
                    </SheetHeader>
                    <TaskListSheet />
                </SheetContent>
            </Sheet>
        </nav>
      </header>

      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 pt-4 md:pt-6">

        <div className="w-full max-w-7xl mb-4">
            <Card className="shadow-sm bg-transparent border-none">
                <CardContent className="p-3 flex items-center space-x-2">
                    <Button onClick={handleSendChatMessage} className="h-10 px-3 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isParsingTask || !chatInput.trim()}>
                        {isParsingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                        <span className="sr-only">Send Task Query</span>
                    </Button>
                    <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="AI Task Entry: e.g., 'Important meeting #col1, Weekly review #col3' (Max 100 chars)"
                        className="h-10 text-sm flex-grow"
                        onKeyPress={handleChatKeyPress}
                        disabled={isParsingTask}
                        maxLength={100}
                    />
                </CardContent>
            </Card>
        </div>

        <div className="w-full max-w-7xl space-y-4">
          {isClient && (
              <CalendarView
                tasks={tasks}
                requestDeleteTask={requestDeleteTask}
                updateTaskOrder={updateTaskOrder}
                toggleTaskCompletion={toggleTaskCompletion}
                completedTasks={completedTasks}
                updateTaskDetails={updateTaskDetails}
                updateTask={updateTask}
                completedCount={completedCount}
                requestMoveRecurringTask={requestMoveRecurringTask}
              />
          )}
        </div>

        <div className="w-full max-w-7xl mt-4">
           <TopTaskBar
             items={upcomingItemsForBar}
             toggleGoalPriority={toggleGoalPriority}
           />
         </div>


        <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 items-end">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-lg"
                  aria-label="Add new task manually"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                   <FormDialogTitle className="text-primary">Add New Task</FormDialogTitle>
                </DialogHeader>
                <TaskForm
                   addTask={addTask}
                   onTaskAdded={() => setIsFormOpen(false)}
                   initialData={null}
                />
              </DialogContent>
            </Dialog>
        </div>

        {!authLoading && !user && (
          <div className="fixed bottom-4 left-4 z-50">
            <Link href="/login">
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg"
                aria-label="Login"
              >
                <LogIn className="h-6 w-6" />
              </Button>
            </Link>
          </div>
        )}


        {isClient && isTimerVisible && (
          <PomodoroTimer
            position={timerPosition}
            onClose={() => setIsTimerVisible(false)}
          />
        )}

        <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertTitle>Delete Recurring Task</AlertTitle>
                    <AlertDialogDescription>
                        Do you want to delete only this occurrence of "{deleteConfirmation?.task?.name}" on {deleteConfirmation?.dateStr ? format(parseISOStrict(deleteConfirmation.dateStr) ?? new Date(), 'PPP') : ''}, or all future occurrences?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => deleteRecurringInstance(deleteConfirmation!.task.id, deleteConfirmation!.dateStr)}
                         className={cn("text-foreground")}
                    >
                        Delete This Occurrence Only
                    </AlertDialogAction>
                    <AlertDialogAction
                        onClick={() => deleteAllOccurrences(deleteConfirmation!.task.id)}
                        className={cn(buttonVariants({ variant: "destructive" }))}
                    >
                        Delete All Occurrences
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!moveRecurringConfirmation} onOpenChange={(open) => !open && setMoveRecurringConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertTitle>Move Recurring Task</AlertTitle>
                    <AlertDialogDescription>
                        You are moving the recurring task "{moveRecurringConfirmation?.task?.name}".
                        How would you like to move it from {moveRecurringConfirmation?.originalDateStr ? format(parseISOStrict(moveRecurringConfirmation.originalDateStr)!, 'PPP') : ''} to {moveRecurringConfirmation?.newDateStr ? format(parseISOStrict(moveRecurringConfirmation.newDateStr)!, 'PPP') : ''}?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setMoveRecurringConfirmation(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleMoveAllRecurringOccurrences}
                        className={cn("text-foreground")}
                    >
                        Move All Occurrences
                    </AlertDialogAction>
                    <AlertDialogAction
                        onClick={handleMoveRecurringInstanceOnly}
                         className={cn("text-foreground")}
                    >
                        Move This Instance Only
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </DndContext>
  );
}

    

    




