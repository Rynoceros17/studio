
"use client";

import type * as React from 'react';
import { useCallback, useState } from 'react';
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
import { format } from 'date-fns';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: crypto.randomUUID(), // Generate unique ID
    };
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    toast({
        title: "Task Added",
        description: `"${newTaskData.name}" added for ${format(parseISOStrict(newTaskData.date), 'PPP')}.`,
    });
    setIsFormOpen(false); // Close dialog on successful add
  }, [setTasks, toast]);

  // Helper function to parse ISO string safely
  const parseISOStrict = (dateString: string): Date => {
      const date = new Date(dateString + 'T00:00:00'); // Ensure parsing as local date
      if (isNaN(date.getTime())) {
          console.error("Invalid date string received:", dateString);
          return new Date(); // Fallback to today if invalid
      }
      return date;
  }


  const deleteTask = useCallback((id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
     if (taskToDelete) {
        toast({
          title: "Task Deleted",
          description: `"${taskToDelete.name}" has been removed.`,
          variant: "destructive",
        });
     }
  }, [setTasks, tasks, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-secondary/30 relative">
      <div className="w-full max-w-7xl space-y-8"> {/* Increased max-width */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
          <p className="text-muted-foreground mt-2">Your Weekly Task Planner</p>
        </header>

        {/* Calendar View takes full width */}
        <CalendarView tasks={tasks} deleteTask={deleteTask} />

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
