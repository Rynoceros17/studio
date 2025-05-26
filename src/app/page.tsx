
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
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, FilePlus } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { cn, calculateGoalProgress, calculateTimeLeft, parseISOStrict } from '@/lib/utils';


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
        const initialX = window.innerWidth - 300 - 24; // Timer width + padding
        const initialY = 24; // Padding from top
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Drag only if moved more than 10px
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
         // color: newTaskData.color || undefined, // Removed color
     };
     setTasks((prevTasks) => {
         const updatedTasks = [...prevTasks, newTask];
         // Sort tasks: by date, then by highPriority, then maintain original relative order
         updatedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);

             // Handle cases where date might be null/invalid
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1; // Put tasks without valid dates at the end
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If dates are the same, sort by highPriority (true comes first)
             if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
             }
             
             // Maintain original relative order if dates and priority are the same
             // This part is tricky without original indices, relying on stable sort or previous position
             // For simplicity, if dates and priority are same, original order is not strictly enforced here
             // but could be if we stored an original index or timestamp of creation.
             // The most reliable way is to ensure newly added tasks appear at the end for their date/priority group.
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             // If one is new and the other is not, the new one comes after.
             if (originalAIndex === -1 && originalBIndex !== -1) return 1;
             if (originalAIndex !== -1 && originalBIndex === -1) return -1;
             // If both are new or both old, their relative order doesn't change based on this sort.
             // If both were old, their relative order is preserved by stable sort or their previous relative position.
             if (originalAIndex === -1 && originalBIndex === -1) return 0; // Should not happen if prevTasks are correctly passed
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
  }, [setTasks, toast]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      
      // Remove all completions for this task ID, regardless of date
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => !completionKey.startsWith(`${id}_`)));
      if (taskToDelete) {
          toast({
              title: "Task Deleted",
              description: `"${taskToDelete.name}" and all its future occurrences have been removed.`,
              variant: "destructive",
          });
      }
       setDeleteConfirmation(null); // Close confirmation dialog
  }, [tasks, setTasks, setCompletedTaskIds, toast]);


  // Callback to delete only a specific instance of a recurring task
  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
      const taskToModify = tasks.find(task => task.id === taskId);
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              // Add the date as an exception
              const updatedExceptions = [...(task.exceptions || []), dateStr];
              return { ...task, exceptions: updatedExceptions };
          }
          return task;
      }));
      
      // Remove completion only for this specific instance
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null); // Close confirmation dialog
  }, [tasks, setTasks, setCompletedTaskIds, toast]);


  // Opens the delete confirmation dialog or directly deletes non-recurring tasks
  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr }); // Open confirmation dialog
      } else {
          deleteAllOccurrences(task.id); // Delete directly if not recurring
      }
  }, [deleteAllOccurrences]);


  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>>) => {
      setTasks(prevTasks => {
          let needsResort = false;
          const updatedTasks = prevTasks.map(task => {
              if (task.id === id) {
                  const updatedTask = { ...task, ...updates };
                  // Check if properties affecting sort order have changed
                  if ((updates.date && updates.date !== task.date) ||
                      (updates.highPriority !== undefined && updates.highPriority !== task.highPriority)
                    // Add other sort-relevant properties here, e.g., color if it affects sorting visually
                    ) {
                      needsResort = true;
                  }
                  return updatedTask;
              }
              return task;
          });

          if (needsResort) {
              // Re-sort the tasks array if a sort-relevant property changed
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
                  // Add other sorting criteria if needed
                  return 0; // Fallback, maintain original relative order if possible
              });
          }
          return updatedTasks;
      });
      toast({
          title: "Task Updated",
          description: "Core task details have been updated.",
      });
  }, [setTasks, toast]);


  const updateTaskOrder = useCallback((date: string, orderedTaskIds: string[]) => {
    setTasks(prevTasks => {
        // Separate tasks for the target date and all other tasks
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date); // The date for which we are reordering
             if (!taskDateObj || !currentDay) return false;

             // Exclude tasks that have an exception for this date
             if (task.exceptions?.includes(date)) return false;

             // Check if the task falls on this date (recurring or single)
             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay();
                 const currentDayOfWeek = currentDay.getDay();
                 // Task is recurring on this day of the week, and current day is on or after task start date
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  // Task is a single occurrence on this specific date
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });

        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true; // Keep tasks without a valid date in 'otherTasks'
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true; // Keep excepted tasks in 'otherTasks'

           // Check if the task *does not* fall on this date
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
        
        // Create the reordered list for the target date
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        // Combine other tasks with the reordered tasks for the target date
        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

        // Re-sort the entire list to maintain overall sort order (date, priority)
         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If tasks are on the same day (the target date for reordering)
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex; // Use the new explicit order
                 }
             }
             
              // Fallback: sort by high priority if not on the reordered date or if order not specified
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }
             
             // Fallback to original index if all else is equal (to maintain stability for non-reordered items)
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
              if (originalAIndex === -1 && originalBIndex === -1) return 0; // Both new
              if (originalAIndex === -1) return 1; // a is new, b is old
              if (originalBIndex === -1) return -1; // b is new, a is old
             return originalAIndex - originalBIndex;
        });
        return combinedTasks;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTasks]); // Removed tasksByDay


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


  // Update only details and dueDate (and files if re-added)
  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate'>>) => {
   setTasks(prevTasks => {
      let needsResort = false; // If dueDate changes, we might need to re-sort
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            // Check if properties affecting sort order have changed
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
                needsResort = true;
            }
         return updatedTask;
       }
       return task;
     });

      if (needsResort) {
           // Re-sort based on broader criteria if a sort-relevant property changed
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

               // Optionally sort by due date if main dates are the same
               const dueDateA = parseISOStrict(a.dueDate);
               const dueDateB = parseISOStrict(b.dueDate);
               if (dueDateA && dueDateB) {
                   return dueDateA.getTime() - dueDateB.getTime();
               }
               if (dueDateA) return -1; // Tasks with due dates might come before those without
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

  // Memoize the list of upcoming items for the TopTaskBar
  const upcomingItemsForBar = useMemo((): UpcomingItem[] => {
    if (!isClient) return []; // Don't run on server or before client is ready

    const today = startOfDay(new Date());

    const mappedTasks: UpcomingItem[] = tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const dueDate = parseISOStrict(task.dueDate);
        return dueDate && dueDate >= today; // Due date is today or in the future
      })
      .map(task => ({
        id: task.id,
        name: task.name,
        dueDate: task.dueDate!,
        type: 'task' as 'task',
        originalDate: task.date, // For tasks, the date it's scheduled on
        description: task.description,
        taskHighPriority: task.highPriority,
        // color: task.color, // Color removed
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const timeLeftDetails = calculateTimeLeft(goal.dueDate);
        if (!timeLeftDetails || timeLeftDetails.isPastDue) return false; // Exclude past due goals
        if (calculateGoalProgress(goal) >= 100) return false; // Exclude completed goals
        return true;
      })
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!,
        type: 'goal' as 'goal',
        progress: calculateGoalProgress(goal),
        goalHighPriority: goal.highPriority,
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    // Sort: High priority items first, then by due date (earliest first)
    return combinedItems.sort((a, b) => {
      // Determine priority status for a and b
      const aIsHighPriority = a.type === 'goal' ? a.goalHighPriority : a.taskHighPriority;
      const bIsHighPriority = b.type === 'goal' ? b.goalHighPriority : b.taskHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1;
      if (!aIsHighPriority && bIsHighPriority) return 1;

      // If priorities are the same, sort by due date
      const dueDateA = parseISOStrict(a.dueDate)!; // Non-null asserted as they are filtered
      const dueDateB = parseISOStrict(b.dueDate)!;
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient, calculateGoalProgress, calculateTimeLeft, parseISOStrict]); // Added calculateTimeLeft and parseISOStrict


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <header
        className={cn(
          "bg-background shadow-sm w-full", // Removed border-b
          "flex h-16 items-center justify-between px-4"
        )}
      >
        {/* Left Navigation Group */}
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

        {/* Centered Title */}
        <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">WeekWise</h1>
        </div>

        {/* Right Navigation Group */}
        <nav className="flex space-x-1">
            <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View bookmarks">
                        <BookmarkIcon className="h-5 w-5" />
                        <span className="hidden md:inline ml-2">Bookmarks</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle className="text-primary">Bookmarks</SheetTitle>
                    </SheetHeader>
                    <BookmarkListSheet />
                </SheetContent>
            </Sheet>
            <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Open scratchpad">
                        <List className="h-5 w-5" />
                        <span className="hidden md:inline ml-2">Scratchpad</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b shrink-0">
                        <SheetTitle className="text-primary">Scratchpad</SheetTitle>
                    </SheetHeader>
                    <TaskListSheet />
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
        </nav>
      </header>

      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 mt-16"> {/* Added mt-16 for header height */}

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
        
        <div className="w-full mt-4"> {/* Ensure TopTaskBar has some margin if needed and takes full width */}
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

        {/* Bottom Left FABs */}
        <div className="fixed bottom-4 left-4 z-50 flex flex-col space-y-2 items-start">
             <Link href="/blank-page" passHref legacyBehavior>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full shadow-lg text-primary border-primary hover:bg-primary/10">
                    <FilePlus className="h-6 w-6" />
                </Button>
             </Link>
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
                         className={cn("text-foreground")} // Ensuring text color for this action
                    >
                        Delete This Occurrence Only
                    </AlertDialogAction>
                    <AlertDialogAction
                        onClick={() => deleteAllOccurrences(deleteConfirmation!.task.id)}
                        className={cn(buttonVariants({ variant: "destructive" }))} // Using buttonVariants for destructive style
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

