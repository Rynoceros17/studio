
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import type { Task, Goal, UpcomingItem, SingleTaskOutput } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader as SheetDialogHeader,
  SheetTitle as SheetDialogTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { TopTaskBar } from '@/components/TopTaskBar';
import { AuthButton } from '@/components/AuthButton';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, LogIn, SendHorizonal, Loader2, Save, ArrowLeftCircle, ArrowRightCircle, Info, CalendarClock } from 'lucide-react';
import { format, parseISO, startOfDay, addDays, subDays, isValid, isSameDay } from 'date-fns';
import { cn, calculateGoalProgress, calculateTimeLeft, parseISOStrict } from '@/lib/utils';
import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { colorTagToHexMap } from '@/lib/color-map';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { TodaysTasksDialog } from '@/components/TodaysTasksDialog';
import { LoadingScreen } from '@/components/LoadingScreen';
import { GoalOfWeekEditor } from '@/components/GoalOfWeekEditor';
import { LandingPage } from '@/components/LandingPage';
import { motion } from 'framer-motion';
import { HueSlider } from '@/components/HueSlider';
import { GoalsSheet } from '@/components/GoalsSheet';

interface MoveRecurringConfirmationState {
  task: Task;
  originalDateStr: string;
  newDateStr: string;
}


