
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Play, Pause, RotateCw, Settings, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PomodoroTimerProps {
  position: { x: number; y: number };
  onClose: () => void;
}

enum TimerMode {
  Pomodoro = 'pomodoro',
  ShortBreak = 'shortBreak',
}

const defaultDurations = {
  [TimerMode.Pomodoro]: 25 * 60, // 25 minutes
  [TimerMode.ShortBreak]: 5 * 60, // 5 minutes
};

export function PomodoroTimer({ position, onClose }: PomodoroTimerProps) {
  const [durations, setDurations] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDurations = localStorage.getItem('pomodoro-durations');
      try {
         const parsed = savedDurations ? JSON.parse(savedDurations) : defaultDurations;
         // Ensure saved durations have the correct keys, otherwise fallback
         if (parsed[TimerMode.Pomodoro] && parsed[TimerMode.ShortBreak]) {
             return parsed;
         }
      } catch (e) {
          console.error("Failed to parse saved durations:", e);
      }
    }
    return defaultDurations;
  });
  const [mode, setMode] = useState<TimerMode>(TimerMode.Pomodoro);
  const [timeLeft, setTimeLeft] = useState(durations[mode]);
  const [isActive, setIsActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInput, setSettingsInput] = useState(() => ({
    pomodoro: Math.floor(durations[TimerMode.Pomodoro] / 60),
    shortBreak: Math.floor(durations[TimerMode.ShortBreak] / 60),
  }));

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Removed audioRef

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

  // Removed useEffect for audio element

  // Removed playSound useCallback

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("Timer stopped. Interval cleared.");
    }
    setIsActive(false);
  }, []);

    // Wrapped the core timer logic in a stable ref callback pattern
    const timerTick = useCallback(() => {
        setTimeLeft((prevTime) => {
            if (prevTime <= 1) {
                stopTimer(); // Clear the interval first
                // Removed playSound call

                // Switch mode and reset/start next timer
                if (mode === TimerMode.Pomodoro) {
                    console.log("Pomodoro finished, switching to short break.");
                    const newDuration = durations[TimerMode.ShortBreak];
                    setMode(TimerMode.ShortBreak); // Update mode state first
                    setTimeLeft(newDuration); // Set time for break

                    // Automatically start the short break using the ref
                    // Add a small delay to ensure state updates propagate before starting next timer
                    setTimeout(() => {
                         if(startTimerCallbackRef.current) {
                             console.log("Starting short break timer automatically.");
                             // IMPORTANT: Call the start function directly here to initiate the break
                             startTimerCallbackRef.current();
                         } else {
                             console.error("startTimerCallbackRef.current is null, cannot start break timer.");
                         }
                     }, 100); // Small delay (e.g., 100ms)
                } else { // ShortBreak finished
                    console.log("Short break finished, resetting to Pomodoro.");
                    setMode(TimerMode.Pomodoro); // Reset mode
                    setTimeLeft(durations[TimerMode.Pomodoro]); // Reset time
                    // Don't auto-start next pomodoro - isActive remains false
                }
                return 0; // Return 0 to indicate timer reached end
            }
            return prevTime - 1; // Decrement time
        });
    }, [stopTimer, mode, durations, setMode, setTimeLeft]); // Removed playSound dependency


    const startTimerCallback = useCallback(() => {
        // Allow starting even if isActive is true if the timer reached 0 (handled by stopTimer in tick)
        if (isActive && timeLeft > 0) {
            console.log("Timer already active and time > 0, returning.");
            return;
        }
        // Prevent starting if time is already 0 or less unless it's the auto-start scenario
        if (timeLeft <= 0 && !isActive) { // Check !isActive to distinguish manual start at 0
            console.log("Timer at 0 and not active, cannot start manually.");
            return;
        }

        console.log(`Starting ${mode} timer for ${timeLeft > 0 ? timeLeft : durations[mode]} seconds.`);
        setIsActive(true); // Set active *before* setting interval
        // Clear any existing interval just in case
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            console.log("Cleared existing interval before starting new one.");
        }
        // Start the new interval
        intervalRef.current = setInterval(timerTick, 1000);

    }, [isActive, timeLeft, mode, timerTick, durations]); // Added durations dependency


    // Ref to hold the latest startTimerCallback and timerTick
    const startTimerCallbackRef = useRef(startTimerCallback);
    useEffect(() => {
        startTimerCallbackRef.current = startTimerCallback;
    }, [startTimerCallback]);


    const startTimer = () => {
       // Removed audio context resume attempt
       startTimerCallbackRef.current(); // Directly start the timer logic
    };


  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(durations[mode]);
  }, [stopTimer, durations, mode]);


  useEffect(() => {
    // Reset timer only if mode changes or durations for the current mode change
    // Avoid resetting if only the duration for the *other* mode changed
    const newDuration = durations[mode];
    // Check if the new duration is different before resetting
    if (timeLeft !== newDuration || !isActive) { // Also reset if not active
      setTimeLeft(newDuration);
    }
    // If the timer was active, stop it, as the duration changed or mode switched.
    if (isActive) {
        stopTimer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, durations]); // Intentionally excluding timeLeft and isActive to control reset logic


  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleModeChange = (newModeValue: string) => {
      const newMode = newModeValue as TimerMode;
      if (Object.values(TimerMode).includes(newMode) && newMode !== mode) { // Only change if mode is different
          console.log("Manually changing mode to:", newMode);
          stopTimer(); // Stop timer when manually changing modes
          setMode(newMode);
          // setTimeLeft will be updated by the useEffect watching [mode, durations]
      } else if (newMode === mode) {
          console.log("Mode already set to:", newMode);
      }
      else {
          console.warn("Attempted to switch to invalid mode:", newModeValue);
      }
  };

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettingsInput(prev => ({
        ...prev,
        [name]: Math.max(1, parseInt(value) || 1) // Ensure positive integer, default to 1
    }));
  };

  // Updated saveSettings, removing LongBreak
  const saveSettings = () => {
      const newDurations = {
        [TimerMode.Pomodoro]: settingsInput.pomodoro * 60,
        [TimerMode.ShortBreak]: settingsInput.shortBreak * 60,
      };
      setDurations(newDurations);
      // Reset time left only if the timer is not active or settings change affects current mode
       if (!isActive) {
          setTimeLeft(newDurations[mode]);
       } else {
           // If active, and new duration is less than current time, reset to new duration
           if (mode === TimerMode.Pomodoro && timeLeft > newDurations[TimerMode.Pomodoro]) {
               setTimeLeft(newDurations[TimerMode.Pomodoro]);
           } else if (mode === TimerMode.ShortBreak && timeLeft > newDurations[TimerMode.ShortBreak]) {
               setTimeLeft(newDurations[TimerMode.ShortBreak]);
           }
           // If active and time needs resetting, stop the timer
           stopTimer(); // Stop timer if duration changes while active
           setTimeLeft(newDurations[mode]); // Update display time immediately
       }
      localStorage.setItem('pomodoro-durations', JSON.stringify(newDurations));
      setShowSettings(false);
  };


  const progress = durations[mode] > 0 ? ((durations[mode] - timeLeft) / durations[mode]) * 100 : 0;


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
              {/* Updated settings grid, removing LongBreak */}
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <Label htmlFor="pomodoro-duration" className="text-xs">Pomodoro</Label>
                    <Input id="pomodoro-duration" name="pomodoro" type="number" value={settingsInput.pomodoro} onChange={handleSettingsChange} min="1" className="h-8 text-center" />
                 </div>
                 <div>
                    <Label htmlFor="shortBreak-duration" className="text-xs">Short Break</Label>
                    <Input id="shortBreak-duration" name="shortBreak" type="number" value={settingsInput.shortBreak} onChange={handleSettingsChange} min="1" className="h-8 text-center"/>
                 </div>
                  {/* Removed Long Break Input */}
              </div>
               <Button onClick={saveSettings} className="w-full h-8" size="sm">
                  <Save className="mr-2 h-4 w-4" /> Save Settings
               </Button>
            </div>
          ) : (
            <>
            {/* Updated TabsList grid, removing LongBreak */}
            <Tabs value={mode} onValueChange={handleModeChange} className="mb-4">
              <TabsList className="grid w-full grid-cols-2 h-8"> {/* Changed grid-cols-3 to grid-cols-2 */}
                <TabsTrigger value={TimerMode.Pomodoro} className="text-xs px-1 h-6">Pomodoro</TabsTrigger>
                <TabsTrigger value={TimerMode.ShortBreak} className="text-xs px-1 h-6">Short Break</TabsTrigger>
                {/* Removed Long Break TabTrigger */}
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

