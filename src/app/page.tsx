
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo } from 'react';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import type { Task } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
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
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

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
           const dateKey = task.date; // Use the yyyy-MM-dd string as the key
           if (!grouped[dateKey]) {
               grouped[dateKey] = [];
           }
           grouped[dateKey].push(task);
            // Sort within the group: non-completed first, then completed, maintaining DnD order within status
            grouped[dateKey].sort((a, b) => {
                const aCompleted = completedTasks.has(a.id);
                const bCompleted = completedTasks.has(b.id);
                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1; // Non-completed first
                }
                // If completion status is the same, maintain relative order from `tasks` array
                const originalAIndex = tasks.findIndex(t => t.id === a.id);
                const originalBIndex = tasks.findIndex(t => t.id === b.id);
                return originalAIndex - originalBIndex;
            });
       });
       return grouped;
   }, [tasks, completedTasks]); // Depend on completedTasks set directly


  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: crypto.randomUUID(), // Generate unique ID
    };
    // Add the new task and re-sort all tasks by date, then by creation order implicitly
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => {
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        // If dates are the same, keep original relative order (new task at the end)
        return 0; // Or return 1 to always put new tasks last if sort isn't stable
    }));
    toast({
        title: "Task Added",
        description: `"${newTaskData.name}" added for ${format(parseISOStrict(newTaskData.date), 'PPP')}.`,
    });
    setIsFormOpen(false); // Close dialog on successful add
  }, [setTasks, toast, parseISOStrict]);


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
      // Separate tasks for the specific date and others
      const tasksForDate = prevTasks.filter(task => task.date === date);
      const otherTasks = prevTasks.filter(task => task.date !== date);

      // Create a map for quick lookup of tasks for the specific date
      const taskMap = new Map(tasksForDate.map(task => [task.id, task]));

      // Create the reordered list for the specific date based on IDs
      const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

       // Combine and sort the full list
       const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

       // Sort first by date, then maintain the new order for the specific date
       combinedTasks.sort((a, b) => {
           const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
           if (dateComparison !== 0) return dateComparison;

           // If dates are the same and it's the date we reordered...
           if (a.date === date && b.date === date) {
               const aIndex = orderedTaskIds.indexOf(a.id);
               const bIndex = orderedTaskIds.indexOf(b.id);
               // Should always find indices if logic is correct
               if (aIndex !== -1 && bIndex !== -1) {
                   return aIndex - bIndex;
               }
           }

            // Fallback for tasks not on the reordered date (maintain original relative order)
            const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
            const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
            return originalAIndex - originalBIndex;
       });

       return combinedTasks;
    });
  }, [setTasks]); // Removed tasksByDay dependency as it's not needed


  const toggleTaskCompletion = useCallback((id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      // Clone the current set of IDs
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
      // Update local storage with the array version of the set
      setCompletedTaskIds(Array.from(currentCompletedIds));
  }, [tasks, completedTaskIds, setCompletedTaskIds, toast]); // Depend on completedTaskIds array


  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative"> {/* Reduced padding */}
      <div className="w-full max-w-7xl space-y-4"> {/* Reduced space */}
        <header className="text-center py-2"> {/* Reduced padding */}
          <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">WeekWise</h1> {/* Slightly smaller on mobile */}
          <p className="text-sm text-muted-foreground mt-1">Your Weekly Task Planner</p> {/* Slightly smaller text */}
        </header>

        <CalendarView
          tasks={tasks}
          deleteTask={deleteTask}
          updateTaskOrder={updateTaskOrder}
          toggleTaskCompletion={toggleTaskCompletion}
          completedTasks={completedTasks} // Pass the Set
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-lg z-50" // Slightly smaller FAB
              aria-label="Add new task"
            >
              <Plus className="h-6 w-6" /> {/* Slightly smaller icon */}
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
