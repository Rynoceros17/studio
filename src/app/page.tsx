"use client";

import type * as React from 'react';
import { useCallback } from 'react';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import type { Task } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const { toast } = useToast();

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: crypto.randomUUID(), // Generate unique ID
    };
    setTasks((prevTasks) => [...prevTasks, newTask].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  }, [setTasks]);

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
    <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-secondary/30">
      <div className="w-full max-w-6xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
          <p className="text-muted-foreground mt-2">Your Weekly Task Planner</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <TaskForm addTask={addTask} />
          </div>
          <div className="md:col-span-2">
            <CalendarView tasks={tasks} deleteTask={deleteTask} />
          </div>
        </div>
      </div>
    </main>
  );
}
