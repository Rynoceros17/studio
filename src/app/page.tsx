
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo } from 'react'; // Added useMemo import
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
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
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  // State for completed tasks, using a Set of task IDs
  // We need a way to serialize/deserialize Set for local storage
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = new Set(completedTaskIds);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);


  // Helper function to parse ISO string safely
    const parseISOStrict = (dateString: string): Date => {
        // Add time component to ensure it parses as local date, not UTC midnight
        const date = parseISO(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            // Fallback to today if invalid, though ideally the form prevents this
            return new Date();
        }
        return date;
    }

  // Memoize tasks grouped by day - Define this *before* updateTaskOrder
   const tasksByDay = useMemo(() => {
       const grouped: { [key: string]: Task[] } = {};
       tasks.forEach(task => {
           if (!grouped[task.date]) {
               grouped[task.date] = [];
           }
           grouped[task.date].push(task);
           // Optionally sort within the group here if needed initially
            grouped[task.date].sort((a, b) => {
                const aCompleted = completedTasks.has(a.id);
                const bCompleted = completedTasks.has(b.id);
                if (aCompleted === bCompleted) {
                    // Find original index if stable sort isn't guaranteed or sufficient
                    const originalAIndex = tasks.findIndex(t => t.id === a.id);
                    const originalBIndex = tasks.findIndex(t => t.id === b.id);
                    return originalAIndex - originalBIndex;
                }
                return aCompleted ? 1 : -1; // Non-completed first
            });
       });
       return grouped;
   }, [tasks, completedTasks]);


  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: crypto.randomUUID(), // Generate unique ID
      recurring: newTaskData.recurring ?? false, // Ensure recurring defaults to false if not provided
    };
    // Add the new task and re-sort all tasks by date
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    toast({
        title: "Task Added",
        description: `"${newTaskData.name}" added for ${format(parseISOStrict(newTaskData.date), 'PPP')}.`,
    });
    setIsFormOpen(false); // Close dialog on successful add
  }, [setTasks, toast]);


  const deleteTask = useCallback((id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    // Also remove from completed set if it exists there
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
      const tasksForDate = prevTasks.filter(task => task.date === date);
      const otherTasks = prevTasks.filter(task => task.date !== date);

      // Create a map for quick lookup
      const taskMap = new Map(tasksForDate.map(task => [task.id, task]));

      // Reorder tasks based on the new order
      const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

       // Combine and sort the full list: other tasks first (implicitly sorted by date), then reordered tasks for the specific date
       // Need to ensure sorting considers completed status if that affects visual order maintained by DnD
       const sortedTasks = [...otherTasks, ...reorderedTasksForDate].sort((a, b) => {
           const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
           if (dateComparison !== 0) return dateComparison;

           // If dates are the same, maintain the order from DnD within that day
           // Find indices within the reordered list for the current date
           const aIndex = orderedTaskIds.indexOf(a.id);
           const bIndex = orderedTaskIds.indexOf(b.id);

           // If both are in the reordered list, use their DnD order
           if (aIndex !== -1 && bIndex !== -1 && a.date === date) {
               return aIndex - bIndex;
           }
           // If only one is in the list (shouldn't happen if filtering is correct, but handle defensively)
           if (aIndex !== -1 && a.date === date) return -1; // Put reordered items first? Or last? Depends on desired behavior.
           if (bIndex !== -1 && b.date === date) return 1;

           // Fallback for tasks not involved in the DnD operation (shouldn't happen with current logic)
           return 0;
       });

       return sortedTasks;
    });
     // Optional: Add a toast notification for reordering
     // toast({ title: "Tasks Reordered", description: `Order updated for ${format(parseISOStrict(date), 'PPP')}.` });
  }, [setTasks, tasksByDay]); // Now tasksByDay is defined before this


  const toggleTaskCompletion = useCallback((id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const currentlyCompleted = completedTasks.has(id);
      const newCompletedIds = new Set(completedTasks); // Clone the set

      if (currentlyCompleted) {
          newCompletedIds.delete(id);
          toast({
              title: "Task Incomplete",
              description: `"${task.name}" marked as incomplete.`,
          });
      } else {
          newCompletedIds.add(id);
          toast({
              title: "Task Completed!",
              description: `"${task.name}" marked as complete.`,
          });
      }
      // Update local storage with the array version of the set
      setCompletedTaskIds(Array.from(newCompletedIds));
  }, [tasks, completedTasks, setCompletedTaskIds, toast]);


  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-secondary/30 relative">
      <div className="w-full max-w-7xl space-y-8"> {/* Increased max-width */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
          <p className="text-muted-foreground mt-2">Your Weekly Task Planner</p>
        </header>

        {/* Pass completedTasks and toggleTaskCompletion to CalendarView */}
        <CalendarView
          tasks={tasks}
          deleteTask={deleteTask}
          updateTaskOrder={updateTaskOrder}
          toggleTaskCompletion={toggleTaskCompletion}
          completedTasks={completedTasks}
        />

        {/* Task Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
             {/* Floating Action Button */}
            <Button
              variant="default" // Use primary color
              size="icon"
              className="fixed bottom-6 right-6 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-lg z-50"
              aria-label="Add new task"
            >
              <Plus className="h-7 w-7" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-primary">Add New Task</DialogTitle>
            </DialogHeader>
            {/* Pass addTask and a function to close the dialog */}
            <TaskForm addTask={addTask} onTaskAdded={() => setIsFormOpen(false)}/>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
