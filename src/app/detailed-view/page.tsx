
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useLocalStorage from '@/hooks/useLocalStorage';
import type { Task } from '@/lib/types';
import { DetailedCalendarView } from '@/components/DetailedCalendarView';
import { TaskForm } from '@/components/TaskForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

export default function DetailedViewPage() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const { toast } = useToast();

  const handleCreateTask = (taskData: Partial<Task>) => {
    setPrefilledTaskData(taskData);
    setIsFormOpen(true);
  };

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
        id: crypto.randomUUID(),
        ...newTaskData,
        description: newTaskData.description || null,
        recurring: newTaskData.recurring ?? false,
        highPriority: newTaskData.highPriority ?? false,
        color: newTaskData.color || null,
        details: newTaskData.details || null,
        dueDate: newTaskData.dueDate || null,
        exceptions: newTaskData.exceptions || [],
    };
    setTasks(prevTasks => [...prevTasks, newTask]);
    toast({
        title: "Task Added",
        description: `"${newTask.name}" added successfully.`,
    });
    setIsFormOpen(false);
    setPrefilledTaskData(null);
  }, [setTasks, toast]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-4">
            <Link href="/" passHref legacyBehavior>
                <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to Main Calendar</span>
                </Button>
            </Link>
            <div>
                <h1 className="text-2xl font-semibold text-primary">Detailed Calendar View</h1>
                <p className="text-sm text-muted-foreground">Drag on the calendar to create a new task.</p>
            </div>
        </div>
      </header>

      <main className="flex-grow overflow-auto">
        <DetailedCalendarView tasks={tasks} onCreateTask={handleCreateTask} />
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-primary">Create New Task</DialogTitle>
            </DialogHeader>
            <TaskForm
                addTask={addTask}
                onTaskAdded={() => { setIsFormOpen(false); setPrefilledTaskData(null); }}
                initialData={prefilledTaskData}
            />
        </DialogContent>
      </Dialog>
    </div>
  );
}
