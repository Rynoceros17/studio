
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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as FormDialogTitle, // Aliased to avoid conflict
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
    AlertDialogTitle as AlertTitle, // Aliased
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle as SheetDialogTitle, // Aliased
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { TopTaskBar } from '@/components/TopTaskBar';
import { AuthButton } from '@/components/AuthButton';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'; // Added import
import { useAuth } from '@/contexts/AuthContext';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, LogIn, SendHorizonal } from 'lucide-react';
import { format, parseISO, startOfDay, addDays, subDays } from 'date-fns';
import { cn, calculateGoalProgress, calculateTimeLeft, parseISOStrict } from '@/lib/utils';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const { user, authLoading } = useAuth();

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
  const [chatInput, setChatInput] = useState('');


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
        distance: 10, // Only start dragging after 10px movement
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
         exceptions: [], // Initialize exceptions array
         details: newTaskData.details || '', // Ensure details is a string
         dueDate: newTaskData.dueDate || undefined, // Ensure dueDate is string or undefined
     };
     setTasks((prevTasks) => {
         const updatedTasks = [...prevTasks, newTask];
         // Sort tasks: by date, then by highPriority, then by original order for stability
         updatedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);

             // Handle cases where dates might be null (shouldn't happen with validation but good for safety)
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1; // Null dates go to the end
             if (!dateB) return -1;

             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;

             // If dates are the same, sort by highPriority (true comes first)
             if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
             }
             
             // Preserve original order for tasks on the same day with same priority
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);

             // Handle new items correctly in relation to existing items if sort is complex
             if (originalAIndex === -1 && originalBIndex !== -1) return 1; // New items after existing
             if (originalAIndex !== -1 && originalBIndex === -1) return -1;
             if (originalAIndex === -1 && originalBIndex === -1) return 0; // Both new, order doesn't matter relative to each other yet
             return originalAIndex - originalBIndex;

         });
         return updatedTasks;
     });
     const taskDate = parseISOStrict(newTaskData.date);
     toast({
         title: "Task Added",
         description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
     });
     setIsFormOpen(false); // Close the form
  }, [setTasks, toast]);


  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
      // Remove all completions related to this task ID
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
      // Remove specific completion for this instance
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null); // Close confirmation dialog
  }, [tasks, setTasks, setCompletedTaskIds, toast]);


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
                  // Check if date or highPriority changed, as these affect sorting
                  if ((updates.date && updates.date !== task.date) ||
                      (updates.highPriority !== undefined && updates.highPriority !== task.highPriority)
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

                  // If dates are the same, sort by highPriority (true comes first)
                  if (a.highPriority !== b.highPriority) {
                      return a.highPriority ? -1 : 1;
                  }
                  return 0; // Maintain relative order for other cases or use original index
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
        // Separate tasks for the specific date from all other tasks
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date); // The date for which we are reordering
             if (!taskDateObj || !currentDay) return false; // Skip if dates are invalid

             if (task.exceptions?.includes(date)) return false; // Skip if excepted

             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay(); // 0 (Sun) - 6 (Sat)
                 const currentDayOfWeek = currentDay.getDay();
                 // Task is recurring, on the same day of the week, and currentDay is on or after task's start date
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  // Non-recurring task, check if its date matches the currentDay
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });

        // Tasks not for the specific date
        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true; // Keep if date is invalid (should be handled elsewhere)
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;

           if (task.exceptions?.includes(date)) return true; // Keep if excepted (it's not for this day)

           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });

        // Create a map for quick lookup of tasks for the specific date
        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
        
        // Create the reordered list for the specific date
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

        // Combine other tasks with the reordered tasks for the specific date
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

             // If tasks are on the target reorder date, use the provided order
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) { // Both tasks are in the ordered list
                     return aIndex - bIndex;
                 }
             }
             
              // Fallback for tasks not on the reorder date or if one is new
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }
             
             // Fallback to original order if all else is equal
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
                // If due date changes, we might need to re-sort if sort logic includes due dates
                needsResort = true;
            }
         return updatedTask;
       }
       return task;
     });

      if (needsResort) {
           // If sorting depends on dueDate, re-sort here
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

               // Optional: Sort by due date if primary dates are the same
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
    if (!isClient) return []; // Don't run on server or before client hydration
    
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
        dueDate: task.dueDate!, // Already confirmed not null
        type: 'task' as 'task',
        originalDate: task.date, // Keep original scheduled date
        description: task.description,
        taskHighPriority: task.highPriority, // Use specific name
        color: task.color,
        timeLeftDetails: calculateTimeLeft(task.dueDate), // Calculate once
      }));

    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const goalDueDate = parseISOStrict(goal.dueDate);
        if (!goalDueDate) return false;
        const timeLeftDetails = calculateTimeLeft(goal.dueDate);
        if (!timeLeftDetails || timeLeftDetails.isPastDue) return false; // Skip past due goals
        if (calculateGoalProgress(goal) >= 100) return false; // Skip completed goals
        return true;
      })
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!, // Already confirmed not null
        type: 'goal' as 'goal',
        goalHighPriority: goal.highPriority, // Use specific name
        progress: calculateGoalProgress(goal),
        timeLeftDetails: calculateTimeLeft(goal.dueDate), // Calculate once
      }));

    const combinedItems = [...mappedTasks, ...mappedGoals];

    return combinedItems.sort((a, b) => {
      // Prioritize high-priority items
      const aIsHighPriority = a.type === 'goal' ? a.goalHighPriority : a.taskHighPriority;
      const bIsHighPriority = b.type === 'goal' ? b.goalHighPriority : b.taskHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1;
      if (!aIsHighPriority && bIsHighPriority) return 1;

      // Then sort by due date (earliest first)
      const dueDateA = parseISOStrict(a.dueDate)!; // Assert not null as filtered
      const dueDateB = parseISOStrict(b.dueDate)!; // Assert not null as filtered
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [tasks, goals, isClient]); // Ensure isClient dependency

  const handleSendChatMessage = () => {
    if (chatInput.trim()) {
      console.log("Chat message sent:", chatInput);
      // Future AI integration point
      setChatInput('');
    }
  };

  const handleChatKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline on Enter
      handleSendChatMessage();
    }
  };


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <SyncStatusIndicator />
      <header
        className={cn(
          "bg-background border-b shadow-sm w-full",
          "flex flex-col" // Ensure header itself is a flex column
        )}
      >
        {/* Top Row: Title and Auth */}
        <div className="relative flex justify-center items-center w-full px-4 h-12 md:h-14">
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
            WeekWise
          </h1>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <AuthButton />
          </div>
        </div>

        {/* Bottom Row: Navigation Icons */}
        <nav className="flex justify-center items-center w-full py-2 space-x-1 md:space-x-2 border-t">
            <Link href="/timetable" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Go to timetable">
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="ml-2 hidden md:inline">Timetable</span>
                </Button>
            </Link>
            <Link href="/study-tracker" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="Go to study tracker">
                    <BookOpen className="h-5 w-5" />
                    <span className="ml-2 hidden md:inline">Study</span>
                </Button>
            </Link>
            <Link href="/goals" passHref legacyBehavior>
                <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" aria-label="View goals">
                    <Target className="h-5 w-5" />
                    <span className="ml-2 hidden md:inline">Goals</span>
                </Button>
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
        
        <div className="w-full mt-4">
           <TopTaskBar
             items={upcomingItemsForBar}
             toggleGoalPriority={toggleGoalPriority}
           />
         </div>

        {/* Chatbot Input Area */}
        <div className="w-full max-w-7xl mt-4">
            <Card className="shadow-md border-border">
                <CardHeader className="p-3 border-b">
                    <CardTitle className="text-base text-primary">AI Assistant (Coming Soon)</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <div className="flex space-x-2">
                        <Button onClick={handleSendChatMessage} className="h-10 px-3">
                            <SendHorizonal className="h-4 w-4" />
                            <span className="sr-only">Send Chat Message</span>
                        </Button>
                        <Input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask WeekWise AI anything..."
                            className="h-10 text-sm"
                            onKeyPress={handleChatKeyPress}
                        />
                    </div>
                    {/* Placeholder for chat messages display later - you can uncomment and style this when ready
                    <div className="mt-3 h-32 border rounded p-2 overflow-y-auto bg-muted/50">
                        <p className="text-xs text-muted-foreground italic">Chat history will appear here...</p>
                    </div>
                    */}
                </CardContent>
            </Card>
        </div>
        
        {/* Floating Action Buttons */}
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
                   <FormDialogTitle className="text-primary">Add New Task</FormDialogTitle>
                </DialogHeader>
                <TaskForm
                   addTask={addTask}
                   onTaskAdded={() => setIsFormOpen(false)}
                   initialData={null} // For new tasks
                />
              </DialogContent>
            </Dialog>
        </div>

        {/* Conditional Login Button - Bottom Left */}
        {!authLoading && !user && (
          <div className="fixed bottom-4 left-4 z-50">
            <Link href="/login" passHref legacyBehavior>
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
                         className={cn("text-foreground")} // Basic styling for this option
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

    

    
