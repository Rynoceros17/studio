
"use client";

import type * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Play, Pause, RotateCw, Settings, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PomodoroTimerProps {
  position: { x: number; y: number };
  onClose: () => void;
}

enum TimerMode {
  Pomodoro = 'pomodoro',
  ShortBreak = 'shortBreak',
  LongBreak = 'longBreak',
}

const defaultDurations = {
  [TimerMode.Pomodoro]: 25 * 60, // 25 minutes
  [TimerMode.ShortBreak]: 5 * 60, // 5 minutes
  [TimerMode.LongBreak]: 15 * 60, // 15 minutes
};

export function PomodoroTimer({ position, onClose }: PomodoroTimerProps) {
  const [durations, setDurations] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDurations = localStorage.getItem('pomodoro-durations');
      return savedDurations ? JSON.parse(savedDurations) : defaultDurations;
    }
    return defaultDurations;
  });
  const [mode, setMode] = useState<TimerMode>(TimerMode.Pomodoro);
  const [timeLeft, setTimeLeft] = useState(durations[mode]);
  const [isActive, setIsActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInput, setSettingsInput] = useState({
    pomodoro: Math.floor(durations[TimerMode.Pomodoro] / 60),
    shortBreak: Math.floor(durations[TimerMode.ShortBreak] / 60),
    longBreak: Math.floor(durations[TimerMode.LongBreak] / 60),
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Draggable setup
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'pomodoro-timer',
  });

  const style = {
    position: 'fixed' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: CSS.Transform.toString(transform),
    zIndex: 100, // Ensure timer is above other content
    touchAction: 'none', // Prevent default touch actions like scrolling
  };

  // Effect to handle audio element on client
  useEffect(() => {
    audioRef.current = new Audio('/sounds/timer-end.mp3'); // Ensure you have this sound file in public/sounds
    // Preload the audio
    if (audioRef.current) {
      audioRef.current.preload = 'auto';
    }
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Rewind to start
      audioRef.current.play().catch(error => console.error("Error playing sound:", error));
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(durations[mode]);
  }, [stopTimer, durations, mode]);

  const startTimer = useCallback(() => {
    if (isActive || timeLeft <= 0) return;

    setIsActive(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          stopTimer();
          playSound();
          // Optional: Automatically switch modes or handle completion
          // For now, just stops and resets
          return durations[mode]; // Reset to full duration after finishing
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [isActive, timeLeft, stopTimer, playSound, durations, mode]);

  useEffect(() => {
    resetTimer(); // Reset timer when mode or durations change
  }, [mode, durations, resetTimer]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleModeChange = (newMode: TimerMode) => {
    setMode(newMode);
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettingsInput(prev => ({
        ...prev,
        [name]: Math.max(1, parseInt(value) || 1) // Ensure positive integer, default to 1
    }));
  };

  const saveSettings = () => {
      const newDurations = {
        [TimerMode.Pomodoro]: settingsInput.pomodoro * 60,
        [TimerMode.ShortBreak]: settingsInput.shortBreak * 60,
        [TimerMode.LongBreak]: settingsInput.longBreak * 60,
      };
      setDurations(newDurations);
      setTimeLeft(newDurations[mode]); // Update current time left based on new duration
      localStorage.setItem('pomodoro-durations', JSON.stringify(newDurations));
      setShowSettings(false);
  };


  const progress = ((durations[mode] - timeLeft) / durations[mode]) * 100;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="select-none"> {/* Prevent text selection */}
       {/* Apply listeners to the CardHeader or a specific handle element */}
      <Card className="w-72 shadow-xl border border-primary/50 bg-card">
         {/* Apply drag listeners to the header */}
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 cursor-move" // Make header draggable
          {...listeners} // Apply listeners here
        >
          <CardTitle className="text-sm font-medium text-primary">Pomodoro Timer</CardTitle>
           <div className="flex items-center space-x-1">
             <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
             </Button>
             <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onClose}>
               <X className="h-4 w-4" />
               <span className="sr-only">Close</span>
             </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
         {showSettings ? (
            <div className="space-y-4 pt-2">
              <h3 className="text-center font-medium text-muted-foreground text-sm">Set Durations (minutes)</h3>
              <div className="grid grid-cols-3 gap-2">
                 <div>
                    <Label htmlFor="pomodoro-duration" className="text-xs">Pomodoro</Label>
                    <Input id="pomodoro-duration" name="pomodoro" type="number" value={settingsInput.pomodoro} onChange={handleSettingsChange} min="1" className="h-8 text-center" />
                 </div>
                 <div>
                    <Label htmlFor="shortBreak-duration" className="text-xs">Short Break</Label>
                    <Input id="shortBreak-duration" name="shortBreak" type="number" value={settingsInput.shortBreak} onChange={handleSettingsChange} min="1" className="h-8 text-center"/>
                 </div>
                  <div>
                     <Label htmlFor="longBreak-duration" className="text-xs">Long Break</Label>
                     <Input id="longBreak-duration" name="longBreak" type="number" value={settingsInput.longBreak} onChange={handleSettingsChange} min="1" className="h-8 text-center"/>
                  </div>
              </div>
               <Button onClick={saveSettings} className="w-full h-8" size="sm">
                  <Save className="mr-2 h-4 w-4" /> Save Settings
               </Button>
            </div>
          ) : (
            <>
            <Tabs value={mode} onValueChange={(value) => handleModeChange(value as TimerMode)} className="mb-4">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value={TimerMode.Pomodoro} className="text-xs px-1 h-6">Pomodoro</TabsTrigger>
                <TabsTrigger value={TimerMode.ShortBreak} className="text-xs px-1 h-6">Short Break</TabsTrigger>
                <TabsTrigger value={TimerMode.LongBreak} className="text-xs px-1 h-6">Long Break</TabsTrigger>
              </TabsList>
              {/* No TabsContent needed if only switching modes */}
            </Tabs>

            <div className="text-center mb-4">
              <p className="text-6xl font-bold font-mono text-foreground">{formatTime(timeLeft)}</p>
            </div>

            <Progress value={progress} className="mb-4 h-2" />

            <div className="flex justify-center space-x-4">
              <Button variant="outline" size="icon" onClick={resetTimer} aria-label="Reset Timer">
                <RotateCw className="h-5 w-5" />
              </Button>
              <Button
                variant={isActive ? "destructive" : "default"}
                size="lg" // Make main button larger
                onClick={isActive ? stopTimer : startTimer}
                className="w-24" // Give it a fixed width
                aria-label={isActive ? "Pause Timer" : "Start Timer"}
              >
                {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
               {/* Placeholder button to balance layout, could be settings or skip */}
               <Button variant="outline" size="icon" disabled>
                 {/* <Settings className="h-5 w-5" /> */}
                 <span className="w-5 h-5"></span> {/* Empty span to maintain size */}
               </Button>
            </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
