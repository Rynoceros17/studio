
"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, Sparkles, Loader2, SendHorizonal, Save, Download, Trash2, Undo2, Redo2, Bot } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Task, Goal, WeekPreset, SingleTaskOutput } from '@/lib/types';
import { DetailedCalendarView } from '@/components/DetailedCalendarView';
import { TaskForm } from '@/components/TaskForm';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { format, isValid, isSameDay, addDays, startOfWeek, endOfWeek, isWithinInterval, startOfDay } from 'date-fns';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';
import { chatWithAssistant } from '@/ai/flows/chat-assistant-flow';
import { colorTagToHexMap } from '@/lib/color-map';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: React.ReactNode;
}

export default function DetailedViewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const { user, authLoading } = useAuth();
  const isInitialLoad = useRef(true);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- History State Management ---
  const history = useRef<{ tasks: Task[]; completedTaskIds: string[] }[]>([]);
  const historyIndex = useRef(-1);
  const isNavigatingHistory = useRef(false);
  const [, forceUpdate] = useState(0); // To re-render and update button disabled states

  const canUndo = historyIndex.current > 0;
  const canRedo = historyIndex.current < history.current.length - 1;

  // Effect to record changes to history
  useEffect(() => {
    if (isNavigatingHistory.current) {
        isNavigatingHistory.current = false;
        return;
    }

    if (isInitialLoad.current) return;

    const lastStateInHistory = history.current[historyIndex.current];
    if (
        lastStateInHistory &&
        JSON.stringify(lastStateInHistory.tasks) === JSON.stringify(tasks) &&
        JSON.stringify(lastStateInHistory.completedTaskIds) === JSON.stringify(completedTaskIds)
    ) {
        return;
    }

    const newHistory = history.current.slice(0, historyIndex.current + 1);
    newHistory.push({ tasks, completedTaskIds });
    history.current = newHistory;
    historyIndex.current = newHistory.length - 1;

    forceUpdate(n => n + 1); // Re-render to update button states
  }, [tasks, completedTaskIds]);

  const undo = () => {
    if (canUndo) {
        isNavigatingHistory.current = true;
        historyIndex.current--;
        const prevState = history.current[historyIndex.current];
        setTasks(prevState.tasks);
        setCompletedTaskIds(prevState.completedTaskIds);
        forceUpdate(n => n + 1);
    }
  };

  const redo = () => {
    if (canRedo) {
        isNavigatingHistory.current = true;
        historyIndex.current++;
        const nextState = history.current[historyIndex.current];
        setTasks(nextState.tasks);
        setCompletedTaskIds(nextState.completedTaskIds);
        forceUpdate(n => n + 1);
    }
  };
  // --- End History State Management ---

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ task: Task; dateStr: string } | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Sheet states
  const [isGoalsSheetOpen, setIsGoalsSheetOpen] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingAiTasks, setPendingAiTasks] = useState<SingleTaskOutput[]>([]);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);


  // Preset state
  const [presets, setPresets] = useLocalStorage<WeekPreset[]>('weekwise-presets', []);
  const [isSavePresetDialogOpen, setIsSavePresetDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [isImportPresetDialogOpen, setIsImportPresetDialogOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [currentDisplayDate, setCurrentDisplayDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Fetch goals from local storage
  const [goals] = useLocalStorage<Goal[]>('weekwise-goals', []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTo({
        top: chatScrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);

  useEffect(() => {
      if (!isClient) return;
      const checkSize = () => {
          const isPortrait = window.innerWidth < window.innerHeight && window.innerWidth < 768;
          const newMode = isPortrait ? 'day' : 'week';
          if (viewMode !== newMode) {
            setViewMode(newMode);
            if (newMode === 'day') {
                setCurrentDisplayDate(startOfDay(new Date()));
            } else {
                setCurrentDisplayDate(prev => startOfWeek(prev, { weekStartsOn: 1 }));
            }
          }
      };
      checkSize();
      window.addEventListener('resize', checkSize);
      return () => window.removeEventListener('resize', checkSize);
  }, [isClient, viewMode]);

  const { toast } = useToast();

  const completedTasks = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  // Effect to sync data with Firestore OR load from localStorage
  useEffect(() => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }
    setIsDataLoaded(false);
    isInitialLoad.current = true;

    if (user && db) {
      const userDocRef = doc(db, 'users', user.uid);
      firestoreUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
        const data = docSnap.data();
        const tasksData = data?.tasks || [];
        const completedIdsData = data?.completedTaskIds || [];
        const presetsData = data?.presets || [];

        if (isInitialLoad.current) {
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setCompletedTaskIds(Array.isArray(completedIdsData) ? completedIdsData : []);
          setPresets(Array.isArray(presetsData) ? presetsData : []);
          history.current = [{ tasks: tasksData, completedTaskIds: completedIdsData }];
          historyIndex.current = 0;
          forceUpdate(n => n + 1);
          isInitialLoad.current = false;
        } else {
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setCompletedTaskIds(Array.isArray(completedIdsData) ? completedIdsData : []);
          setPresets(Array.isArray(presetsData) ? presetsData : []);
        }
        setIsDataLoaded(true);
      }, (error) => {
        console.error("Error with Firestore listener:", error);
        toast({ title: "Sync Error", description: "Could not sync data in real-time.", variant: "destructive" });
        setIsDataLoaded(true);
      });
    } else if (!authLoading && !user) {
      let localTasks: Task[] = [];
      let localCompleted: string[] = [];
      let localPresets: WeekPreset[] = [];
      try {
        localTasks = JSON.parse(localStorage.getItem('weekwise-tasks') || '[]');
        localCompleted = JSON.parse(localStorage.getItem('weekwise-completed-tasks') || '[]');
        localPresets = JSON.parse(localStorage.getItem('weekwise-presets') || '[]');
      } catch (error) {
        console.warn("Could not parse local storage data.", error);
      }
      setTasks(localTasks);
      setCompletedTaskIds(localCompleted);
      setPresets(localPresets);
      
      history.current = [{ tasks: localTasks, completedTaskIds: localCompleted }];
      historyIndex.current = 0;
      forceUpdate(n => n + 1);
      
      isInitialLoad.current = false;
      setIsDataLoaded(true);
    }

    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, toast]);


  // Effect to automatically save data
  useEffect(() => {
    // Skip saving on the very first load or while auth is resolving
    if (isInitialLoad.current || authLoading || isNavigatingHistory.current) {
      return;
    }

    const autoSave = async () => {
      if (user && db) { // Logged in: save to Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { 
              tasks: tasks, 
              completedTaskIds: completedTaskIds,
              presets: presets,
          }, { merge: true });
        } catch (error) {
          console.error("Error auto-saving user data to Firestore:", error);
          toast({ title: "Sync Failed", description: "Your latest changes could not be saved.", variant: "destructive" });
        }
      } else { // Logged out: save to localStorage
         localStorage.setItem('weekwise-tasks', JSON.stringify(tasks));
         localStorage.setItem('weekwise-completed-tasks', JSON.stringify(completedTaskIds));
         localStorage.setItem('weekwise-presets', JSON.stringify(presets));
      }
    };

    // Debounce the save operation to avoid rapid writes.
    const handler = setTimeout(() => {
      autoSave();
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [tasks, completedTaskIds, presets, user, authLoading, toast]);

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

    if (!isAiProcessing) {
        toast({
            title: "Task Added",
            description: `"${newTask.name}" added successfully.`,
        });
    }
    
    setIsFormOpen(false);
    setPrefilledTaskData(null);
  }, [setTasks, toast, isAiProcessing]);

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

    const handleConfirmAiTasks = useCallback(() => {
        let tasksAddedCount = 0;
        pendingAiTasks.forEach(parsedTask => {
            const taskDate = parseISOStrict(parsedTask.date);
            if (!taskDate || !isValid(taskDate)) {
                console.warn("AI returned an invalid date for a task, skipping:", parsedTask);
                return;
            }

            const finalColor = parsedTask.color && colorTagToHexMap[parsedTask.color]
              ? colorTagToHexMap[parsedTask.color]
              : colorTagToHexMap['#col1'];

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
        
        const confirmMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'ai',
            content: `Great! I've added ${tasksAddedCount} task(s) to your calendar.`
        };
        setChatHistory(prev => [...prev.filter(m => m.role !== 'ai' || !m.content?.toString().includes('Confirm')), confirmMessage]);
        setPendingAiTasks([]);
    }, [pendingAiTasks, addTask]);

    const handleCancelAiTasks = useCallback(async () => {
        setIsAiProcessing(true);
        const userMessageContent = (chatHistory.findLast(m => m.role === 'user')?.content as string) || '';
        const rejectedTasksSummary = pendingAiTasks.map(t =>
            `- ${t.name} on ${format(parseISOStrict(t.date)!, 'MMM d')}${t.startTime ? ` at ${t.startTime}` : ''}`
        ).join('\n');
        
        setChatHistory(prev => prev.filter(m => m.role !== 'ai' || !m.content?.toString().includes('Confirm')));
        setPendingAiTasks([]);

        try {
            const response = await chatWithAssistant({
                message: 'User cancelled task creation.',
                cancellationContext: {
                    originalQuery: userMessageContent,
                    rejectedTasksSummary: rejectedTasksSummary
                }
            });

            const aiResponse: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'ai',
                content: response.reply,
            };
            setChatHistory(prev => [...prev, aiResponse]);
        } catch (error: any) {
            console.error("Error getting AI cancellation response:", error);
            const errorResponse: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'ai',
                content: "Okay, I've discarded those tasks. What would you like to do next?"
            };
            setChatHistory(prev => [...prev, errorResponse]);
        } finally {
            setIsAiProcessing(false);
        }
    }, [chatHistory, pendingAiTasks]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isAiProcessing) return;

    const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: chatInput.trim(),
    };
    setChatHistory(prev => [...prev, userMessage]);
    setIsAiProcessing(true);
    setChatInput('');

    if (pendingAiTasks.length > 0) {
        setPendingAiTasks([]);
    }

    try {
        const parsedTasks = await parseNaturalLanguageTask({ query: userMessage.content as string });

        if (parsedTasks && parsedTasks.length > 0) {
            setPendingAiTasks(parsedTasks);
            const summary = parsedTasks.map(t => {
                let details = [];
                if (t.startTime) {
                    let time = t.startTime;
                    if (t.endTime) {
                        time += ` - ${t.endTime}`;
                    }
                    details.push(time);
                }
                if (t.recurring) details.push('repeats weekly');
                if (t.highPriority) details.push('high priority');
                if (t.color) details.push(`color: ${t.color}`);

                const detailsString = details.length > 0 ? ` (${details.join(', ')})` : '';
                return `- ${t.name} on ${format(parseISOStrict(t.date)!, 'MMM d')}${detailsString}`;
            }).join('\n');


            const aiResponse: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'ai',
                content: (
                    <div className="space-y-2">
                        <p>OK! I've prepared the following task(s) for you:</p>
                        <pre className="whitespace-pre-wrap font-sans text-sm bg-muted p-2 rounded-md border">{summary}</pre>
                        <p>Should I add them to your calendar?</p>
                        <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={handleConfirmAiTasks}>Confirm</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelAiTasks}>Cancel</Button>
                        </div>
                    </div>
                ),
            };
            setChatHistory(prev => [...prev, aiResponse]);
        } else {
            const response = await chatWithAssistant({ message: userMessage.content as string });
            const aiResponse: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'ai',
                content: response.reply,
            };
            setChatHistory(prev => [...prev, aiResponse]);
        }
    } catch (error: any) {
        console.error("Error in AI chat:", error);
        const errorResponse: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'ai',
            content: `Sorry, an error occurred: ${error.message || 'Please try again.'}`
        };
        setChatHistory(prev => [...prev, errorResponse]);
    } finally {
        setIsAiProcessing(false);
    }
  };

  const handleChatKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  };

  const handleSavePreset = () => {
    if (!savePresetName.trim()) {
      toast({ title: "Preset Name Required", description: "Please enter a name for your preset.", variant: "destructive" });
      return;
    }

    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const tasksForPreset: WeekPreset['tasks'] = [];

    daysOfWeek.forEach((day, dayOfWeekIndex) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const currentDayOfWeekFns = day.getDay();
      tasks.forEach(task => {
        if (!task.date) return;
        const taskDate = parseISOStrict(task.date);
        if (!taskDate) return;

        let isTaskForThisDay = false;
        if (task.recurring) {
          if (!task.exceptions?.includes(dateStr)) {
            const taskStartDayOfWeekFns = taskDate.getDay();
            if (taskStartDayOfWeekFns === currentDayOfWeekFns && day >= taskDate) {
              isTaskForThisDay = true;
            }
          }
        } else {
          if (isSameDay(taskDate, day)) {
            isTaskForThisDay = true;
          }
        }
        if (isTaskForThisDay) {
          const { id, date, ...restOfTask } = task;
          tasksForPreset.push({ ...restOfTask, recurring: false, dayOfWeek: dayOfWeekIndex });
        }
      });
    });

    if (tasksForPreset.length === 0) {
      toast({ title: "No Tasks to Save", description: "The current week has no tasks to save as a preset.", variant: "destructive" });
      setIsSavePresetDialogOpen(false);
      setSavePresetName('');
      return;
    }

    const newPreset: WeekPreset = { id: crypto.randomUUID(), name: savePresetName.trim(), tasks: tasksForPreset };
    setPresets(prev => [...prev, newPreset]);
    toast({ title: "Preset Saved", description: `"${newPreset.name}" has been saved.` });
    setIsSavePresetDialogOpen(false);
    setSavePresetName('');
  };

  const handleImportPreset = (preset: WeekPreset) => {
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    const tasksToAdd = preset.tasks.map(presetTask => ({
      ...presetTask,
      date: format(addDays(weekStart, presetTask.dayOfWeek), 'yyyy-MM-dd'),
      recurring: false,
    }));
    const newTasks: Task[] = tasksToAdd.map(taskData => ({
      ...taskData,
      id: crypto.randomUUID(),
      details: taskData.details || null,
      dueDate: taskData.dueDate || null,
      exceptions: [],
    }));
    setTasks(prevTasks => {
      const updatedTasks = [...prevTasks, ...newTasks];
      updatedTasks.sort((a, b) => {
        const dateA = parseISOStrict(a.date);
        const dateB = parseISOStrict(b.date);
        if (!dateA || !dateB) return 0;
        const dateComparison = dateA.getTime() - dateB.getTime();
        if (dateComparison !== 0) return dateComparison;
        if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
        return 0;
      });
      return updatedTasks;
    });
    toast({ title: "Preset Imported", description: `Tasks from "${preset.name}" have been added to the current week.` });
    setIsImportPresetDialogOpen(false);
  };

  const handleDeletePreset = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    toast({ title: "Preset Deleted", variant: "destructive" });
  };


  if (authLoading || !isDataLoaded) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-4">
              <Link href="/" passHref legacyBehavior>
                  <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground h-10 w-10">
                      <ArrowLeft className="h-5 w-5" />
                      <span className="sr-only">Back to Main Calendar</span>
                  </Button>
              </Link>
               {viewMode === 'week' && (
                    <h1 className="text-xl font-semibold text-primary hidden md:block">Detailed Calendar</h1>
                )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={undo} disabled={!canUndo} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
                <Undo2 className="h-4 w-4" />
                <span className="sr-only">Undo</span>
            </Button>
            <Button variant="outline" size="icon" onClick={redo} disabled={!canRedo} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
                <Redo2 className="h-4 w-4" />
                <span className="sr-only">Redo</span>
            </Button>
            <Button variant="outline" onClick={() => setIsSavePresetDialogOpen(true)} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" onClick={() => setIsImportPresetDialogOpen(true)} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
              <Download className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsAiSheetOpen(true)} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="sr-only">AI Manager</span>
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsGoalsSheetOpen(true)} className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
              <Target className="h-4 w-4" />
              <span className="sr-only">View Goals</span>
            </Button>
          </div>
      </header>

      <main className="flex-grow overflow-auto">
          <DetailedCalendarView 
              currentWeekStart={currentDisplayDate}
              onWeekChange={setCurrentDisplayDate}
              tasks={isClient ? tasks : []}
              pendingAiTasks={isClient ? pendingAiTasks : []}
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
        <SheetContent side="right" className="w-[300px] sm:w-[450px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b shrink-0">
                <SheetTitle className="text-primary flex items-center gap-2">
                   <Sparkles className="h-6 w-6" />
                   AI Assistant
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-grow" ref={chatScrollAreaRef}>
                <div className="p-4 space-y-4">
                    {chatHistory.map((msg) => (
                        <div key={msg.id} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                            {msg.role === 'ai' && (
                                <Avatar className="h-8 w-8 border">
                                    <AvatarFallback><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={cn(
                                "max-w-[85%] rounded-lg p-3 text-sm",
                                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}>
                                {typeof msg.content === 'string' ? <p>{msg.content}</p> : msg.content}
                            </div>
                        </div>
                    ))}
                    {isAiProcessing && (
                         <div className="flex items-start gap-3 justify-start">
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                            </Avatar>
                             <div className="bg-muted rounded-lg p-3 text-sm">
                                 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                             </div>
                         </div>
                    )}
                </div>
            </ScrollArea>
             <div className="p-4 border-t bg-background">
                <div className="relative">
                    <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe your week... e.g., 'Team meeting Monday 10am'"
                        className="pr-16 min-h-[60px]"
                        onKeyPress={handleChatKeyPress}
                        disabled={isAiProcessing}
                        maxLength={500}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="absolute right-2 bottom-2 h-10 w-10"
                        onClick={handleSendChatMessage}
                        disabled={isAiProcessing || !chatInput.trim()}
                    >
                        <SendHorizonal className="h-5 w-5" />
                        <span className="sr-only">Send</span>
                    </Button>
                </div>
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
                    <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
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

        {/* Save Preset Dialog */}
        <Dialog open={isSavePresetDialogOpen} onOpenChange={setIsSavePresetDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save Week Preset</DialogTitle>
                    <DialogDescription>
                    Save the current week's task layout as a reusable preset.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    <Label htmlFor="preset-name">Preset Name</Label>
                    <Input
                    id="preset-name"
                    value={savePresetName}
                    onChange={(e) => setSavePresetName(e.target.value)}
                    placeholder="e.g., My Ideal Study Week"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSavePresetDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSavePreset}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Import Preset Dialog */}
        <Dialog open={isImportPresetDialogOpen} onOpenChange={setIsImportPresetDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import a Preset</DialogTitle>
                    <DialogDescription>
                    Apply a saved preset to the currently viewed week. This will add tasks and will not remove existing ones.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6">
                    <div className="py-4 px-6 space-y-2">
                    {presets.length > 0 ? (
                        presets.map(preset => (
                        <Card key={preset.id}>
                            <CardContent className="p-3 flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{preset.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" onClick={() => handleImportPreset(preset)}>Apply</Button>
                                <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleDeletePreset(preset.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            </CardContent>
                        </Card>
                        ))
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-8">No presets saved yet.</p>
                    )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    </div>
  );
}
