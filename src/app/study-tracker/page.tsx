// src/app/study-tracker/page.tsx
'use client';

import type * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'; // Import Dialog components
import { ArrowLeft, Play, Pause, StopCircle, Trash2, Target, Save } from 'lucide-react'; // Added Target, Save
import useLocalStorage from '@/hooks/use-local-storage';
import { formatDuration } from '@/lib/utils'; // Import the new formatting function
import { useToast } from '@/hooks/use-toast';
import { startOfDay, startOfWeek } from 'date-fns'; // Import date-fns functions
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
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';

interface StudySession {
  id: string;
  label: string;
  duration: number; // in seconds
  timestamp: number; // Date.now() when saved
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

  // State for Goals
  const [weeklyGoal, setWeeklyGoal] = useLocalStorage<StudyGoal>('weekwise-weekly-goal', { hours: 0, minutes: 0 });
  const [dailyGoal, setDailyGoal] = useLocalStorage<StudyGoal>('weekwise-daily-goal', { hours: 0, minutes: 0 });
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [tempWeeklyGoal, setTempWeeklyGoal] = useState<StudyGoal>(weeklyGoal);
  const [tempDailyGoal, setTempDailyGoal] = useState<StudyGoal>(dailyGoal);

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
    const newSession: StudySession = { id: crypto.randomUUID(), label: currentLabel.trim(), duration: elapsedTime, timestamp: Date.now() };
    setSessions(prevSessions => [newSession, ...prevSessions]);
    toast({ title: "Session Saved", description: `"${newSession.label}" (${formatDuration(newSession.duration)}) saved.` });
    setElapsedTime(0);
    setCurrentLabel('');
  }, [elapsedTime, currentLabel, setSessions, toast]);

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
          {/* Goal Setting Trigger */}
          <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0 ml-4">
                  <Target className="h-5 w-5" />
                  <span className="sr-only">Set Study Goals</span>
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
        </CardHeader>

        {/* Main Content Area */}
        <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8"> {/* Changed to lg for breakpoint */}

          {/* Timer & Progress Section */}
          <div className="flex flex-col space-y-6">
            {/* Timer */}
            <div className="flex flex-col items-center justify-center space-y-6 p-6 border rounded-lg bg-secondary/30">
              <div className="text-center">
                <p className="text-7xl font-bold font-mono text-primary">
                  {formatDuration(elapsedTime)}
                </p>
                <p className="text-sm text-muted-foreground">Elapsed Time</p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                 <Label htmlFor="session-label" className="text-center block text-sm font-medium text-muted-foreground">
                   Current Session Label
                 </Label>
                 <Input id="session-label" value={currentLabel} onChange={(e) => setCurrentLabel(e.target.value)} placeholder="e.g., Math Homework" className="text-center h-9" disabled={isRunning}/>
              </div>
              <div className="flex space-x-4">
                {!isRunning ? ( <Button onClick={startTimer} size="lg" className="w-28 bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-2 h-5 w-5" /> Start </Button> )
                 : ( <Button onClick={pauseTimer} size="lg" variant="outline" className="w-28 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"> <Pause className="mr-2 h-5 w-5" /> Pause </Button> )}
                <Button onClick={stopAndSaveSession} size="lg" variant="destructive" className="w-28" disabled={elapsedTime === 0 && !isRunning}> <StopCircle className="mr-2 h-5 w-5" /> Stop </Button>
              </div>
            </div>
             {/* Progress Bars */}
            <div className="space-y-4 p-6 border rounded-lg bg-secondary/30">
                 <h3 className="text-lg font-semibold text-primary mb-4">Goal Progress</h3>
                 {/* Daily Progress */}
                 <div className="space-y-2">
                     <div className="flex justify-between items-baseline">
                        <Label htmlFor="daily-progress" className="text-sm font-medium text-muted-foreground">Daily Goal</Label>
                        <span className="text-xs text-muted-foreground">
                            {formatDuration(todaySecondsStudied)} / {formatDuration(getTotalSeconds(dailyGoal))}
                        </span>
                     </div>
                     <Progress value={dailyProgress} id="daily-progress" aria-label={`Daily study progress ${dailyProgress}%`} />
                 </div>
                 {/* Weekly Progress */}
                 <div className="space-y-2">
                     <div className="flex justify-between items-baseline">
                         <Label htmlFor="weekly-progress" className="text-sm font-medium text-muted-foreground">Weekly Goal</Label>
                         <span className="text-xs text-muted-foreground">
                            {formatDuration(weekSecondsStudied)} / {formatDuration(getTotalSeconds(weeklyGoal))}
                        </span>
                     </div>
                     <Progress value={weeklyProgress} id="weekly-progress" aria-label={`Weekly study progress ${weeklyProgress}%`} />
                 </div>
                  {(getTotalSeconds(dailyGoal) === 0 && getTotalSeconds(weeklyGoal) === 0) && (
                     <p className="text-sm text-muted-foreground text-center pt-2">Set your goals using the <Target className="inline h-4 w-4 mx-1"/> icon above.</p>
                 )}
            </div>
          </div>


          {/* Sessions List Section */}
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-primary">Recorded Sessions</h3>
            <ScrollArea className="flex-grow border rounded-lg h-[400px] lg:h-auto lg:min-h-[calc(100%-3rem)]"> {/* Adjust height */}
              <div className="p-4 space-y-3">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No study sessions recorded yet.</p>
                ) : (
                  sessions.map(session => (
                    <Card key={session.id} className="bg-background shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3 flex items-center justify-between space-x-4">
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium truncate text-foreground" title={session.label}>{session.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(session.duration)} - <span title={new Date(session.timestamp).toLocaleString()}>{new Date(session.timestamp).toLocaleDateString()}</span>
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

        </CardContent>
      </Card>
    </div>
  );
}
```/>
  </change>
  <change>
    <file>src/components/ui/progress.tsx</file>
    <description>Update Progress component styles to be more flexible and use primary color for indicator.</description>
    <content><![CDATA[
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary", // Changed height to h-2
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all duration-500 ease-out" // Use primary color, added transition
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

```