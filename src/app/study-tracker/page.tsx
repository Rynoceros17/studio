// src/app/study-tracker/page.tsx
'use client';

import type * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Play, Pause, StopCircle, Trash2 } from 'lucide-react';
import useLocalStorage from '@/hooks/use-local-storage';
import { formatDuration } from '@/lib/utils'; // Import the new formatting function
import { useToast } from '@/hooks/use-toast';
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

interface StudySession {
  id: string;
  label: string;
  duration: number; // in seconds
  timestamp: number; // Date.now() when saved
}

export default function StudyTrackerPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [sessions, setSessions] = useLocalStorage<StudySession[]>('weekwise-study-sessions', []);
  const [currentLabel, setCurrentLabel] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const { toast } = useToast();

  // Timer Logic
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

    // Cleanup function
    return () => {
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
      toast({
        title: "No Time Recorded",
        description: "Start the timer to record a session.",
        variant: "destructive",
      });
      return;
    }

    if (!currentLabel.trim()) {
      toast({
        title: "Label Required",
        description: "Please enter a label for the study session.",
        variant: "destructive",
      });
      return; // Don't save if label is empty
    }

    const newSession: StudySession = {
      id: crypto.randomUUID(),
      label: currentLabel.trim(),
      duration: elapsedTime,
      timestamp: Date.now(),
    };

    setSessions(prevSessions => [newSession, ...prevSessions]); // Add to the beginning of the list
    toast({
      title: "Session Saved",
      description: `"${newSession.label}" (${formatDuration(newSession.duration)}) saved.`,
    });

    // Reset for the next session
    setElapsedTime(0);
    setCurrentLabel('');

  }, [elapsedTime, currentLabel, setSessions, toast]);


  const deleteSession = (id: string) => {
    const sessionToDelete = sessions.find(s => s.id === id);
    setSessions(prevSessions => prevSessions.filter(session => session.id !== id));
     if (sessionToDelete) {
        toast({
            title: "Session Deleted",
            description: `Session "${sessionToDelete.label}" removed.`,
            variant: "destructive",
        });
     }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg overflow-hidden mb-8 bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" passHref legacyBehavior>
              <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Calendar</span>
              </Button>
            </Link>
            <div className="flex-grow">
              <CardTitle className="text-2xl text-primary">Study Tracker</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Track your study sessions efficiently.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Timer Section */}
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
               <Input
                 id="session-label"
                 value={currentLabel}
                 onChange={(e) => setCurrentLabel(e.target.value)}
                 placeholder="e.g., Math Homework"
                 className="text-center h-9"
                 disabled={isRunning} // Disable input while timer is running
               />
            </div>

            <div className="flex space-x-4">
              {!isRunning ? (
                <Button onClick={startTimer} size="lg" className="w-28 bg-green-600 hover:bg-green-700 text-white">
                  <Play className="mr-2 h-5 w-5" /> Start
                </Button>
              ) : (
                <Button onClick={pauseTimer} size="lg" variant="outline" className="w-28 border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">
                  <Pause className="mr-2 h-5 w-5" /> Pause
                </Button>
              )}
              <Button
                onClick={stopAndSaveSession}
                size="lg"
                variant="destructive"
                className="w-28"
                disabled={elapsedTime === 0 && !isRunning} // Disable if no time elapsed unless running
                >
                <StopCircle className="mr-2 h-5 w-5" /> Stop
              </Button>
            </div>
          </div>

          {/* Sessions List Section */}
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-primary">Recorded Sessions</h3>
            <ScrollArea className="flex-grow border rounded-lg h-80"> {/* Give scroll area a fixed height */}
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
                                    <AlertDialogDescription>
                                         This action cannot be undone. This will permanently delete the study session labeled "{session.label}".
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteSession(session.id)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
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
