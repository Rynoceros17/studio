
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor, // Import PointerSensor
  useSensor, // Import useSensor
  useSensors, // Import useSensors
} from '@dnd-kit/core';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import { PomodoroTimer } from '@/components/PomodoroTimer'; // Import PomodoroTimer
import type { Task } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
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
import { BookmarkListSheet } from '@/components/BookmarkListSheet'; // Import BookmarkListSheet
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon } from 'lucide-react'; // Added BookmarkIcon
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils'; // Import cn


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  // completedTaskIds now stores strings in the format: `${taskId}_${dateStr}`
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  // Calculate completed count based on unique task IDs present in completedTaskIds
  const completedCount = useMemo(() => {
      // Count based on unique tasks ever completed, might need adjustment based on exact requirement
      // For now, just count the number of completion entries
      return completedTaskIds.length;
  }, [completedTaskIds]);


  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false); // State for Bookmark sheet
  const [isTimerVisible, setIsTimerVisible] = useState(false); // State for Pomodoro timer visibility
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 }); // State for timer position
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);


  useEffect(() => {
    setIsClient(true);
    // Initial position slightly offset from top-right corner
    const initialX = typeof window !== 'undefined' ? window.innerWidth - 300 - 24 : 0; // Adjust 300 based on timer width
    const initialY = 24;
    setTimerPosition({ x: initialX, y: initialY });
  }, []);

  // Configure sensors for dragging the timer
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the mouse to move by 10 pixels before activating
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


    const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            return null;
        }
        return date;
    }, []); // Added useCallback with empty dependency array


   const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = {
           ...newTaskData,
           id: crypto.randomUUID(),
           files: newTaskData.files ?? [],
           details: newTaskData.details ?? '',
           dueDate: newTaskData.dueDate,
           recurring: newTaskData.recurring ?? false,
           highPriority: newTaskData.highPriority ?? false, // Add high priority
           exceptions: [], // Initialize exceptions array
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

               // Sort by priority within the same day (High priority first)
               if (a.highPriority !== b.highPriority) {
                    return a.highPriority ? -1 : 1;
               }

               // Keep original order if dates and priority are the same
               const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
               const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
               if (originalAIndex === -1 && originalBIndex === -1) return 0;
               if (originalAIndex === -1) return 1;
               if (originalBIndex === -1) return -1;
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


    // Deletes the base task (and therefore all its occurrences)
    const deleteAllOccurrences = useCallback((id: string) => {
        const taskToDelete = tasks.find(task => task.id === id);
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
        // Remove all completion entries associated with this task ID
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

    // Adds an exception for a specific date instance of a recurring task
    const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
        const taskToModify = tasks.find(task => task.id === taskId);
        setTasks(prevTasks => prevTasks.map(task => {
            if (task.id === taskId) {
                const updatedExceptions = [...(task.exceptions || []), dateStr];
                return { ...task, exceptions: updatedExceptions };
            }
            return task;
        }));
        // Optionally remove completion entry if it exists for this specific instance
        setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));

        if (taskToModify) {
            toast({
                title: "Task Instance Skipped",
                description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
            });
        }
        setDeleteConfirmation(null); // Close confirmation dialog
    }, [tasks, setTasks, setCompletedTaskIds, toast, parseISOStrict]);

    // This function is called by CalendarView to initiate the deletion process
    const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
        if (task.recurring) {
            setDeleteConfirmation({ task, dateStr }); // Open confirmation dialog for recurring tasks
        } else {
            deleteAllOccurrences(task.id); // Delete non-recurring task directly
        }
    }, [deleteAllOccurrences]);



    const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => {
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

                     // Sort by priority within the same day (High priority first)
                    if (a.highPriority !== b.highPriority) {
                        return a.highPriority ? -1 : 1;
                    }
                    return 0; // Maintain relative order otherwise
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
          const tasksForDate = prevTasks.filter(task => {
              const taskDateObj = parseISOStrict(task.date);
               const currentDay = parseISOStrict(date);

              // Skip if task date or current day is invalid
               if (!taskDateObj || !currentDay) return false;

               // Skip if the task has an exception for this date
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
             if (!taskDateObj) return true; // Keep tasks without dates
             const currentDay = parseISOStrict(date);
             if (!currentDay) return true; // Keep if target date is invalid

             // Skip if the task has an exception for this date (already handled above but good for clarity)
             if (task.exceptions?.includes(date)) return true;

             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay();
                 const currentDayOfWeek = currentDay.getDay();
                 // Exclude if it's recurring and matches the target date's day of week
                 return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
             } else {
                 // Exclude if it matches the target date directly
                 return format(taskDateObj, 'yyyy-MM-dd') !== date;
             }
          });

          const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
          const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

          const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

          // Keep the existing sort logic, which should place reordered tasks correctly at the end
           combinedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date);
               const dateB = parseISOStrict(b.date);

               if (!dateA && !dateB) return 0;
               if (!dateA) return 1;
               if (!dateB) return -1;

               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;

               // Within the same date, check if these tasks belong to the day being reordered
               const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
               const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);

               if (aIsForTargetDate && bIsForTargetDate) {
                   // If both tasks are for the specific date being reordered, use the provided order
                   const aIndex = orderedTaskIds.indexOf(a.id);
                   const bIndex = orderedTaskIds.indexOf(b.id);
                   if (aIndex !== -1 && bIndex !== -1) {
                       return aIndex - bIndex;
                   }
               }

               // If not part of the reorder for this specific date, sort by priority
                if (a.highPriority !== b.highPriority) {
                    return a.highPriority ? -1 : 1;
                }

               // Fallback to original overall order if dates and priority are the same
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
        // Trigger re-render by creating a new array - might not be needed if CalendarView reacts to completedTasks change
        // setTasks(prevTasks => [...prevTasks]);

    }, [tasks, completedTaskIds, setCompletedTaskIds, toast, parseISOStrict]);


   // Removed highPriority from updates type
   const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => {
     setTasks(prevTasks => {
        let needsResort = false; // Keep for potential future use or if other updates require resorting
       const updatedTasks = prevTasks.map(task => {
         if (task.id === id) {
             const updatedTask = { ...task, ...updates };
             // Removed check if priority changed
           return updatedTask;
         }
         return task;
       });

        // Keep the sorting logic in case other updates might require it in the future
        if (needsResort) {
             updatedTasks.sort((a, b) => {
                 const dateA = parseISOStrict(a.date);
                 const dateB = parseISOStrict(b.date);
                 if (!dateA && !dateB) return 0;
                 if (!dateA) return 1;
                 if (!dateB) return -1;
                 const dateComparison = dateA.getTime() - dateB.getTime();
                 if (dateComparison !== 0) return dateComparison;

                  // Sort by priority within the same day (High priority first)
                 if (a.highPriority !== b.highPriority) {
                     return a.highPriority ? -1 : 1;
                 }
                 return 0; // Maintain relative order otherwise
             });
         }

       return updatedTasks;
     });
     toast({
       title: "Task Details Updated",
       description: "Additional details have been updated.",
     });
   }, [setTasks, toast, parseISOStrict]);

  return (
    // Wrap the relevant part in DndContext for the timer
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden"> {/* Added overflow-hidden */}
        <div className="w-full max-w-7xl space-y-4">
          <header className="text-center py-2 relative z-10"> {/* Ensure header is above timer */}
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
          </header>

          {/* Conditionally render CalendarView only on the client */}
          {isClient && (
              <CalendarView
                tasks={tasks}
                requestDeleteTask={requestDeleteTask} // Pass the request function
                updateTaskOrder={updateTaskOrder}
                toggleTaskCompletion={toggleTaskCompletion} // Pass the modified function
                completedTasks={completedTasks} // Pass the Set of completion keys
                updateTaskDetails={updateTaskDetails} // Pass the modified updateTaskDetails
                updateTask={updateTask}
                completedCount={completedCount} // Pass the completed count
              />
          )}

          {/* Add New Task Dialog */}
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-lg z-50"
                aria-label="Add new task"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-primary">Add New Task</DialogTitle>
              </DialogHeader>
              <TaskForm addTask={addTask} onTaskAdded={() => setIsFormOpen(false)}/>
            </DialogContent>
          </Dialog>

          {/* Bookmark List Sheet Trigger - Positioned bottom-left, above Pomodoro */}
           <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
               <SheetTrigger asChild>
                   <Button
                     variant="outline"
                     size="icon"
                     className="fixed bottom-36 left-4 md:bottom-36 md:left-6 h-12 w-12 rounded-full shadow-lg z-50 bg-card hover:bg-card/90 border-primary" // Positioned above Pomodoro
                     aria-label="View bookmarks"
                   >
                     <BookmarkIcon className="h-6 w-6 text-primary" />
                   </Button>
               </SheetTrigger>
               <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                   <SheetHeader className="p-4 border-b shrink-0">
                     <SheetTitle className="text-primary">Bookmarks</SheetTitle>
                   </SheetHeader>
                    <BookmarkListSheet />
               </SheetContent>
           </Sheet>

          {/* Pomodoro Timer Trigger - Positioned bottom-left, above scratchpad */}
           <Button
             variant="outline"
             size="icon"
             className="fixed bottom-20 left-4 md:bottom-20 md:left-6 h-12 w-12 rounded-full shadow-lg z-50 bg-card hover:bg-card/90 border-primary" // Positioned above Scratchpad
             aria-label="Toggle Pomodoro Timer"
             onClick={() => setIsTimerVisible(!isTimerVisible)}
           >
             <TimerIcon className="h-6 w-6 text-primary" />
           </Button>


          {/* Task List (Scratchpad) Sheet Trigger - Positioned bottom-left */}
           <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
              <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-4 left-4 md:bottom-6 md:left-6 h-12 w-12 rounded-full shadow-lg z-50 bg-card hover:bg-card/90 border-primary" // Original position
                    aria-label="View scratchpad"
                  >
                    <List className="h-6 w-6 text-primary" />
                  </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                  <SheetHeader className="p-4 border-b shrink-0">
                    <SheetTitle className="text-primary">Scratchpad</SheetTitle>
                  </SheetHeader>
                   <TaskListSheet />
              </SheetContent>
           </Sheet>



        </div>

        {/* Render Pomodoro Timer if visible and on client */}
        {isClient && isTimerVisible && (
          <PomodoroTimer
            position={timerPosition}
            onClose={() => setIsTimerVisible(false)}
          />
        )}

         {/* Recurring Task Delete Confirmation Dialog */}
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
                         // Apply buttonVariants for outline and ensure text color contrasts
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
