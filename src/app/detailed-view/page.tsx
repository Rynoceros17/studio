
"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import useLocalStorage from '@/hooks/useLocalStorage';
import type { Task } from '@/lib/types';
import { DetailedCalendarView } from '@/components/DetailedCalendarView';
import { TaskForm } from '@/components/TaskForm';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle as AlertTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { cn, parseISOStrict } from '@/lib/utils';

export default function DetailedViewPage() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { toast } = useToast();

  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const handleCreateTask = (taskData: Partial<Task>) => {
    setPrefilledTaskData(taskData);
    setIsFormOpen(true);
  };

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    // Explicitly construct the task object to ensure all fields are handled correctly.
    const newTask: Task = {
        id: crypto.randomUUID(),
        name: newTaskData.name,
        date: newTaskData.date,
        description: newTaskData.description || null,
        recurring: newTaskData.recurring ?? false,
        highPriority: newTaskData.highPriority ?? false,
        color: newTaskData.color || null,
        startTime: newTaskData.startTime,
        endTime: newTaskData.endTime,
        details: newTaskData.details || null,
        dueDate: newTaskData.dueDate || null,
        exceptions: newTaskData.exceptions || [],
    };

    setTasks(prevTasks => {
        const updatedTasks = [...prevTasks, newTask];
        // Sort tasks to ensure a consistent order, which can be important for rendering.
        // This sorting logic is now consistent with the main page.
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

            // Fallback sort to maintain some order, not strictly necessary but good practice.
            const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
            const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
            if (originalAIndex === -1 && originalBIndex !== -1) return 1;
            if (originalAIndex !== -1 && originalBIndex === -1) return -1;
            if (originalAIndex === -1 && originalBIndex === -1) return 0;
            return originalAIndex - originalBIndex;
        });
        return updatedTasks;
    });

    // Provide user feedback.
    toast({
        title: "Task Added",
        description: `"${newTask.name}" added successfully.`,
    });
    
    // Close the form and clear pre-filled data.
    setIsFormOpen(false);
    setPrefilledTaskData(null);
  }, [setTasks, toast]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
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

                  if (a.highPriority !== b.highPriority) {
                      return a.highPriority ? -1 : 1;
                  }
                  return 0;
              });
          }
          return updatedTasks;
      });
      toast({
          title: "Task Updated",
          description: "Your task has been successfully updated.",
      });
  }, [setTasks, toast]);

  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => !completionKey.startsWith(`${id}_`)));
      if (taskToDelete) {
          toast({
              title: "Task Deleted",
              description: `"${taskToDelete.name}" and all its future occurrences have been removed.`,
              variant: "destructive",
          });
      }
      setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);

  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr });
      } else {
          deleteAllOccurrences(task.id);
      }
  }, [deleteAllOccurrences]);

  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
      const taskToModify = tasks.find(task => task.id === taskId);
      setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === taskId) {
              const updatedExceptions = [...(task.exceptions || []), dateStr];
              return { ...task, exceptions: updatedExceptions };
          }
          return task;
      }));
      setCompletedTaskIds(prevIds => prevIds.filter(completionKey => completionKey !== `${taskId}_${dateStr}`));
      if (taskToModify) {
          toast({
              title: "Task Instance Skipped",
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr)!, 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast]);

  const toggleTaskCompletion = useCallback((taskId: string, dateStr: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const completionKey = `${taskId}_${dateStr}`;
      setCompletedTaskIds((prevIds) => {
          const currentCompletedKeys = new Set(prevIds);
          if (currentCompletedKeys.has(completionKey)) {
              currentCompletedKeys.delete(completionKey);
              toast({
                  title: "Task Incomplete",
                  description: `"${task.name}" on ${format(parseISOStrict(dateStr)!, 'PPP')} marked as incomplete.`,
              });
          } else {
              currentCompletedKeys.add(completionKey);
              toast({
                  title: "Task Completed!",
                  description: `"${task.name}" on ${format(parseISOStrict(dateStr)!, 'PPP')} marked as complete.`,
              });
          }
          return Array.from(currentCompletedKeys);
      });
  }, [tasks, setCompletedTaskIds, toast]);

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
                <p className="text-sm text-muted-foreground">Drag on the calendar to create a new task. Click tasks to edit.</p>
            </div>
        </div>
      </header>

      <main className="flex-grow overflow-auto">
        <DetailedCalendarView 
            tasks={isClient ? tasks : []} 
            onCreateTask={handleCreateTask}
            onEditTask={(task) => setEditingTask(task)}
            onDeleteTask={requestDeleteTask}
            onToggleComplete={toggleTaskCompletion}
            completedTasks={completedTasks}
            updateTask={updateTask}
        />
      </main>

      {/* Add New Task Dialog */}
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
      
      {/* Edit Task Dialog */}
      <EditTaskDialog
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        updateTask={updateTask}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertTitle>Delete Recurring Task</AlertTitle>
                    <AlertDialogDescription>
                        Do you want to delete only this occurrence of "{deleteConfirmation?.task?.name}" on {deleteConfirmation?.dateStr ? format(parseISOStrict(deleteConfirmation.dateStr)!, 'PPP') : ''}, or all future occurrences?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => deleteRecurringInstance(deleteConfirmation!.task.id, deleteConfirmation!.dateStr)}
                         className={cn("text-foreground")}
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
    </div>
  );

    