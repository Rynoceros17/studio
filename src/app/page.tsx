
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
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen } from 'lucide-react';
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
        const initialX = window.innerWidth - 300 - 24; // 300 for timer width, 24 for padding
        const initialY = 24; // Padding from top
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Drag 10px before initiating drag
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
         details: newTaskData.details ?? '',
         dueDate: newTaskData.dueDate,
         recurring: newTaskData.recurring ?? false,
         highPriority: newTaskData.highPriority ?? false,
         exceptions: [],
         color: newTaskData.color,
     };
     setTasks((prevTasks) => {
         const updatedTasks = [...prevTasks, newTask];
         // Sort tasks: by date, then by highPriority, then by original insertion order for same-day, same-priority
         updatedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);

             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1; // High priority tasks first
             }
             // For tasks on the same day with the same priority, maintain original relative order
             // This requires knowing their original index if they were already in prevTasks
             // For new tasks, they just get appended and this part of sort might not be perfectly stable
             // without more complex tracking, but for existing tasks it should hold.
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             if (originalAIndex === -1 && originalBIndex === -1) return 0; // Both new
             if (originalAIndex === -1) return 1; // a is new, b is old, a goes after
             if (originalBIndex === -1) return -1; // b is new, a is old, a goes before
             return originalAIndex - originalBIndex;
         });
         return updatedTasks;
     });
     const taskDate = parseISOStrict(newTaskData.date);
     toast({
         title: "Task Added",
         description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
     });
     setIsFormOpen(false); // Close form after adding
  }, [setTasks, toast, parseISOStrict]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      // Also remove any completed instances of this task
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


  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
      const taskToModify = tasks.find(task => task.id === taskId);
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              const updatedExceptions = [...(task.exceptions || []), dateStr];
              return { ...task, exceptions: updatedExceptions };
          }
          return task;
      }));
      // Remove completion status specifically for this instance if it was marked completed
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null); // Close confirmation dialog
  }, [tasks, setTasks, setCompletedTaskIds, toast, parseISOStrict]);


  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr }); // Open confirmation dialog
      } else {
          // For non-recurring tasks, delete directly
          deleteAllOccurrences(task.id);
      }
  }, [deleteAllOccurrences]);


  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'details' | 'dueDate' | 'exceptions'>>) => {
      setTasks(prevTasks => {
          let needsResort = false;
          const updatedTasks = prevTasks.map(task => {
              if (task.id === id) {
                  const updatedTask = { ...task, ...updates };
                  // Check if date or highPriority changed to trigger a resort
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
                  // Fallback to original index if dates and priority are same (complex to maintain perfectly without original indices)
                  // This simplified sort might not perfectly preserve original order for same-date/priority tasks
                  // if their original indices aren't directly available during this map/sort.
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
        // Separate tasks for the given date and other tasks
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date); // The date of the column being reordered
             if (!taskDateObj || !currentDay) return false;

             // Check if this task instance should appear on this date
             if (task.exceptions?.includes(date)) return false; // Skip if it's an exception

             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay(); // Day of the week for the task's original start
                 const currentDayOfWeek = currentDay.getDay(); // Day of the week for the current calendar column
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj; // Matches day of week and is on/after original start
             } else {
                  return format(taskDateObj, 'yyyy-MM-dd') === date; // Non-recurring, matches exact date
             }
        });

        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true; // Keep tasks with invalid dates (should be rare)
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true; // This task is an exception for 'date', so it's an "otherTask"

           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               // It's an "otherTask" if it doesn't belong to this 'date' column's recurring instances
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               // It's an "otherTask" if its date doesn't match 'date'
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });

        // Create a map for quick lookup of tasks for the reordering date
        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
        // Reorder tasks based on the new orderedTaskIds
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        // Combine other tasks with the reordered tasks for the specific date
        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

        // Re-sort the entire list to maintain global order (date, priority)
         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If tasks are for the specific reordered date, use the new order
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex;
                 }
             }
             // For tasks not on the reordered date, or one is and one isn't, sort by priority
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }
             // Fallback: try to maintain original relative order of non-reordered tasks
             // This is tricky without more robust original indexing across all tasks
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

      const completionKey = `${taskId}_${dateStr}`; // Key includes the specific date instance

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
      let needsResort = false;
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            // Check if dueDate changed to trigger a resort (if tasks are sorted by dueDate in some views)
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
                needsResort = true;
            }
         return updatedTask;
       }
       return task;
     });

      if (needsResort) {
           // Example resort logic if needed (e.g., if you display tasks globally sorted by due date elsewhere)
           // For the calendar view, primary sort is by 'date', then 'highPriority'.
           // This resort might be more relevant for the 'Upcoming Deadlines' bar.
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
               if (dueDateA) return -1; // Tasks with due dates first
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
    if (!isClient) return []; // Don't compute on server or before client hydration
    const today = startOfDay(new Date());

    const mappedTasks: UpcomingItem[] = tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const dueDateObj = parseISOStrict(task.dueDate);
        const timeLeftDetails = calculateTimeLeft(task.dueDate);
        return dueDateObj && timeLeftDetails && !timeLeftDetails.isPastDue;
      })
      .map(task => ({
        id: task.id,
        name: task.name,
        dueDate: task.dueDate!,
        type: 'task' as 'task',
        originalDate: task.date,
        description: task.description,
        taskHighPriority: task.highPriority, // Use specific key for task priority
        color: task.color,
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const dueDateObj = parseISOStrict(goal.dueDate);
        if (!dueDateObj) return false;
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
        progress: calculateGoalProgress(goal),
        goalHighPriority: goal.highPriority, // Use specific key for goal priority
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    return combinedItems.sort((a, b) => {
      // Sort by priority first (goals then tasks if both prioritized, or vice-versa)
      const aIsHighPriority = a.type === 'goal' ? a.goalHighPriority : a.taskHighPriority;
      const bIsHighPriority = b.type === 'goal' ? b.goalHighPriority : b.taskHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1;
      if (!aIsHighPriority && bIsHighPriority) return 1;

      // Then sort by due date
      const dueDateA = parseISOStrict(a.dueDate)!;
      const dueDateB = parseISOStrict(b.dueDate)!;
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient, parseISOStrict]);


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <header className={cn(
        "bg-background border-b shadow-sm w-full",
        "flex h-16 items-center justify-between px-4" // Default for larger screens
      )}>
        <nav className={cn(
          "flex items-center space-x-1"
        )}>
          <Link href="/dashboard" passHref legacyBehavior>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" aria-label="Go to dashboard">
              <LayoutDashboard className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/study-tracker" passHref legacyBehavior>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" aria-label="Go to study tracker">
              <BookOpen className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/goals" passHref legacyBehavior>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" aria-label="View goals">
              <Target className="h-5 w-5" />
            </Button>
          </Link>
          <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" aria-label="View bookmarks">
                <BookmarkIcon className="h-5 w-5" />
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
            size="icon"
            className="h-9 w-9 text-primary hover:bg-primary/10"
            aria-label="Toggle Pomodoro Timer"
            onClick={() => setIsTimerVisible(!isTimerVisible)}
          >
            <TimerIcon className="h-5 w-5" />
          </Button>
          <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" aria-label="View scratchpad">
                <List className="h-5 w-5" />
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

        <h1 className={cn(
          "text-xl md:text-2xl font-bold text-primary tracking-tight flex-grow text-center"
        )}>WeekWise</h1>
        
        {/* Invisible spacer to balance the nav icons for centering the title */}
        <div className={cn(
          "flex items-center space-x-1 invisible"
        )} aria-hidden="true">
            {/* Mirror the structure of the nav icons */}
            <Button variant="ghost" size="icon" className="h-9 w-9"><LayoutDashboard className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><BookOpen className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><Target className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><BookmarkIcon className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><TimerIcon className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><List className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden mt-16">
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
         <div className="w-full mt-4"> {/* Wrapper for TopTaskBar to allow it to span full width */}
            {isClient && (
                <TopTaskBar
                items={upcomingItemsForBar}
                toggleGoalPriority={toggleGoalPriority}
                />
            )}
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
                         className={cn(buttonVariants({ variant: "outline" }), "text-foreground")}
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
      </main>
    </DndContext>
  );
}