export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [weekNames, setWeekNames] = useState<Record<string, string>>({});
  const [goalsByWeek, setGoalsByWeek] = useState<Record<string, string>>({});
  
  const { user, authLoading } = useAuth();
  const isInitialLoad = useRef(true);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

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
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [moveRecurringConfirmation, setMoveRecurringConfirmation] = useState<MoveRecurringConfirmationState | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [isParsingTask, setIsParsingTask] = useState(false);
  const [pendingAiTasks, setPendingAiTasks] = useState<SingleTaskOutput[]>([]);
  const [isAiConfirmOpen, setIsAiConfirmOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isTodaysTasksDialogOpen, setIsTodaysTasksDialogOpen] = useState(false);
  const [currentDisplayDate, setCurrentDisplayDate] = useState(() => startOfDay(new Date()));


  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const initialX = window.innerWidth - 300 - 24;
        const initialY = 24;
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  // Show the "Today's Tasks" dialog only after the user's auth status and data is resolved.
  useEffect(() => {
    if (!authLoading && isDataLoaded) {
        setIsTodaysTasksDialogOpen(true);
    }
  }, [authLoading, isDataLoaded]);

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
  
  // Effect for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus AI input
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        chatInputRef.current?.focus();
      }

      // Ctrl+Y or Cmd+Y to open new task dialog
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        setIsFormOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array ensures this effect runs only once


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
                  if (!dateA || !dateB) return 0;
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
             if (!dateA || !dateB) return 0;
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

    let wasCompleted: boolean;
    setCompletedTaskIds(prevIds => {
        const currentCompletedKeys = new Set(prevIds);
        const completionKey = `${taskId}_${dateStr}`;
        wasCompleted = currentCompletedKeys.has(completionKey);

        if (wasCompleted) {
            currentCompletedKeys.delete(completionKey);
        } else {
            currentCompletedKeys.add(completionKey);
        }
        return Array.from(currentCompletedKeys);
    });

    setTimeout(() => {
        if (wasCompleted) {
            toast({
                title: "Task Incomplete",
                description: `"${task.name}" on ${format(parseISOStrict(dateStr)!, 'PPP')} marked as incomplete.`,
            });
        } else {
            toast({
                title: "Task Completed!",
                description: `"${task.name}" on ${format(parseISOStrict(dateStr)!, 'PPP')} marked as complete.`,
            });
        }
    }, 0);
  }, [tasks, toast]);


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
               if (!dateA || !dateB) return 0;
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

  const handleConfirmAiTasks = useCallback(() => {
    let tasksAddedCount = 0;
    pendingAiTasks.forEach(parsedTask => {
        const taskDate = parseISOStrict(parsedTask.date);
        if (!taskDate || !isValid(taskDate)) {
            console.warn("AI returned an invalid date for a task, skipping:", parsedTask);
            return;
        }

        const finalColor = parsedTask.color && colorTagToHexMap[parsedTask.color]
          ? colorTagToHexMap[parsedTask.color]
          : colorTagToHexMap['#col1'];

        addTask({
            name: parsedTask.name || "Unnamed Task",
            date: parsedTask.date,
            description: parsedTask.description || null,
            recurring: parsedTask.recurring ?? false,
            highPriority: parsedTask.highPriority ?? false,
            color: finalColor,
            startTime: parsedTask.startTime || null,
            endTime: parsedTask.endTime || null,
            details: '',
            dueDate: undefined,
            exceptions: []
        });
        tasksAddedCount++;
    });
    setPendingAiTasks([]); // Clear the pending tasks
    
    if (tasksAddedCount > 0) {
        toast({
            title: "Tasks Confirmed",
            description: `${tasksAddedCount} task(s) have been added to your calendar.`,
        });
    }
    setIsAiConfirmOpen(false);
  }, [pendingAiTasks, addTask, toast]);

  const handleCancelAiTasks = useCallback(() => {
    setPendingAiTasks([]);
    setIsAiConfirmOpen(false);
    toast({
        title: "AI Suggestions Canceled",
        description: "The suggested tasks have been discarded.",
    });
  }, [toast]);

  const handleSendChatMessage = async () => {
    if (chatInput.trim() && !isParsingTask) {
      setIsParsingTask(true);
      setPendingAiTasks([]); // Clear previous pending tasks
      try {
        const parsedTasksArray: SingleTaskOutput[] = await parseNaturalLanguageTask({ query: chatInput.trim() });

        if (parsedTasksArray && parsedTasksArray.length > 0) {
            setPendingAiTasks(parsedTasksArray);
            setIsAiConfirmOpen(true);
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
      startTime: originalRecurringTask.startTime,
      endTime: originalRecurringTask.endTime,
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
        if (!dateA || !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const dateComparison = dateA.getTime() - dateB.getTime();
        if (dateComparison !== 0) return dateComparison;
        if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
        return 0;
      });
      return finalTasks;
    });

    setCompletedTaskIds(prev => prev.filter(id => id !== `${originalRecurringTask.id}_${originalDateStr}`));

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

  const handleTouchStart = (e: React.TouchEvent) => {
    // Check for two-finger touch
    if (e.touches.length === 2) {
      setTouchStartX(e.touches[0].clientX);
    } else {
      setTouchStartX(null); // Reset if not a two-finger touch
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) {
      // Gesture didn't start with two fingers, so ignore.
      return;
    }

    // Use the first of the "changed" touches to determine the end position.
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const swipeThreshold = 50; // Minimum swipe distance in pixels

    if (deltaX > swipeThreshold) {
      // Swipe Right -> Go to Goals page
      router.push('/goals');
    } else if (deltaX < -swipeThreshold) {
      // Swipe Left -> Go to Timetable page
      router.push('/timetable');
    }

    // Reset touch start position regardless of whether a swipe was detected.
    // This completes the gesture.
    setTouchStartX(null);
  };

  const todaysTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = startOfDay(new Date());

    return tasks.filter(task => {
        if (!task || !task.date) return false;
        const taskDate = parseISOStrict(task.date);
        if (!taskDate) return false;

        let isForToday = false;
        if (task.recurring) {
            const taskStartDayOfWeek = taskDate.getDay();
            const todayDayOfWeek = today.getDay();
            if (taskStartDayOfWeek === todayDayOfWeek && today >= taskDate) {
                isForToday = true;
            }
        } else {
            if (isSameDay(taskDate, today)) {
                isForToday = true;
            }
        }

        if (!isForToday) return false;

        if (task.exceptions?.includes(todayStr)) {
            return false;
        }

        const completionKey = `${task.id}_${todayStr}`;
        if (completedTasks.has(completionKey)) {
            return false;
        }
        
        return true;
    });
  }, [tasks, completedTasks]);

  if (authLoading || !isDataLoaded) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <div
        className="flex min-h-screen flex-col items-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <header
          className={cn(
            "bg-background/95 backdrop-blur-sm border-b shadow-sm w-full sticky top-0 z-40",
            "flex flex-col"
          )}
        >
          <div className="relative flex justify-center items-center w-full px-4 h-12 md:h-14">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
               <HueSlider />
              <Button
                variant="ghost"
                className="h-9 w-9 md:h-10 md:w-10 text-primary hover:bg-primary/10"
                aria-label="Show welcome message"
                onClick={() => setIsWelcomeOpen(true)}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
              WeekWise.
            </h1>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <AuthButton />
            </div>
          </div>

          <nav className="flex justify-center items-center w-full py-2 space-x-1 md:space-x-2 border-t-[0.5px]">
              <Link
                href="/detailed-view"
                className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")}
                aria-label="Go to detailed view"
              >
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Detailed View</span>
              </Link>
              <Link
                 href="/study-tracker"
                 className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")}
                 aria-label="Go to study tracker"
              >
                  <BookOpen className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Study</span>
              </Link>
              <Link
                 href="/timetable"
                 className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")}
                 aria-label="Go to timetable importer"
              >
                  <CalendarClock className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Timetable</span>
              </Link>
              <Link
                href="/goals"
                className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")}
                aria-label="View goals"
              >
                  <Target className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Goals</span>
              </Link>
              <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                  <SheetTrigger asChild>
                      <Button variant="ghost" className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")} aria-label="View bookmarks">
                          <BookmarkIcon className="h-5 w-5" />
                          <span className="ml-2 hidden md:inline">Bookmarks</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                      <SheetDialogHeader className="p-4 border-b shrink-0">
                          <SheetDialogTitle className="text-primary">Bookmarks</SheetDialogTitle>
                      </SheetDialogHeader>
                      <BookmarkListSheet />
                  </SheetContent>
              </Sheet>
              <Button
                  variant="ghost"
                  className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")}
                  aria-label="Toggle Pomodoro Timer"
                  onClick={() => setIsTimerVisible(!isTimerVisible)}
              >
                  <TimerIcon className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Timer</span>
              </Button>
              <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                  <SheetTrigger asChild>
                      <Button variant="ghost" className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20")} aria-label="Open scratchpad">
                          <List className="h-5 w-5" />
                          <span className="ml-2 hidden md:inline">Scratchpad</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                      <SheetDialogHeader className="p-4 border-b shrink-0">
                          <SheetDialogTitle className="text-primary">Scratchpad</SheetDialogTitle>
                      </SheetDialogHeader>
                      <TaskListSheet />
                  </SheetContent>
              </Sheet>
          </nav>
        </header>

        <main
          className="flex-grow w-full flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 pt-4 md:pt-6"
        >
          <div className="grid grid-cols-10 gap-4 w-full max-w-[1800px] mx-auto">
            {/* Left Column: Goal of the Week */}
            <div className="col-span-10 lg:col-span-2 hidden lg:block">
              <GoalOfWeekEditor
                    currentDisplayDate={currentDisplayDate}
                    goalsByWeek={goalsByWeek}
                    setGoalsByWeek={setGoalsByWeek}
                />
            </div>
            
            {/* Center Column: Calendar */}
            <div className="col-span-10 lg:col-span-6">
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
                                placeholder="AI Task Entry: e.g., 'Important meeting #col1, Weekly review #col3' (Max 100 chars)"
                                className="h-10 text-sm flex-grow"
                                onKeyPress={handleChatKeyPress}
                                disabled={isParsingTask}
                                maxLength={100}
                            />
                        </CardContent>
                    </Card>
                </div>
                <CalendarView
                    tasks={tasks}
                    pendingAiTasks={pendingAiTasks}
                    requestDeleteTask={requestDeleteTask}
                    updateTaskOrder={updateTaskOrder}
                    toggleTaskCompletion={toggleTaskCompletion}
                    completedTasks={completedTasks}
                    updateTaskDetails={updateTaskDetails}
                    updateTask={updateTask}
                    completedCount={completedCount}
                    requestMoveRecurringTask={requestMoveRecurringTask}
                    currentDisplayDate={currentDisplayDate}
                    setCurrentDisplayDate={setCurrentDisplayDate}
                    weekNames={weekNames}
                    setWeekNames={setWeekNames}
                    goalsByWeek={goalsByWeek}
                    setGoalsByWeek={setGoalsByWeek}
                />
            </div>

            {/* Right Column: Bookmarks */}
            <div className="col-span-10 lg:col-span-2 hidden lg:block">
               <Card className="h-full">
                <div className="p-4 border-b shrink-0">
                    <h3 className="text-lg font-semibold leading-none tracking-tight text-primary">Bookmarks</h3>
                </div>
                <BookmarkListSheet />
               </Card>
            </div>
          </div>
          
           <div className="w-full max-w-[1800px] mx-auto mt-4">
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
                     <DialogTitle className="text-primary">Add New Task</DialogTitle>
                  </DialogHeader>
                  <TaskForm
                     addTask={addTask}
                     onTaskAdded={() => setIsFormOpen(false)}
                     initialData={null}
                  />
                </DialogContent>
              </Dialog>
          </div>

          {isClient && isTimerVisible && (
            <PomodoroTimer
              position={timerPosition}
              onClose={() => setIsTimerVisible(false)}
            />
          )}

          <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
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
                      <AlertDialogTitle>Move Recurring Task</AlertDialogTitle>
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

          <AlertDialog open={isAiConfirmOpen} onOpenChange={setIsAiConfirmOpen}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Confirm AI Tasks</AlertDialogTitle>
                      <AlertDialogDescription>
                          The AI suggests adding {pendingAiTasks.length} task(s) to your calendar. Do you want to proceed?
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel onClick={handleCancelAiTasks}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmAiTasks}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>

          <TodaysTasksDialog
              isOpen={isTodaysTasksDialogOpen && todaysTasks.length > 0}
              onClose={() => setIsTodaysTasksDialogOpen(false)}
              tasks={todaysTasks}
          />

          <Dialog open={isWelcomeOpen} onOpenChange={setIsWelcomeOpen}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Welcome to WeekWise</DialogTitle>
                      <DialogDescription>
                          This is your personal planner to organize your life, track your goals, and manage your time effectively. Use the AI to quickly add tasks, view your schedule in different formats, and stay on top of your deadlines.
                      </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                      <Button onClick={() => setIsWelcomeOpen(false)}>Get Started</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
        </main>
      </div>
    </DndContext>
  );
}
