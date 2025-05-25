
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect } from 'react';
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
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { TopTaskBar } from '@/components/TopTaskBar';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn, calculateGoalProgress, parseISOStrict, calculateTimeLeft } from '@/lib/utils';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const completedCount = useMemo(() => {
      return completedTaskIds.length;
  }, [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);


  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const initialX = window.innerWidth - 300 - 24; // 300 is timer width, 24 is padding
        const initialY = 24; // Padding from top
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // User must drag 10px before initiating drag
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
     const newTask: Task = {
         ...newTaskData,
         id: crypto.randomUUID(),
         recurring: newTaskData.recurring ?? false,
         highPriority: newTaskData.highPriority ?? false,
         exceptions: [],
         details: newTaskData.details || '',
         dueDate: newTaskData.dueDate || undefined,
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
             // Maintain original order for tasks on the same day with same priority
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             if (originalAIndex === -1 && originalBIndex === -1) return 0;
             if (originalAIndex === -1) return 1; // New tasks go to the end
             if (originalBIndex === -1) return -1; // New tasks go to the end
             return originalAIndex - originalBIndex;
         });
         return updatedTasks;
     });
     const taskDate = parseISOStrict(newTaskData.date);
     toast({
         title: "Task Added",
         description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
     });
     setIsFormOpen(false);
  }, [setTasks, toast, parseISOStrict]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      // Also clear any completions related to this recurring task's ID prefix
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
      // Remove completion for just this instance
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast, parseISOStrict]);


  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr });
      } else {
          deleteAllOccurrences(task.id);
      }
  }, [deleteAllOccurrences]);


  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>>) => {
      setTasks(prevTasks => {
          let needsResort = false;
          const updatedTasks = prevTasks.map(task => {
              if (task.id === id) {
                  const updatedTask = { ...task, ...updates };
                  if ((updates.date && updates.date !== task.date) || (updates.highPriority !== undefined && updates.highPriority !== task.highPriority)) {
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
                  // Fallback to maintain existing order if dates and priority are the same
                  // Find original indices if needed, though typically this level of sort stability isn't critical for this app
                  return 0;
              });
          }
          return updatedTasks;
      });
      toast({
          title: "Task Updated",
          description: "Core task details have been updated.",
      });
  }, [setTasks, toast, parseISOStrict]);


  const updateTaskOrder = useCallback((date: string, orderedTaskIds: string[]) => {
    setTasks(prevTasks => {
        // Separate tasks for the given date from other tasks
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date); // The date for which tasks are being reordered
             if (!taskDateObj || !currentDay) return false;

             // Exclude if it's an exception for this specific date
             if (task.exceptions?.includes(date)) return false;

             // For recurring tasks, check if it falls on this day of the week and is on or after its start date
             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay(); // Day of week (0-6)
                 const currentDayOfWeek = currentDay.getDay();
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  // For non-recurring tasks, check if it's the exact date
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });

        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true; // Keep tasks without valid dates (should ideally not happen)
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true; // Keep exceptions if they are not for this date

           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });

        // Create a map for quick lookup of tasks for the target date
        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
        // Reorder the tasksForDate based on orderedTaskIds
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        // Combine other tasks with the reordered tasks for the date
        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

        // Sort the entire list again to ensure overall order (date, then priority, then manual order for the specific day)
         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If on the same date, check if these are the tasks we just reordered
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex; // Use the new manual order
                 }
             }
             // Fallback for tasks not on the target date or if something went wrong with indexing
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }
             // Further fallback to original position in prevTasks if not otherwise sortable
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
              if (originalAIndex === -1 && originalBIndex === -1) return 0;
              if (originalAIndex === -1) return 1;
              if (originalBIndex === -1) return -1;
             return originalAIndex - originalBIndex;
        });
        return combinedTasks;
    });
  }, [setTasks, parseISOStrict]);


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
  }, [tasks, completedTaskIds, setCompletedTaskIds, toast, parseISOStrict]);


  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => {
   setTasks(prevTasks => {
      let needsResort = false; // Flag to check if sorting is needed after update
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            // Check if dueDate change might affect overall sorting
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
                needsResort = true;
            }
         return updatedTask;
       }
       return task;
     });

      if (needsResort) { // Re-sort if a due date changed that affects the primary sort order
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

               // Consider dueDate for tie-breaking if primary dates are the same
               const dueDateA = parseISOStrict(a.dueDate);
               const dueDateB = parseISOStrict(b.dueDate);
               if (dueDateA && dueDateB) {
                   return dueDateA.getTime() - dueDateB.getTime();
               }
               if (dueDateA) return -1; // Tasks with due dates come before those without
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
  }, [setTasks, toast, parseISOStrict]);

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

    const mappedTasks: UpcomingItem[] = tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const timeLeftDetails = calculateTimeLeft(task.dueDate);
        return timeLeftDetails && !timeLeftDetails.isPastDue;
      })
      .map(task => ({
        id: task.id,
        name: task.name,
        dueDate: task.dueDate!, // Assert non-null as we filtered
        type: 'task' as 'task',
        originalDate: task.date,
        description: task.description,
        taskHighPriority: task.highPriority,
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const timeLeftDetails = calculateTimeLeft(goal.dueDate);
        if (!timeLeftDetails || timeLeftDetails.isPastDue) return false;
        if (calculateGoalProgress(goal) >= 100) return false; // Exclude completed goals
        return true;
      })
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!, // Assert non-null
        type: 'goal' as 'goal',
        progress: calculateGoalProgress(goal),
        goalHighPriority: goal.highPriority,
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    // Sort: High priority first, then by due date (earliest first)
    return combinedItems.sort((a, b) => {
      // Determine if item a is high priority
      const aIsHighPriority = a.type === 'goal' ? a.goalHighPriority : a.taskHighPriority;
      // Determine if item b is high priority
      const bIsHighPriority = b.type === 'goal' ? b.goalHighPriority : b.taskHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1; // a comes first
      if (!aIsHighPriority && bIsHighPriority) return 1;  // b comes first

      // If priorities are the same (or both not high), sort by due date
      const dueDateA = parseISOStrict(a.dueDate)!; // Assert non-null as filtered
      const dueDateB = parseISOStrict(b.dueDate)!; // Assert non-null as filtered
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient, calculateGoalProgress, calculateTimeLeft, parseISOStrict]);


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <header className={cn(
        "bg-background border-b shadow-sm w-full",
        "flex h-16 items-center px-4" // Always a single row
      )}>
        {/* Left Icons Group */}
        <nav className="flex space-x-1">
            <Link href="/timetable" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Go to timetable">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="hidden md:inline ml-2">Timetable</span>
                </Button>
            </Link>
            <Link href="/study-tracker" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Go to study tracker">
                    <BookOpen className="h-5 w-5" />
                    <span className="hidden md:inline ml-2">Study</span>
                </Button>
            </Link>
            <Link href="/goals" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View goals">
                    <Target className="h-5 w-5" />
                    <span className="hidden md:inline ml-2">Goals</span>
                </Button>
            </Link>
        </nav>

        {/* Title - Centered */}
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight flex-1 text-center">WeekWise</h1>

        {/* Right Icons Group */}
        <nav className="flex space-x-1">
            <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View bookmarks">
                        <BookmarkIcon className="h-5 w-5" />
                        <span className="hidden md:inline ml-2">Bookmarks</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle className="text-primary">Bookmarks</SheetTitle>
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
                <span className="hidden md:inline ml-2">Timer</span>
            </Button>
            <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View scratchpad">
                        <List className="h-5 w-5" />
                        <span className="hidden md:inline ml-2">Scratchpad</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle className="text-primary">Scratchpad</SheetTitle>
                    </SheetHeader>
                    <TaskListSheet />
                </SheetContent>
            </Sheet>
        </nav>
      </header>

      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden pt-16"> {/* Ensure main content is pushed down */}

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
              />
          )}
        </div>
        {/* TopTaskBar moved outside max-w-7xl for full width */}
        <div className="w-full">
          <TopTaskBar
            items={upcomingItemsForBar}
            toggleGoalPriority={toggleGoalPriority}
          />
        </div>


           <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col space-y-2 items-end">
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-12 w-12 rounded-full shadow-lg"
                      aria-label="Add new task"
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
                        className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                    >
                        Delete All Occurrences
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </DndContext>
  );
}

    