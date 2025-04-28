
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { Plus, List, Timer as TimerIcon } from 'lucide-react'; // Added TimerIcon
import { format, parseISO } from 'date-fns';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false); // State for Pomodoro timer visibility
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 }); // State for timer position
  const [isClient, setIsClient] = useState(false);

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


    const parseISOStrict = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            return null;
        }
        return date;
    }


   const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = {
           ...newTaskData,
           id: crypto.randomUUID(),
           files: newTaskData.files ?? [],
           details: newTaskData.details ?? '',
           dueDate: newTaskData.dueDate,
           recurring: newTaskData.recurring ?? false,
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
   }, [setTasks, toast]);


  const deleteTask = useCallback((id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    setCompletedTaskIds(prevIds => prevIds.filter(taskId => taskId !== id));
     if (taskToDelete) {
        toast({
          title: "Task Deleted",
          description: `"${taskToDelete.name}" has been removed.`,
          variant: "destructive",
        });
     }
  }, [setTasks, setCompletedTaskIds, tasks, toast]);

    const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate'>>) => {
        setTasks(prevTasks => {
            let needsResort = false;
            const updatedTasks = prevTasks.map(task => {
                if (task.id === id) {
                    const updatedTask = { ...task, ...updates };
                    if (updates.date && updates.date !== task.date) {
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
                    return dateA.getTime() - dateB.getTime();
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
          const tasksForDate = prevTasks.filter(task => {
              const taskDateObj = parseISOStrict(task.date);
              return taskDateObj && format(taskDateObj, 'yyyy-MM-dd') === date;
          });
          const otherTasks = prevTasks.filter(task => {
              const taskDateObj = parseISOStrict(task.date);
              return !taskDateObj || format(taskDateObj, 'yyyy-MM-dd') !== date;
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

                const taskADateStr = dateA ? format(dateA, 'yyyy-MM-dd') : '';
                const taskBDateStr = dateB ? format(dateB, 'yyyy-MM-dd') : '';

               if (taskADateStr === date && taskBDateStr === date) {
                   const aIndex = orderedTaskIds.indexOf(a.id);
                   const bIndex = orderedTaskIds.indexOf(b.id);
                   if (aIndex !== -1 && bIndex !== -1) {
                       return aIndex - bIndex;
                   }
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


  const toggleTaskCompletion = useCallback((id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const currentCompletedIds = new Set(completedTaskIds);

      if (currentCompletedIds.has(id)) {
          currentCompletedIds.delete(id);
          toast({
              title: "Task Incomplete",
              description: `"${task.name}" marked as incomplete.`,
          });
      } else {
          currentCompletedIds.add(id);
          toast({
              title: "Task Completed!",
              description: `"${task.name}" marked as complete.`,
          });
      }
      setCompletedTaskIds(Array.from(currentCompletedIds));
      setTasks(prevTasks => [...prevTasks]);

  }, [tasks, completedTaskIds, setCompletedTaskIds, toast, setTasks]);

   const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => {
     setTasks(prevTasks => {
       return prevTasks.map(task => {
         if (task.id === id) {
           return { ...task, ...updates };
         }
         return task;
       });
     });
     toast({
       title: "Task Details Updated",
       description: "Additional details have been updated.",
     });
   }, [setTasks, toast]);

  return (
    // Wrap the relevant part in DndContext for the timer
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden"> {/* Added overflow-hidden */}
        <div className="w-full max-w-7xl space-y-4">
          <header className="text-center py-2 relative z-10"> {/* Ensure header is above timer */}
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
            <p className="text-sm text-muted-foreground mt-1">Your Weekly Task Planner</p>
          </header>

          {/* Conditionally render CalendarView only on the client */}
          {isClient && (
              <CalendarView
                tasks={tasks}
                deleteTask={deleteTask}
                updateTaskOrder={updateTaskOrder}
                toggleTaskCompletion={toggleTaskCompletion}
                completedTasks={completedTasks}
                updateTaskDetails={updateTaskDetails}
                updateTask={updateTask}
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

          {/* Task List Sheet */}
           <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
              <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-4 left-4 md:bottom-6 md:left-6 h-12 w-12 rounded-full shadow-lg z-50 bg-card hover:bg-card/90 border-primary"
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

           {/* Pomodoro Timer Trigger */}
           <Button
             variant="outline"
             size="icon"
             className="fixed top-4 right-4 md:top-6 md:right-6 h-12 w-12 rounded-full shadow-lg z-50 bg-card hover:bg-card/90 border-primary"
             aria-label="Toggle Pomodoro Timer"
             onClick={() => setIsTimerVisible(!isTimerVisible)}
           >
             <TimerIcon className="h-6 w-6 text-primary" />
           </Button>

        </div>

        {/* Render Pomodoro Timer if visible and on client */}
        {isClient && isTimerVisible && (
          <PomodoroTimer
            position={timerPosition}
            onClose={() => setIsTimerVisible(false)}
          />
        )}

      </main>
    </DndContext>
  );
}

