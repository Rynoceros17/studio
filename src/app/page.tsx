
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import type { Task, Subtask } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { GoalsSheet } from '@/components/GoalsSheet';
import { NaturalLanguageTaskDialog } from '@/components/NaturalLanguageTaskDialog';
import { DueDateTaskDialog } from '@/components/DueDateTaskDialog';
import { TopTaskBar } from '@/components/TopTaskBar'; // New Import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, Wand2, CalendarPlus } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';


export default function Home() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);
  const [completedTaskIds, setCompletedTaskIds] = useLocalStorage<string[]>('weekwise-completed-tasks', []);
  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  const completedCount = useMemo(() => {
      return completedTaskIds.length;
  }, [completedTaskIds]);

  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);
  const [isGoalsSheetOpen, setIsGoalsSheetOpen] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [isNaturalLanguageTaskDialogOpen, setIsNaturalLanguageTaskDialogOpen] = useState(false);
  const [isDueDateTaskDialogOpen, setIsDueDateTaskDialogOpen] = useState(false);
  const [isTopTaskBarExpanded, setIsTopTaskBarExpanded] = useState(false); // New state for top bar

  useEffect(() => {
    setIsClient(true);
    const initialX = typeof window !== 'undefined' ? window.innerWidth - 300 - 24 : 0;
    const initialY = 24;
    setTimerPosition({ x: initialX, y: initialY });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleTimerDragEnd = (event: DragEndEvent) => {
    if (event.active.id === 'pomodoro-timer') {
      setTimerPosition((prev) => ({
        x: prev.x + event.delta.x,
        y: prev.y + event.delta.y,
      }));
    }
  };

  const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
      if (!dateString) return null;
      const datePart = dateString.split('T')[0];
      const date = parseISO(datePart + 'T00:00:00');
      if (isNaN(date.getTime())) {
          console.error("Invalid date string received:", dateString);
          return null;
      }
      return date;
  }, []);

  const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
     const newTask: Task = {
         ...newTaskData,
         id: crypto.randomUUID(),
         files: newTaskData.files ?? [],
         details: newTaskData.details ?? '',
         dueDate: newTaskData.dueDate,
         recurring: newTaskData.recurring ?? false,
         highPriority: newTaskData.highPriority ?? false,
         exceptions: [],
         color: newTaskData.color,
     };
     setTasks((prevTasks) => {
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
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
             if (originalAIndex === -1 && originalBIndex === -1) return 0;
             if (originalAIndex === -1) return 1;
             if (originalBIndex === -1) return -1;
             return originalAIndex - originalBIndex;
         });
         return updatedTasks;
     });
     const taskDate = parseISOStrict(newTaskData.date);
     toast({
         title: "Task Added",
         description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
     });
     setIsFormOpen(false);
     setIsNaturalLanguageTaskDialogOpen(false);
     setIsDueDateTaskDialogOpen(false);
  }, [setTasks, toast, parseISOStrict]);

  const deleteAllOccurrences = useCallback((id: string) => {
      const taskToDelete = tasks.find(task => task.id === id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
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
              description: `"${taskToModify.name}" for ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} will be skipped.`,
          });
      }
      setDeleteConfirmation(null);
  }, [tasks, setTasks, setCompletedTaskIds, toast, parseISOStrict]);

  const requestDeleteTask = useCallback((task: Task, dateStr: string) => {
      if (task.recurring) {
          setDeleteConfirmation({ task, dateStr });
      } else {
          deleteAllOccurrences(task.id);
      }
  }, [deleteAllOccurrences]);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'files' | 'details' | 'dueDate' | 'exceptions'>>) => {
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
          description: "Core task details have been updated.",
      });
  }, [setTasks, toast, parseISOStrict]);

  const updateTaskOrder = useCallback((date: string, orderedTaskIds: string[]) => {
    setTasks(prevTasks => {
        const tasksForDate = prevTasks.filter(task => {
            const taskDateObj = parseISOStrict(task.date);
             const currentDay = parseISOStrict(date);
             if (!taskDateObj || !currentDay) return false;
             if (task.exceptions?.includes(date)) return false;
             if (task.recurring) {
                 const taskStartDayOfWeek = taskDateObj.getDay();
                 const currentDayOfWeek = currentDay.getDay();
                 return taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj;
             } else {
                  return format(taskDateObj, 'yyyy-MM-dd') === date;
             }
        });
        const otherTasks = prevTasks.filter(task => {
           const taskDateObj = parseISOStrict(task.date);
           if (!taskDateObj) return true;
           const currentDay = parseISOStrict(date);
           if (!currentDay) return true;
           if (task.exceptions?.includes(date)) return true;
           if (task.recurring) {
               const taskStartDayOfWeek = taskDateObj.getDay();
               const currentDayOfWeek = currentDay.getDay();
               return !(taskStartDayOfWeek === currentDayOfWeek && currentDay >= taskDateObj);
           } else {
               return format(taskDateObj, 'yyyy-MM-dd') !== date;
           }
        });
        const taskMap = new Map(tasksForDate.map(task => [task.id, task]));
        const reorderedTasksForDate = orderedTaskIds.map(id => taskMap.get(id)).filter(Boolean) as Task[];
        const combinedTasks = [...otherTasks, ...reorderedTasksForDate];
         combinedTasks.sort((a, b) => {
             const dateA = parseISOStrict(a.date);
             const dateB = parseISOStrict(b.date);
             if (!dateA && !dateB) return 0;
             if (!dateA) return 1;
             if (!dateB) return -1;
             const dateComparison = dateA.getTime() - dateB.getTime();
             if (dateComparison !== 0) return dateComparison;
             const aIsForTargetDate = tasksForDate.some(t => t.id === a.id);
             const bIsForTargetDate = tasksForDate.some(t => t.id === b.id);
             if (aIsForTargetDate && bIsForTargetDate) {
                 const aIndex = orderedTaskIds.indexOf(a.id);
                 const bIndex = orderedTaskIds.indexOf(b.id);
                 if (aIndex !== -1 && bIndex !== -1) {
                     return aIndex - bIndex;
                 }
             }
              if (a.highPriority !== b.highPriority) {
                  return a.highPriority ? -1 : 1;
              }
             const originalAIndex = prevTasks.findIndex(t => t.id === a.id);
             const originalBIndex = prevTasks.findIndex(t => t.id === b.id);
              if (originalAIndex === -1 && originalBIndex === -1) return 0;
              if (originalAIndex === -1) return 1;
              if (originalBIndex === -1) return -1;
             return originalAIndex - originalBIndex;
        });
        return combinedTasks;
    });
  }, [setTasks, parseISOStrict]);

  const toggleTaskCompletion = useCallback((taskId: string, dateStr: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const completionKey = `${taskId}_${dateStr}`;
      const currentCompletedKeys = new Set(completedTaskIds);
      if (currentCompletedKeys.has(completionKey)) {
          currentCompletedKeys.delete(completionKey);
          toast({
              title: "Task Incomplete",
              description: `"${task.name}" on ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} marked as incomplete.`,
          });
      } else {
          currentCompletedKeys.add(completionKey);
          toast({
              title: "Task Completed!",
              description: `"${task.name}" on ${format(parseISOStrict(dateStr) ?? new Date(), 'PPP')} marked as complete.`,
          });
      }
      setCompletedTaskIds(Array.from(currentCompletedKeys));
  }, [tasks, completedTaskIds, setCompletedTaskIds, toast, parseISOStrict]);

  const updateTaskDetails = useCallback((id: string, updates: Partial<Pick<Task, 'details' | 'dueDate' | 'files'>>) => {
   setTasks(prevTasks => {
      let needsResort = false;
     const updatedTasks = prevTasks.map(task => {
       if (task.id === id) {
           const updatedTask = { ...task, ...updates };
            if (updates.dueDate && updates.dueDate !== task.dueDate) {
                needsResort = true; // Due date change might affect sorting if bar uses it
            }
         return updatedTask;
       }
       return task;
     });
      if (needsResort) { // Placeholder for more complex sorting if top bar sorting relies on this
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
     title: "Task Details Updated",
     description: "Additional details have been updated.",
   });
  }, [setTasks, toast, parseISOStrict]);

  const ongoingProjects = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (task.recurring || !task.dueDate || !task.date) return false;
      try {
        const startDate = parseISOStrict(task.date);
        const dueDate = parseISOStrict(task.dueDate);
        return startDate && dueDate && dueDate > startDate;
      } catch (e) {
        return false;
      }
    }).sort((a, b) => {
        const dateA = parseISOStrict(a.date) ?? new Date(0);
        const dateB = parseISOStrict(b.date) ?? new Date(0);
        return dateA.getTime() - dateB.getTime();
    });
  }, [tasks, parseISOStrict]);

  const tasksWithUpcomingDueDates = useMemo(() => {
    if (!isClient || !tasks) return [];
    const today = startOfDay(new Date());
    return tasks
      .filter(task => {
        if (!task.dueDate) return false;
        try {
          const dueDate = parseISOStrict(task.dueDate);
          return dueDate && dueDate >= today;
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => {
        // Ensure dueDate exists before parsing for sort
        const dueDateA = a.dueDate ? parseISOStrict(a.dueDate) : null;
        const dueDateB = b.dueDate ? parseISOStrict(b.dueDate) : null;
        if (!dueDateA && !dueDateB) return 0;
        if (!dueDateA) return 1;
        if (!dueDateB) return -1;
        return dueDateA.getTime() - dueDateB.getTime();
      });
  }, [tasks, isClient, parseISOStrict]);


  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <main className="flex min-h-screen flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 relative overflow-hidden">
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
            aria-label="Add task with due date"
            onClick={() => setIsDueDateTaskDialogOpen(true)}
          >
            <CalendarPlus className="h-6 w-6 text-primary" />
          </Button>
        </div>

        <div className="w-full max-w-7xl space-y-4">
          {isClient && (
            <TopTaskBar
              tasks={tasksWithUpcomingDueDates}
              isExpanded={isTopTaskBarExpanded}
              onToggle={() => setIsTopTaskBarExpanded(!isTopTaskBarExpanded)}
            />
          )}

          <header className="text-center py-2 relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">WeekWise</h1>
          </header>

          {isClient && (
              <CalendarView
                tasks={tasks}
                requestDeleteTask={requestDeleteTask}
                updateTaskOrder={updateTaskOrder}
                toggleTaskCompletion={toggleTaskCompletion}
                completedTasks={completedTasks}
                updateTaskDetails={updateTaskDetails}
                updateTask={updateTask}
                completedCount={completedCount}
              />
          )}

          {isClient && ongoingProjects.length > 0 && (
            <Card className="mt-4 shadow-lg bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-primary flex items-center">
                  <LayoutDashboard className="mr-2 h-5 w-5" /> Ongoing Projects
                </CardTitle>
                <CardDescription>Tasks spanning multiple days.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[200px] pr-2">
                  <div className="space-y-3">
                    {ongoingProjects.map(project => (
                      <Card key={project.id} className="p-3 bg-secondary/50 border-border shadow-sm">
                        <h4 className="font-semibold text-sm text-secondary-foreground truncate" title={project.name}>{project.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISOStrict(project.date)!, 'MMM d')} - {format(parseISOStrict(project.dueDate!)!, 'MMM d, yyyy')}
                        </p>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={project.description}>
                            {project.description}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

           <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col space-y-2 items-end">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                    aria-label="Add task with natural language"
                    onClick={() => setIsNaturalLanguageTaskDialogOpen(true)}
                >
                    <Wand2 className="h-6 w-6 text-primary" />
                </Button>

                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-12 w-12 rounded-full shadow-lg"
                      aria-label="Add new task"
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                       <DialogTitle className="text-primary">Add New Task</DialogTitle>
                    </DialogHeader>
                    <TaskForm
                       addTask={addTask}
                       onTaskAdded={() => setIsFormOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
           </div>

         <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50 flex flex-col space-y-2">
             <Link href="/dashboard" passHref legacyBehavior>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                    aria-label="Go to dashboard"
                    asChild
                >
                    <a>
                      <LayoutDashboard className="h-6 w-6 text-primary" />
                    </a>
                </Button>
             </Link>
             <Link href="/study-tracker" passHref legacyBehavior>
                 <Button
                     variant="outline"
                     size="icon"
                     className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                     aria-label="Go to study tracker"
                     asChild
                 >
                     <a>
                         <BookOpen className="h-6 w-6 text-primary" />
                     </a>
                 </Button>
             </Link>
             <Sheet open={isGoalsSheetOpen} onOpenChange={setIsGoalsSheetOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                        aria-label="View goals"
                    >
                        <Target className="h-6 w-6 text-primary" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                     <SheetHeader className="p-4 border-b shrink-0">
                         <SheetTitle className="text-primary">Goals</SheetTitle>
                     </SheetHeader>
                     <GoalsSheet />
                 </SheetContent>
             </Sheet>
             <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                 <SheetTrigger asChild>
                     <Button
                         variant="outline"
                         size="icon"
                         className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                         aria-label="View bookmarks"
                     >
                         <BookmarkIcon className="h-6 w-6 text-primary" />
                     </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                     <SheetHeader className="p-4 border-b shrink-0">
                         <SheetTitle className="text-primary">Bookmarks</SheetTitle>
                     </SheetHeader>
                     <BookmarkListSheet />
                 </SheetContent>
             </Sheet>
             <Button
                 variant="outline"
                 size="icon"
                 className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                 aria-label="Toggle Pomodoro Timer"
                 onClick={() => setIsTimerVisible(!isTimerVisible)}
             >
                 <TimerIcon className="h-6 w-6 text-primary" />
             </Button>
             <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                 <SheetTrigger asChild>
                     <Button
                         variant="outline"
                         size="icon"
                         className="h-12 w-12 rounded-full shadow-lg bg-card hover:bg-card/90 border-primary"
                         aria-label="View scratchpad"
                     >
                         <List className="h-6 w-6 text-primary" />
                     </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                     <SheetHeader className="p-4 border-b shrink-0">
                         <SheetTitle className="text-primary">Scratchpad</SheetTitle>
                     </SheetHeader>
                     <TaskListSheet />
                 </SheetContent>
             </Sheet>
         </div>
        </div>

        {isClient && isTimerVisible && (
          <PomodoroTimer
            position={timerPosition}
            onClose={() => setIsTimerVisible(false)}
          />
        )}

        <NaturalLanguageTaskDialog
            isOpen={isNaturalLanguageTaskDialogOpen}
            onClose={() => setIsNaturalLanguageTaskDialogOpen(false)}
            onTaskAdd={addTask}
        />

        <DueDateTaskDialog
            isOpen={isDueDateTaskDialogOpen}
            onClose={() => setIsDueDateTaskDialogOpen(false)}
            addTask={addTask}
        />

        <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
                    <AlertDialogDescription>
                        Do you want to delete only this occurrence of "{deleteConfirmation?.task?.name}" on {deleteConfirmation?.dateStr ? format(parseISOStrict(deleteConfirmation.dateStr) ?? new Date(), 'PPP') : ''}, or all future occurrences?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => deleteRecurringInstance(deleteConfirmation!.task.id, deleteConfirmation!.dateStr)}
                         className={cn(buttonVariants({ variant: "outline" }), "text-foreground")}
                    >
                        Delete This Occurrence Only
                    </AlertDialogAction>
                    <AlertDialogAction
                        onClick={() => deleteAllOccurrences(deleteConfirmation!.task.id)}
                        className={buttonVariants({ variant: "destructive" })}
                    >
                        Delete All Occurrences
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </DndContext>
  );
}
