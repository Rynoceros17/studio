"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import type { Task } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);


    const parseISOStrict = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        // Ensure the input is just the date part before appending time
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00'); // Add time part for consistent parsing
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            return null; // Return null for invalid dates
        }
        return date;
    }


   const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = {
           ...newTaskData,
           id: crypto.randomUUID(),
           files: newTaskData.files ?? [], // Initialize files array
       };
       setTasks((prevTasks) => {
           const updatedTasks = [...prevTasks, newTask];
           // Sort primarily by date, then maintain original insertion order for same date
           updatedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date);
               const dateB = parseISOStrict(b.date);

               if (!dateA && !dateB) return 0;
               if (!dateA) return 1; // Put tasks without valid dates at the end
               if (!dateB) return -1;

               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;

               // If dates are the same, find original indices (less efficient but maintains order)
               // This part might be less critical if CalendarView handles daily sorting
               const originalAIndex = prevTasks.findIndex(t => t.id === a.id); // Check original list
               const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
                // Handle cases where one or both tasks are new
               if (originalAIndex === -1 && originalBIndex === -1) return 0; // Both new, keep relative order
               if (originalAIndex === -1) return 1; // New task B comes after A
               if (originalBIndex === -1) return -1; // New task A comes before B
               return originalAIndex - originalBIndex; // Sort by original position

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

          // Combine and re-sort the entire list to maintain overall date order
          const combinedTasks = [...otherTasks, ...reorderedTasksForDate];
          combinedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date);
               const dateB = parseISOStrict(b.date);

               if (!dateA && !dateB) return 0;
               if (!dateA) return 1;
               if (!dateB) return -1;

               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;

                // If dates are the same, use the provided order for the specific date
               if (a.date === date && b.date === date) {
                   const aIndex = orderedTaskIds.indexOf(a.id);
                   const bIndex = orderedTaskIds.indexOf(b.id);
                   if (aIndex !== -1 && bIndex !== -1) {
                       return aIndex - bIndex;
                   }
               }

               // Fallback for tasks not on the reordered date (shouldn't be needed if logic is correct)
               const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
               const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
               return originalAIndex - originalBIndex;
          });


          return combinedTasks;
      });
  }, [setTasks, parseISOStrict]); // Add parseISOStrict dependency


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

      // Trigger re-sort after toggling completion
      setTasks(prevTasks => [...prevTasks]); // Create new array reference to trigger re-render/re-sort in CalendarView

  }, [tasks, completedTaskIds, setCompletedTaskIds, toast, setTasks]);

   const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => {
     setTasks(prevTasks => {
       return prevTasks.map(task => {
         if (task.id === id) {
           return { ...task, ...updates }; // Merge updates
         }
         return task;
       });
     });
     toast({
       title: "Task Updated",
       description: "Task details have been updated.",
     });
   }, [setTasks, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative">
      <div className="w-full max-w-7xl space-y-4">
        <header className="text-center py-2">
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
            />
        )}

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
      </div>
    </main>
  );
}
