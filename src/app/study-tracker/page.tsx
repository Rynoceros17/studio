// src/app/study-tracker/page.tsx
'use client';

import type * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"; // Added TooltipContent import
import { ArrowLeft, Play, Pause, StopCircle, Trash2, Target, Save, Loader2, Plus, Tag, Trash } from 'lucide-react'; // Added Plus, Tag, Trash
import useLocalStorage from '@/hooks/use-local-storage';
import { formatDuration } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { startOfDay, startOfWeek } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Import Select components
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StudySession {
  id: string;
  label: string;
  duration: number; // in seconds
  timestamp: number; // Date.now() when saved
  category?: string; // Optional category
}

interface StudyGoal {
    hours: number;
    minutes: number;
}

export default function StudyTrackerPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [sessions, setSessions] = useLocalStorage<StudySession[]>('weekwise-study-sessions', []);
  const [currentLabel, setCurrentLabel] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false); // State to track client-side rendering

  // State for Goals
  const [weeklyGoal, setWeeklyGoal] = useLocalStorage<StudyGoal>('weekwise-weekly-goal', { hours: 0, minutes: 0 });
  const [dailyGoal, setDailyGoal] = useLocalStorage<StudyGoal>('weekwise-daily-goal', { hours: 0, minutes: 0 });
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [tempWeeklyGoal, setTempWeeklyGoal] = useState<StudyGoal>(weeklyGoal);
  const [tempDailyGoal, setTempDailyGoal] = useState<StudyGoal>(dailyGoal);

  // State for Categories
  const [categories, setCategories] = useLocalStorage<string[]>('weekwise-study-categories', ['General']); // Start with a default category
  const [currentCategory, setCurrentCategory] = useState<string>('General'); // Default category
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // Set isClient to true on component mount
  useEffect(() => {
    setIsClient(true);
    // Ensure currentCategory is valid if categories load from storage
    if (!categories.includes(currentCategory) && categories.length > 0) {
        setCurrentCategory(categories[0]);
    } else if (categories.length === 0) {
        // If storage was empty, re-initialize
        setCategories(['General']);
        setCurrentCategory('General');
    }
  }, []);

  // Reset category if it becomes invalid after categories change
  useEffect(() => {
      if (isClient && !categories.includes(currentCategory) && categories.length > 0) {
          setCurrentCategory(categories[0]);
      } else if (isClient && categories.length === 0) {
          setCategories(['General']); // Ensure 'General' exists if list becomes empty
          setCurrentCategory('General');
      }
  }, [categories, currentCategory, isClient, setCategories]);


  // Sync temp goals when actual goals change (e.g., loaded from storage)
  useEffect(() => {
    setTempWeeklyGoal(weeklyGoal);
    setTempDailyGoal(dailyGoal);
  }, [weeklyGoal, dailyGoal]);


  // --- Helper Functions ---
  const getTotalSeconds = (goal: StudyGoal): number => {
      const h = goal.hours ?? 0; // Default to 0 if undefined/null
      const m = goal.minutes ?? 0;
      return (h * 3600) + (m * 60);
  };

  const calculateTodaySeconds = useCallback((sessions: StudySession[]): number => {
      const todayStart = startOfDay(new Date());
      return sessions
          .filter(s => s.timestamp >= todayStart.getTime())
          .reduce((sum, s) => sum + s.duration, 0);
  }, []);

  const calculateWeekSeconds = useCallback((sessions: StudySession[]): number => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Assuming Monday start
      return sessions
          .filter(s => s.timestamp >= weekStart.getTime())
          .reduce((sum, s) => sum + s.duration, 0);
  }, []);

  // --- Progress Calculation ---
  const { dailyProgress, weeklyProgress, todaySecondsStudied, weekSecondsStudied } = useMemo(() => {
    const todaySeconds = calculateTodaySeconds(sessions);
    const weekSeconds = calculateWeekSeconds(sessions);
    const dailyGoalSeconds = getTotalSeconds(dailyGoal);
    const weeklyGoalSeconds = getTotalSeconds(weeklyGoal);

    const dailyProg = dailyGoalSeconds > 0 ? Math.min(100, Math.round((todaySeconds / dailyGoalSeconds) * 100)) : 0;
    const weeklyProg = weeklyGoalSeconds > 0 ? Math.min(100, Math.round((weekSeconds / weeklyGoalSeconds) * 100)) : 0;

    return {
        dailyProgress: dailyProg,
        weeklyProgress: weeklyProg,
        todaySecondsStudied: todaySeconds,
        weekSecondsStudied: weekSeconds,
    };
  }, [sessions, dailyGoal, weeklyGoal, calculateTodaySeconds, calculateWeekSeconds]);

  // --- Calculate Time per Category ---
  const timePerCategory = useMemo(() => {
      const categoryTotals: Record<string, number> = {};
      sessions.forEach(session => {
          const categoryKey = session.category || 'General'; // Default to 'General' if undefined
          categoryTotals[categoryKey] = (categoryTotals[categoryKey] || 0) + session.duration;
      });
      // Sort categories alphabetically for consistent display
      return Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);


  // --- Timer Logic ---
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedTime * 1000; // Adjust start time based on elapsed time
      intervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { // Cleanup function
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, elapsedTime]); // Rerun effect if isRunning or elapsedTime changes

  const startTimer = () => {
    if (!isRunning) {
      setIsRunning(true);
    }
  };

  const pauseTimer = () => {
    if (isRunning) {
      setIsRunning(false);
    }
  };

  const stopAndSaveSession = useCallback(() => {
    setIsRunning(false); // Stop the timer
    if (elapsedTime === 0) {
      toast({ title: "No Time Recorded", description: "Start the timer to record a session.", variant: "destructive" });
      return;
    }
    if (!currentLabel.trim()) {
      toast({ title: "Label Required", description: "Please enter a label for the study session.", variant: "destructive" });
      return;
    }
    const newSession: StudySession = {
        id: crypto.randomUUID(),
        label: currentLabel.trim(),
        duration: elapsedTime,
        timestamp: Date.now(),
        category: currentCategory // Save the selected category
    };
    setSessions(prevSessions => [newSession, ...prevSessions]);
    toast({ title: "Session Saved", description: `"${newSession.label}" (${formatDuration(newSession.duration)}) [${newSession.category}] saved.` });
    setElapsedTime(0);
    setCurrentLabel('');
    // Optionally reset category or keep it for the next session? Let's keep it.
  }, [elapsedTime, currentLabel, currentCategory, setSessions, toast]);

  const deleteSession = (id: string) => {
    const sessionToDelete = sessions.find(s => s.id === id);
    setSessions(prevSessions => prevSessions.filter(session => session.id !== id));
     if (sessionToDelete) {
        toast({ title: "Session Deleted", description: `Session "${sessionToDelete.label}" removed.`, variant: "destructive" });
     }
  };

  // --- Goal Setting Logic ---
  const handleGoalInputChange = (type: 'daily' | 'weekly', unit: 'hours' | 'minutes', value: string) => {
      const numericValue = Math.max(0, parseInt(value) || 0); // Ensure non-negative integer
      const validValue = unit === 'minutes' ? Math.min(59, numericValue) : numericValue; // Cap minutes at 59

      if (type === 'daily') {
          setTempDailyGoal(prev => ({ ...prev, [unit]: validValue }));
      } else {
          setTempWeeklyGoal(prev => ({ ...prev, [unit]: validValue }));
      }
  };

  const saveGoals = () => {
      setDailyGoal(tempDailyGoal);
      setWeeklyGoal(tempWeeklyGoal);
      setIsGoalDialogOpen(false);
      toast({ title: "Goals Updated", description: "Your study goals have been saved." });
  };

   // --- Category Management Logic ---
    const addNewCategory = () => {
        const trimmedName = newCategoryName.trim();
        if (trimmedName && !categories.includes(trimmedName)) {
            const updatedCategories = [...categories, trimmedName].sort(); // Add and sort
            setCategories(updatedCategories);
            setCurrentCategory(trimmedName); // Select the newly added category
            setNewCategoryName('');
            setIsAddingCategory(false);
            toast({ title: "Category Added", description: `Category "${trimmedName}" added.` });
        } else if (!trimmedName) {
            toast({ title: "Invalid Name", description: "Category name cannot be empty.", variant: "destructive" });
        } else {
            toast({ title: "Duplicate Category", description: `Category "${trimmedName}" already exists.`, variant: "destructive" });
            setNewCategoryName(''); // Clear input on duplicate
            setIsAddingCategory(false); // Hide input
        }
    };

    const handleNewCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            addNewCategory();
        } else if (e.key === 'Escape') {
            setNewCategoryName('');
            setIsAddingCategory(false);
        }
    };

     const deleteCategory = (categoryToDelete: string) => {
        if (categoryToDelete === 'General') {
            toast({ title: "Cannot Delete", description: "The 'General' category cannot be deleted.", variant: "destructive" });
            return;
        }
        // Remove the category
        setCategories(prev => prev.filter(cat => cat !== categoryToDelete));
        // Update sessions using this category to 'General'
        setSessions(prev => prev.map(session => session.category === categoryToDelete ? { ...session, category: 'General' } : session));
        // If the deleted category was selected, switch to 'General'
        if (currentCategory === categoryToDelete) {
            setCurrentCategory('General');
        }
        toast({ title: "Category Deleted", description: `Category "${categoryToDelete}" deleted. Associated sessions moved to 'General'.`, variant: "destructive" });
    };

    // Focus input when add category button is clicked
    useEffect(() => {
        if (isAddingCategory && newCategoryInputRef.current) {
            newCategoryInputRef.current.focus();
        }
    }, [isAddingCategory]);


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg overflow-hidden mb-8 bg-card border-border">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4 flex-grow"> {/* Make this section grow */}
            <Link href="/" passHref legacyBehavior>
              <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Calendar</span>
              </Button>
            </Link>
            <div className="flex-grow min-w-0"> {/* Allow title/desc to take space and truncate */}
              <CardTitle className="text-2xl text-primary truncate">Study Tracker</CardTitle>
              <CardDescription className="text-sm text-muted-foreground truncate">
                Track your study sessions and monitor progress towards your goals.
              </CardDescription>
            </div>
          </div>
           {/* Goal Setting Trigger with Tooltip */}
           <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0 ml-4">
                                    <Target className="h-5 w-5" />
                                    <span className="sr-only">Set Study Goals</span> {/* Keep sr-only for accessibility */}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="text-primary">Set Study Goals</DialogTitle>
                                    <DialogDescription>
                                        Define your daily and weekly study targets in hours and minutes.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    {/* Daily Goal Inputs */}
                                    <div className="space-y-2">
                                        <Label className="font-medium">Daily Goal</Label>
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <Label htmlFor="daily-hours" className="text-xs text-muted-foreground">Hours</Label>
                                                <Input
                                                    id="daily-hours"
                                                    type="number"
                                                    min="0"
                                                    value={tempDailyGoal.hours}
                                                    onChange={(e) => handleGoalInputChange('daily', 'hours', e.target.value)}
                                                    className="h-9"
                                                 />
                                            </div>
                                             <div>
                                                 <Label htmlFor="daily-minutes" className="text-xs text-muted-foreground">Minutes</Label>
                                                 <Input
                                                    id="daily-minutes"
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={tempDailyGoal.minutes}
                                                    onChange={(e) => handleGoalInputChange('daily', 'minutes', e.target.value)}
                                                    className="h-9"
                                                 />
                                            </div>
                                        </div>
                                    </div>
                                     {/* Weekly Goal Inputs */}
                                     <div className="space-y-2">
                                        <Label className="font-medium">Weekly Goal</Label>
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                           <div>
                                                <Label htmlFor="weekly-hours" className="text-xs text-muted-foreground">Hours</Label>
                                                <Input
                                                    id="weekly-hours"
                                                    type="number"
                                                    min="0"
                                                    value={tempWeeklyGoal.hours}
                                                    onChange={(e) => handleGoalInputChange('weekly', 'hours', e.target.value)}
                                                    className="h-9"
                                                 />
                                           </div>
                                            <div>
                                                <Label htmlFor="weekly-minutes" className="text-xs text-muted-foreground">Minutes</Label>
                                                <Input
                                                    id="weekly-minutes"
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={tempWeeklyGoal.minutes}
                                                    onChange={(e) => handleGoalInputChange('weekly', 'minutes', e.target.value)}
                                                    className="h-9"
                                                 />
                                            </div>
                                        </div>
                                     </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={saveGoals} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                        <Save className="mr-2 h-4 w-4" /> Save Goals
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Set Study Goals</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </CardHeader>

        {/* Main Content Area */}
        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Changed to 3 columns */}

          {/* Timer & Controls Section (Column 1) */}
          <div className="flex flex-col space-y-6 lg:col-span-1">
            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center space-y-4 p-6 border rounded-lg bg-secondary/30">
              <div className="text-center">
                <p className="text-6xl font-bold font-mono text-primary">
                  {isClient ? formatDuration(elapsedTime) : '00:00'} {/* Show 00:00 during SSR */}
                </p>
                <p className="text-sm text-muted-foreground">Elapsed Time</p>
              </div>
              {/* Session Label Input */}
              <div className="w-full max-w-xs space-y-1">
                 <Label htmlFor="session-label" className="text-xs font-medium text-muted-foreground">
                   Session Label
                 </Label>
                 <Input id="session-label" value={currentLabel} onChange={(e) => setCurrentLabel(e.target.value)} placeholder="e.g., Math Homework" className="h-9" disabled={isRunning}/>
              </div>
               {/* Category Selector */}
                <div className="w-full max-w-xs space-y-1">
                   <Label htmlFor="session-category" className="text-xs font-medium text-muted-foreground">
                       Category
                   </Label>
                    <div className="flex items-center space-x-2">
                        <Select value={currentCategory} onValueChange={setCurrentCategory} disabled={isRunning}>
                            <SelectTrigger id="session-category" className="h-9 flex-grow">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isRunning}>
                                    <Tag className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle className="text-primary">Manage Categories</DialogTitle>
                                    <DialogDescription>Add or remove study categories.</DialogDescription>
                                </DialogHeader>
                                 <ScrollArea className="max-h-[300px] pr-4">
                                    <div className="space-y-2 py-2">
                                        {categories.map(cat => (
                                            <div key={cat} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                                                <span className="text-sm">{cat}</span>
                                                {cat !== 'General' && (
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10">
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
                                                         </AlertDialogTrigger>
                                                          <AlertDialogContent>
                                                              <AlertDialogHeader>
                                                                  <AlertDialogTitle>Delete "{cat}"?</AlertDialogTitle>
                                                                  <AlertDialogDescription>
                                                                      Are you sure you want to delete this category? Any sessions using it will be moved to 'General'. This cannot be undone.
                                                                  </AlertDialogDescription>
                                                              </AlertDialogHeader>
                                                              <AlertDialogFooter>
                                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                  <AlertDialogAction onClick={() => deleteCategory(cat)} className={buttonVariants({ variant: "destructive" })}>
                                                                      Delete Category
                                                                  </AlertDialogAction>
                                                              </AlertDialogFooter>
                                                          </AlertDialogContent>
                                                     </AlertDialog>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                 </ScrollArea>
                                 <div className="flex space-x-2 pt-4 border-t">
                                     <Input
                                         ref={newCategoryInputRef}
                                         value={newCategoryName}
                                         onChange={(e) => setNewCategoryName(e.target.value)}
                                         placeholder="New category name"
                                         className="h-9 flex-grow"
                                         onKeyDown={handleNewCategoryKeyDown}
                                     />
                                     <Button onClick={addNewCategory} size="sm" className="h-9">
                                         <Plus className="mr-1 h-4 w-4" /> Add
                                     </Button>
                                 </div>
                             </DialogContent>
                         </Dialog>

                    </div>
                </div>
              {/* Timer Controls */}
              <div className="flex space-x-4 pt-2">
                {!isRunning ? ( <Button onClick={startTimer} size="lg" className="w-28 bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-2 h-5 w-5" /> Start </Button> )
                 : ( <Button onClick={pauseTimer} size="lg" variant="outline" className="w-28 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"> <Pause className="mr-2 h-5 w-5" /> Pause </Button> )}
                <Button onClick={stopAndSaveSession} size="lg" variant="destructive" className="w-28" disabled={elapsedTime === 0 && !isRunning}> <StopCircle className="mr-2 h-5 w-5" /> Stop </Button>
              </div>
            </div>

          </div>

          {/* Stats & Sessions Section (Column 2 & 3) */}
           <div className="lg:col-span-2 flex flex-col space-y-6">
               {/* Progress & Category Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Progress Bars */}
                   <div className="space-y-4 p-6 border rounded-lg bg-secondary/30">
                         <h3 className="text-lg font-semibold text-primary mb-4">Goal Progress</h3>
                         {/* Daily Progress */}
                         <div className="space-y-2">
                             <div className="flex justify-between items-baseline">
                                <Label htmlFor="daily-progress" className="text-sm font-medium text-muted-foreground">Daily Goal</Label>
                                 {isClient ? (
                                   <span className="text-xs text-muted-foreground">
                                     {formatDuration(todaySecondsStudied)} / {formatDuration(getTotalSeconds(dailyGoal))}
                                   </span>
                                 ) : (
                                   <Skeleton className="h-4 w-20" /> // Skeleton for times
                                 )}
                             </div>
                             {isClient ? (
                                 <Progress value={dailyProgress} id="daily-progress" aria-label={`Daily study progress ${dailyProgress}%`} />
                             ) : (
                                 <Skeleton className="h-2 w-full" /> // Skeleton for progress bar
                             )}
                         </div>
                         {/* Weekly Progress */}
                         <div className="space-y-2">
                             <div className="flex justify-between items-baseline">
                                 <Label htmlFor="weekly-progress" className="text-sm font-medium text-muted-foreground">Weekly Goal</Label>
                                 {isClient ? (
                                   <span className="text-xs text-muted-foreground">
                                     {formatDuration(weekSecondsStudied)} / {formatDuration(getTotalSeconds(weeklyGoal))}
                                   </span>
                                 ) : (
                                    <Skeleton className="h-4 w-20" />
                                 )}
                             </div>
                             {isClient ? (
                                 <Progress value={weeklyProgress} id="weekly-progress" aria-label={`Weekly study progress ${weeklyProgress}%`} />
                             ) : (
                                  <Skeleton className="h-2 w-full" />
                             )}
                         </div>
                          {/* Show goal setting prompt only on client when no goals are set */}
                          {isClient && (getTotalSeconds(dailyGoal) === 0 && getTotalSeconds(weeklyGoal) === 0) && (
                             <p className="text-sm text-muted-foreground text-center pt-2">Set your goals using the <Target className="inline h-4 w-4 mx-1"/> icon above.</p>
                         )}
                    </div>
                    {/* Category Time Breakdown */}
                    <div className="space-y-2 p-6 border rounded-lg bg-secondary/30">
                       <h3 className="text-lg font-semibold text-primary mb-4">Time by Category</h3>
                        <ScrollArea className="h-[150px]"> {/* Limit height */}
                           {isClient ? (
                               timePerCategory.length > 0 ? (
                                   timePerCategory.map(([category, totalSeconds]) => (
                                       <div key={category} className="flex justify-between items-center text-sm mb-1">
                                           <span className="text-muted-foreground truncate mr-2" title={category}>{category}</span>
                                           <span className="font-medium text-foreground">{formatDuration(totalSeconds)}</span>
                                       </div>
                                   ))
                               ) : (
                                   <p className="text-sm text-muted-foreground text-center pt-4">No categorized sessions yet.</p>
                               )
                           ) : (
                               <>
                                <Skeleton className="h-5 w-full mb-1" />
                                <Skeleton className="h-5 w-full mb-1" />
                                <Skeleton className="h-5 w-full mb-1" />
                               </>
                           )}
                        </ScrollArea>
                    </div>
                </div>

               {/* Sessions List */}
               <div className="flex flex-col flex-grow">
                    <h3 className="text-lg font-semibold mb-4 text-primary">Recorded Sessions</h3>
                    <ScrollArea className="flex-grow border rounded-lg min-h-[200px] max-h-[400px]"> {/* Adjust height */}
                    <div className="p-4 space-y-3">
                        {!isClient ? (
                            // Show skeletons while waiting for client-side rendering
                            <>
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </>
                        ) : sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">No study sessions recorded yet.</p>
                        ) : (
                        sessions.map(session => (
                            <Card key={session.id} className="bg-background shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-3 flex items-center justify-between space-x-4">
                                <div className="flex-grow min-w-0">
                                <p className="text-sm font-medium truncate text-foreground" title={session.label}>{session.label}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDuration(session.duration)} - <span title={new Date(session.timestamp).toLocaleString()}>{new Date(session.timestamp).toLocaleDateString()}</span>
                                     {session.category && session.category !== 'General' && (
                                          <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                <Tag className="mr-1 h-3 w-3" /> {session.category}
                                            </span>
                                     )}
                                </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete session</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription> This action cannot be undone. This will permanently delete the study session labeled "{session.label}". </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteSession(session.id)} className={cn(buttonVariants({variant: "destructive"}))}> Delete </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                            </Card>
                        ))
                        )}
                    </div>
                    </ScrollArea>
                </div>
            </div>


        </CardContent>
      </Card>
    </div>
  );
}
