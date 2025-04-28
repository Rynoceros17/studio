"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo } from 'react';
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
import { format, parseISO } from 'date-fns';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);


    const parseISOStrict = (dateString: string): Date => {
        const date = parseISO(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            return new Date();
        }
        return date;
    }

   const tasksByDay = useMemo(() => {
       const grouped: { [key: string]: Task[] } = {};
       tasks.forEach(task => {
           const dateKey = task.date;
           if (!grouped[dateKey]) {
               grouped[dateKey] = [];
           }
           grouped[dateKey].push(task);
            grouped[dateKey].sort((a, b) => {
                const aCompleted = completedTasks.has(a.id);
                const bCompleted = completedTasks.has(b.id);
                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1;
                }
                const originalAIndex = tasks.findIndex(t => t.id === a.id);
                const originalBIndex = tasks.findIndex(t => t.id === b.id);
                return originalAIndex - originalBIndex;
            });
       });
       return grouped;
   }, [tasks, completedTasks]);


  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: crypto.randomUUID(),
    };
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => {
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        return 0;
    }));
    toast({
        title: "Task Added",
        description: `"${newTaskData.name}" added for ${format(parseISOStrict(newTaskData.date), 'PPP')}.`,
    });
    setIsFormOpen(false);
  }, [setTasks, toast, parseISOStrict]);


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
      const tasksForDate = prevTasks.filter(task => task.date === date);
      const otherTasks = prevTasks.filter(task => task.date !== date);

      const taskMap = new Map(tasksForDate.map(task => [task.id, task]));

      const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];

       const combinedTasks = [...otherTasks, ...reorderedTasksForDate];

       combinedTasks.sort((a, b) => {
           const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
           if (dateComparison !== 0) return dateComparison;

           if (a.date === date && b.date === date) {
               const aIndex = orderedTaskIds.indexOf(a.id);
               const bIndex = orderedTaskIds.indexOf(b.id);
               if (aIndex !== -1 && bIndex !== -1) {
                   return aIndex - bIndex;
               }
           }

            const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
            const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
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
  }, [tasks, completedTaskIds, setCompletedTaskIds, toast]);

   const updateTaskDetails = useCallback((id: string, details: string) => {
     setTasks(prevTasks => {
       return prevTasks.map(task => {
         if (task.id === id) {
           return { ...task, details: details };
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

        <CalendarView
          tasks={tasks}
          deleteTask={deleteTask}
          updateTaskOrder={updateTaskOrder}
          toggleTaskCompletion={toggleTaskCompletion}
          completedTasks={completedTasks}
          updateTaskDetails={updateTaskDetails}
        />

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
