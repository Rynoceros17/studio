
"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Target } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Task, Goal } from '@/lib/types';
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
import { cn, parseISOStrict, calculateGoalProgress } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { LoadingScreen } from '@/components/LoadingScreen';
import useLocalStorage from '@/hooks/useLocalStorage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function DetailedViewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const { user, authLoading } = useAuth();
  const isInitialLoad = useRef(true);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Fetch goals from local storage
  const [goals] = useLocalStorage<Goal[]>('weekwise-goals', []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { toast } = useToast();

  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  // Effect to sync data with Firestore OR load from localStorage
  useEffect(() => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }
    setIsDataLoaded(false);
    isInitialLoad.current = true; // Prevent auto-saving during data load transition

    if (user && db) {
      // User is logged in. Clear local state and set up Firestore listener.
      setTasks([]);
      setCompletedTaskIds([]);
      
      const userDocRef = doc(db, 'users', user.uid);
      firestoreUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const tasksData = userData.tasks || [];
          const completedIdsData = userData.completedTaskIds || [];
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setCompletedTaskIds(Array.isArray(completedIdsData) ? completedIdsData : []);
        } else {
          // New user, Firestore doc will be created on first save. State is already empty.
          setTasks([]);
          setCompletedTaskIds([]);
        }
        isInitialLoad.current = false;
        setIsDataLoaded(true);
      }, (error) => {
        console.error("Error with Firestore listener:", error);
        toast({ title: "Sync Error", description: "Could not sync data in real-time.", variant: "destructive" });
        setIsDataLoaded(true);
      });
    } else if (!authLoading && !user) {
      // No user, load from localStorage.
      try {
        const localTasks = JSON.parse(localStorage.getItem('weekwise-tasks') || '[]');
        const localCompleted = JSON.parse(localStorage.getItem('weekwise-completed-tasks') || '[]');
        setTasks(localTasks);
        setCompletedTaskIds(localCompleted);
      } catch (error) {
        console.warn("Could not parse local storage data.", error);
        setTasks([]);
        setCompletedTaskIds([]);
      }
      isInitialLoad.current = false;
      setIsDataLoaded(true);
    }

    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
      }
    };
  }, [user, authLoading, toast]);


  // Effect to automatically save data
  useEffect(() => {
    // Skip saving on the very first load or while auth is resolving
    if (isInitialLoad.current || authLoading) {
      return;
    }

    const autoSave = async () => {
      if (user && db) { // Logged in: save to Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { 
              tasks: tasks, 
              completedTaskIds: completedTaskIds,
          }, { merge: true });
        } catch (error) {
          console.error("Error auto-saving user data to Firestore:", error);
          toast({ title: "Sync Failed", description: "Your latest changes could not be saved.", variant: "destructive" });
        }
      } else { // Logged out: save to localStorage
         localStorage.setItem('weekwise-tasks', JSON.stringify(tasks));
         localStorage.setItem('weekwise-completed-tasks', JSON.stringify(completedTaskIds));
      }
    };

    // Debounce the save operation to avoid rapid writes.
    const handler = setTimeout(() => {
      autoSave();
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [tasks, completedTaskIds, user, authLoading, toast]);

  const handleCreateTask = (taskData: Partial<Task>) => {
    setPrefilledTaskData(taskData);
    setIsFormOpen(true);
  };

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
        id: crypto.randomUUID(),
        name: newTaskData.name,
        date: newTaskData.date,
        description: newTaskData.description || null,
        recurring: newTaskData.recurring ?? false,
        highPriority: newTaskData.highPriority ?? false,
        color: newTaskData.color || null,
        startTime: newTaskData.startTime || null,
        endTime: newTaskData.endTime || null,
        details: newTaskData.details || null,
        dueDate: newTaskData.dueDate || null,
        exceptions: newTaskData.exceptions || [],
    };

    setTasks(prevTasks => {
        const updatedTasks = [...prevTasks, newTask];
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

    toast({
        title: "Task Added",
        description: `"${newTask.name}" added successfully.`,
    });
    
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

  if (authLoading || !isDataLoaded) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-1/6 border-r bg-secondary/30 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b">
            <Target className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-primary">My Goals</h2>
        </div>
        <ScrollArea className="flex-grow">
            <div className="space-y-3 pr-2">
            {goals.length > 0 ? (
                goals.map((goal) => {
                const progress = calculateGoalProgress(goal);
                return (
                    <Card key={goal.id} className="shadow-sm bg-card">
                        <CardHeader className="p-2 pb-1">
                            <CardTitle className="text-sm font-medium truncate" title={goal.name}>
                                {goal.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </CardContent>
                    </Card>
                );
                })
            ) : (
                <p className="text-sm text-muted-foreground text-center pt-8 px-2">
                    No goals have been set. Visit the goals page to add some!
                </p>
            )}
            </div>
        </ScrollArea>
      </aside>

      <div className="flex flex-col flex-1 w-5/6">
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
      </div>

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

    
