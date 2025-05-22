
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
import { PomodoroTimer } from '@/components/PomodoroTimer'; // Import PomodoroTimer
import type { Task, Goal, UpcomingItem } from '@/lib/types'; // Updated to import UpcomingItem
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
// import { GoalsSheet } from '@/components/GoalsSheet'; // Goals is now a page
// import { NaturalLanguageTaskDialog } from '@/components/NaturalLanguageTaskDialog'; // Removing this
import { TopTaskBar } from '@/components/TopTaskBar';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen } from 'lucide-react'; // Removed Wand2
import { format, parseISO, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader as PageCardHeader, CardTitle as PageCardTitle } from '@/components/ui/card';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [goals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const completedCount = useMemo(() => {
      return completedTaskIds.length;
  }, [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);
  // const [isGoalsSheetOpen, setIsGoalsSheetOpen] = useState(false); // Removed, goals is a page
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  // const [isNaturalLanguageTaskDialogOpen, setIsNaturalLanguageTaskDialogOpen] = useState(false); // Removing this
  const [isTopTaskBarExpanded, setIsTopTaskBarExpanded] = useState(true);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const initialX = window.innerWidth - 300 - 24; // Adjusted for timer width
        const initialY = 24; // Default top padding
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Ensures small clicks don't initiate drag
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

  const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
      if (!dateString) return null;
      const datePart = dateString.split('T')[0]; // Ensure only date part is used for consistency
      const date = parseISO(datePart + 'T00:00:00'); // Add time part to ensure consistent parsing
      if (isNaN(date.getTime())) {
          console.error("Invalid date string received:", dateString);
          return null;
      }
      return date;
  }, []);

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
     const newTask: Task = {
         ...newTaskData,
         id: crypto.randomUUID(),
         files: newTaskData.files ?? [],
         details: newTaskData.details ?? '',
         dueDate: newTaskData.dueDate,
         recurring: newTaskData.recurring ?? false,
         highPriority: newTaskData.highPriority ?? false,
         exceptions: [], // Initialize exceptions array
         color: newTaskData.color,
     };
     setTasks((prevTasks) => {
         const updatedTasks = [...prevTasks, newTask];
         // Sort tasks: by date, then by high priority, then by original insertion order for same-day non-priority
         updatedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);

             if (!dateA && !dateB) return 0;
             if (!dateA) return 1; // Null dates go to the end
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // Same date, sort by high priority
             if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1; // High priority tasks first
             }

             // Same date, same priority, maintain original relative order if possible
             // This requires knowing original indices, which is complex to maintain here.
             // For now, new tasks are added to the end and this sort will keep them there relative to others of same date/priority.
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             if (originalAIndex === -1 && originalBIndex === -1) return 0; // both new
             if (originalAIndex === -1) return 1; // a is new, b is old
             if (originalBIndex === -1) return -1; // b is new, a is old
             return originalAIndex - originalBIndex; // maintain original order of existing tasks
         });
         return updatedTasks;
     });
     const taskDate = parseISOStrict(newTaskData.date);
     toast({
         title: "Task Added",
         description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
     });
     setIsFormOpen(false);
     // setIsNaturalLanguageTaskDialogOpen(false); // Removing this
  }, [setTasks, toast, parseISOStrict]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      // Remove all completions related to this task ID, regardless of date
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
              // Add the specific date string to the exceptions list
              const updatedExceptions = [...(task.exceptions || []), dateStr];
              return { ...task, exceptions: updatedExceptions };
          }
          return task;
      }));
      // Ensure completion for this specific instance is also removed
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
          setDeleteConfirmation({ task, dateStr }); // Open confirmation dialog for recurring tasks
      } else {
          deleteAllOccurrences(task.id); // Directly delete non-recurring tasks
      }
  }, [deleteAllOccurrences]);


  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => {
      setTasks(prevTasks => {
          let needsResort = false;
          const updatedTasks = prevTasks.map(task => {
              if (task.id === id) {
                  const updatedTask = { ...task, ...updates };
                  // Check if date or highPriority changed, as these affect sort order
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
                  // For tasks on the same day with same priority, try to maintain original order
                  // This is a simplification; true stable sort might require original indices.
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
        // Separate tasks for the given date from others
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date); // The date for which order is being updated
             if (!taskDateObj || !currentDay) return false;

             // Exclude tasks that have an exception for this specific date
             if (task.exceptions?.includes(date)) return false;

             // Handle recurring tasks: they appear if their start day of week matches
             // and the currentDay is on or after their initial start date.
             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay(); // 0 (Sun) - 6 (Sat)
                 const currentDayOfWeek = currentDay.getDay();
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  // For non-recurring tasks, check if they are scheduled for this exact date
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });

        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true; // Keep tasks without a valid date (should be filtered out elsewhere ideally)
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true; // Keep if it's an exception for this date

           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               // Exclude if it's a recurring task that would appear on this date
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               // Exclude if it's a non-recurring task for this date
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });

        // Create a map for quick lookup of tasks for the current date
        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
        // Reorder tasksForDate according to orderedTaskIds
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        // Combine and re-sort ALL tasks to maintain global sort order
        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If tasks are for the target date, use the explicit order
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex;
                 }
             }

              // Fallback sort by high priority
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }

             // Fallback to original insertion order (approximation by index in prevTasks)
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

      const completionKey = `${taskId}_${dateStr}`; // Key for specific instance
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


  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => {
   setTasks(prevTasks => {
      let needsResort = false; // Check if due date changes, requiring resort
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            // If dueDate changes, it might affect sorting for the TopTaskBar or other views
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
                needsResort = true; // Or any other field that affects global sorting
            }
         return updatedTask;
       }
       return task;
     });

      // Re-sort if a sort-affecting field like dueDate changed
      if (needsResort) {
           updatedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date); // Primary sort by task date
               const dateB = parseISOStrict(b.date);
               if (!dateA && !dateB) return 0;
               if (!dateA) return 1;
               if (!dateB) return -1;
               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;

               if (a.highPriority !== b.highPriority) { // Then by high priority
                   return a.highPriority ? -1 : 1;
               }
               // Add further sorting for dueDates if needed for TopTaskBar consistency
               const dueDateA = parseISOStrict(a.dueDate);
               const dueDateB = parseISOStrict(b.dueDate);
               if (dueDateA && dueDateB) {
                   return dueDateA.getTime() - dueDateB.getTime();
               }
               if (dueDateA) return -1; // Tasks with due dates first
               if (dueDateB) return 1;

               return 0; // Default maintain order
           });
       }
     return updatedTasks;
   });
   toast({
     title: "Task Details Updated",
     description: "Additional details have been updated.",
   });
  }, [setTasks, toast, parseISOStrict]);

  const upcomingItemsForBar = useMemo((): UpcomingItem[] => {
    if (!isClient) return []; // Ensure this runs only on client
    const today = startOfDay(new Date());

    const mappedTasks: UpcomingItem[] = tasks
      .filter(task => task.dueDate && parseISOStrict(task.dueDate) && parseISOStrict(task.dueDate)! >= today)
      .map(task => ({
        id: task.id,
        name: task.name,
        dueDate: task.dueDate!,
        type: 'task',
        originalDate: task.date,
        description: task.description,
        highPriority: task.highPriority,
        color: task.color,
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => goal.dueDate && parseISOStrict(goal.dueDate) && parseISOStrict(goal.dueDate)! >= today)
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!,
        type: 'goal',
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    return combinedItems.sort((a, b) => {
      const dueDateA = parseISOStrict(a.dueDate)!;
      const dueDateB = parseISOStrict(b.dueDate)!;
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient, parseISOStrict]);


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <header className={cn(
        "bg-background border-b shadow-sm w-full",
        "flex h-16 items-center justify-between px-4" // Ensures horizontal layout and padding
      )}>
        <nav className={cn(
          "flex items-center space-x-1" // Reduced space for smaller screens
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
          "text-xl md:text-2xl font-bold text-primary tracking-tight",
          "flex-grow text-center" // Title grows and centers its text
        )}>WeekWise</h1>
        
        {/* Spacer div to balance the nav icons for centering the title */}
        <div className={cn(
          "flex items-center space-x-1 invisible" // Must be invisible but take up space
        )} aria-hidden="true">
          {/* These buttons mirror the nav icons in structure and count to take same space */}
            <Button variant="ghost" size="icon" className="h-9 w-9"><LayoutDashboard className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><BookOpen className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><Target className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><BookmarkIcon className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><TimerIcon className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9"><List className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden"> {/* Removed pt-20 */}
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
          
          {isClient && (
            <TopTaskBar
              items={upcomingItemsForBar}
              isExpanded={isTopTaskBarExpanded}
              onToggle={() => setIsTopTaskBarExpanded(!isTopTaskBarExpanded)}
            />
          )}


           <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col space-y-2 items-end">
                {/* Removing Natural Language Task Button */}
                {/* <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                    aria-label="Add task with natural language"
                    onClick={() => setIsNaturalLanguageTaskDialogOpen(true)}
                >
                    <Wand2 className="h-6 w-6 text-primary" />
                </Button> */}

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
        </div>

        {isClient && isTimerVisible && (
          <PomodoroTimer
            position={timerPosition}
            onClose={() => setIsTimerVisible(false)}
          />
        )}

        {/* Removing NaturalLanguageTaskDialog invocation */}
        {/* <NaturalLanguageTaskDialog
            isOpen={isNaturalLanguageTaskDialogOpen}
            onClose={() => setIsNaturalLanguageTaskDialogOpen(false)}
            onTaskAdd={addTask}
        /> */}

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
                        className={buttonVariants({ variant: "destructive" })}
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
        
    
