
"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, Sparkles, Loader2, SendHorizonal } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from 'date-fns';
import { cn, parseISOStrict, calculateGoalProgress } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { LoadingScreen } from '@/components/LoadingScreen';
import useLocalStorage from '@/hooks/useLocalStorage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parseNaturalLanguageTask, type SingleTaskOutput } from '@/ai/flows/parse-natural-language-task-flow';
import { colorTagToHexMap } from '@/lib/color-map';


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
  
  // Sheet states
  const [isGoalsSheetOpen, setIsGoalsSheetOpen] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);

  // AI Task state
  const [chatInput, setChatInput] = useState('');
  const [isParsingTask, setIsParsingTask] = useState(false);


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

    if (!isParsingTask) {
        toast({
            title: "Task Added",
            description: `"${newTask.name}" added successfully.`,
        });
    }
    
    setIsFormOpen(false);
    setPrefilledTaskData(null);
  }, [setTasks, toast, isParsingTask]);

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

  const handleSendChatMessage = async () => {
    if (chatInput.trim() && !isParsingTask) {
      setIsParsingTask(true);
      try {
        const parsedTasksArray: SingleTaskOutput[] = await parseNaturalLanguageTask({ query: chatInput.trim() });

        if (parsedTasksArray && parsedTasksArray.length > 0) {
            let tasksAddedCount = 0;
            parsedTasksArray.forEach(parsedTask => {
                const taskDate = parseISOStrict(parsedTask.date);
                if (!taskDate || !isValid(taskDate)) {
                    console.warn("AI returned an invalid date for a task, skipping:", parsedTask);
                    return;
                }

                const finalColor = parsedTask.color && colorTagToHexMap[parsedTask.color]
                  ? colorTagToHexMap[parsedTask.color]
                  : colorTagToHexMap['#col1']; // Default to color 1 (white/purple)

                addTask({
                    name: parsedTask.name || "Unnamed Task",
                    date: parsedTask.date,
                    description: parsedTask.description || null,
                    recurring: parsedTask.recurring ?? false,
                    highPriority: parsedTask.highPriority ?? false,
                    color: finalColor,
                    startTime: parsedTask.startTime || null,
                    endTime: parsedTask.endTime || null,
                });
                tasksAddedCount++;
            });

            if (tasksAddedCount > 0) {
                toast({
                    title: tasksAddedCount === 1 ? "Task Added by AI" : `${tasksAddedCount} Tasks Added by AI`,
                    description: tasksAddedCount === 1
                        ? `Task "${parsedTasksArray.find(pt => pt.name)?.name || 'Unnamed Task'}" added to your calendar.`
                        : `${tasksAddedCount} tasks parsed and added to your calendar.`,
                });
            } else {
                 toast({
                    title: "AI Parsing Issue",
                    description: "The AI processed your request, but no valid tasks could be added. Please check your input or try rephrasing.",
                    variant: "destructive",
                });
            }
            setChatInput('');
            setIsAiSheetOpen(false); // Close sheet on success
        } else {
             toast({
                title: "No Tasks Detected",
                description: "The AI couldn't identify any tasks in your message. Try being more specific.",
                variant: "destructive",
            });
        }
      } catch (error: any) {
        console.error("Error parsing task with AI:", error);
        toast({
          title: "AI Processing Error",
          description: error.message || "Could not process your request. Please try again or add manually.",
          variant: "destructive",
        });
      } finally {
        setIsParsingTask(false);
      }
    }
  };

  const handleChatKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  };


  if (authLoading || !isDataLoaded) {
    return <LoadingScreen />;
  }

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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsAiSheetOpen(true)} className="text-primary border-primary hover:bg-primary/10">
              <Sparkles className="mr-2 h-4 w-4" />
              AI Manager
            </Button>
            <Button variant="outline" onClick={() => setIsGoalsSheetOpen(true)} className="text-primary border-primary hover:bg-primary/10">
              <Target className="mr-2 h-4 w-4" />
              View Goals
            </Button>
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

      {/* AI Manager Sheet */}
      <Sheet open={isAiSheetOpen} onOpenChange={setIsAiSheetOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b shrink-0">
                <SheetTitle className="text-primary flex items-center gap-2">
                   <Sparkles className="h-6 w-6" />
                   AI Manager
                </SheetTitle>
            </SheetHeader>
            <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                    Describe your week and let the AI assistant organize it for you. You can list multiple tasks, appointments, and recurring events.
                </p>
                <Card className="shadow-sm">
                    <CardContent className="p-3 flex flex-col space-y-2">
                        <Textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Describe your week and let the AI organize it! e.g., 'Team meeting Monday 10am, Dentist appointment Wednesday 3pm, Weekly gym session Friday at 6pm #col3'"
                            className="min-h-[120px] text-sm"
                            onKeyPress={handleChatKeyPress}
                            disabled={isParsingTask}
                            maxLength={500}
                        />
                        <Button onClick={handleSendChatMessage} className="w-full" disabled={isParsingTask || !chatInput.trim()}>
                            {isParsingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="mr-2 h-4 w-4" />}
                            {isParsingTask ? "Parsing..." : "Add to Calendar"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </SheetContent>
      </Sheet>

      {/* Goals Sheet */}
      <Sheet open={isGoalsSheetOpen} onOpenChange={setIsGoalsSheetOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b shrink-0">
                <SheetTitle className="text-primary flex items-center gap-2">
                   <Target className="h-6 w-6" />
                   My Goals
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-grow">
                <div className="space-y-3 p-4">
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
        </SheetContent>
      </Sheet>

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
}
