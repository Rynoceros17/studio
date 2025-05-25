
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
import useLocalStorage from '@/hooks/useLocalStorage'; // Changed from useSyncedStorage

interface PomodoroTimerProps {
  position: { x: number; y: number };
  onClose: () => void;
}

enum TimerMode {
  Pomodoro = 'pomodoro',
  ShortBreak = 'shortBreak',
}

const defaultDurations = {
  [TimerMode.Pomodoro]: 25 * 60, 
  [TimerMode.ShortBreak]: 5 * 60, 
};

export function PomodoroTimer({ position, onClose }: PomodoroTimerProps) {
  const [durations, setDurations] = useLocalStorage<typeof defaultDurations>('pomodoro-durations', defaultDurations);
  const [mode, setMode] = useState<TimerMode>(TimerMode.Pomodoro);
  const [timeLeft, setTimeLeft] = useState(durations[mode]);
  const [isActive, setIsActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInput, setSettingsInput] = useState(() => ({
    pomodoro: Math.floor(durations[TimerMode.Pomodoro] / 60),
    shortBreak: Math.floor(durations[TimerMode.ShortBreak] / 60),
  }));

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  

  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'pomodoro-timer',
  });

  const style = {
    position: 'fixed' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: CSS.Transform.toString(transform),
    zIndex: 100, 
    touchAction: 'none', 
  };

  

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("Timer stopped. Interval cleared.");
    }
    setIsActive(false);
  }, []);

    
    const timerTick = useCallback(() => {
        setTimeLeft((prevTime) => {
            if (prevTime <= 1) {
                stopTimer(); 
                

                
                if (mode === TimerMode.Pomodoro) {
                    console.log("Pomodoro finished, switching to short break.");
                    const newDuration = durations[TimerMode.ShortBreak];
                    setMode(TimerMode.ShortBreak); 
                    setTimeLeft(newDuration); 

                    
                    
                    setTimeout(() => {
                         if(startTimerCallbackRef.current) {
                             console.log("Starting short break timer automatically.");
                             
                             startTimerCallbackRef.current();
                         } else {
                             console.error("startTimerCallbackRef.current is null, cannot start break timer.");
                         }
                     }, 100); 
                } else { 
                    console.log("Short break finished, resetting to Pomodoro.");
                    setMode(TimerMode.Pomodoro); 
                    setTimeLeft(durations[TimerMode.Pomodoro]); 
                    
                }
                return 0; 
            }
            return prevTime - 1; 
        });
    }, [stopTimer, mode, durations, setMode, setTimeLeft]); 


    const startTimerCallback = useCallback(() => {
        
        if (isActive && timeLeft > 0) {
            console.log("Timer already active and time > 0, returning.");
            return;
        }
        
        if (timeLeft <= 0 && !isActive) { 
            console.log("Timer at 0 and not active, cannot start manually.");
            return;
        }

        console.log(`Starting ${mode} timer for ${timeLeft > 0 ? timeLeft : durations[mode]} seconds.`);
        setIsActive(true); 
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            console.log("Cleared existing interval before starting new one.");
        }
        
        intervalRef.current = setInterval(timerTick, 1000);

    }, [isActive, timeLeft, mode, timerTick, durations]); 


    
    const startTimerCallbackRef = useRef(startTimerCallback);
    useEffect(() => {
        startTimerCallbackRef.current = startTimerCallback;
    }, [startTimerCallback]);


    const startTimer = () => {
       
       startTimerCallbackRef.current(); 
    };


  const resetTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(durations[mode]);
  }, [stopTimer, durations, mode]);


  useEffect(() => {
    
    
    
    const newDuration = durations[mode];
    
    if (timeLeft !== newDuration || !isActive) { 
      setTimeLeft(newDuration);
    }
    
    if (isActive) {
        stopTimer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, durations]); 


  
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
      if (Object.values(TimerMode).includes(newMode) && newMode !== mode) { 
          console.log("Manually changing mode to:", newMode);
          stopTimer(); 
          setMode(newMode);
          
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
        [name]: Math.max(1, parseInt(value) || 1) 
    }));
  };

  
  const saveSettings = () => {
      const newDurations = {
        [TimerMode.Pomodoro]: settingsInput.pomodoro * 60,
        [TimerMode.ShortBreak]: settingsInput.shortBreak * 60,
      };
      setDurations(newDurations);
      
       if (!isActive) {
          setTimeLeft(newDurations[mode]);
       } else {
           
           if (mode === TimerMode.Pomodoro && timeLeft > newDurations[TimerMode.Pomodoro]) {
               setTimeLeft(newDurations[TimerMode.Pomodoro]);
           } else if (mode === TimerMode.ShortBreak && timeLeft > newDurations[TimerMode.ShortBreak]) {
               setTimeLeft(newDurations[TimerMode.ShortBreak]);
           }
           
           stopTimer(); 
           setTimeLeft(newDurations[mode]); 
       }
      localStorage.setItem('pomodoro-durations', JSON.stringify(newDurations));
      setShowSettings(false);
  };


  const progress = durations[mode] > 0 ? ((durations[mode] - timeLeft) / durations[mode]) * 100 : 0;


  return (
    <div ref={setNodeRef} style={style} {...attributes} className="select-none"> 
       
      <Card className="w-72 shadow-xl border border-primary/50 bg-card">
         
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 cursor-move" 
          {...listeners} 
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
              
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <Label htmlFor="pomodoro-duration" className="text-xs">Pomodoro</Label>
                    <Input id="pomodoro-duration" name="pomodoro" type="number" value={settingsInput.pomodoro} onChange={handleSettingsChange} min="1" className="h-8 text-center" />
                 </div>
                 <div>
                    <Label htmlFor="shortBreak-duration" className="text-xs">Short Break</Label>
                    <Input id="shortBreak-duration" name="shortBreak" type="number" value={settingsInput.shortBreak} onChange={handleSettingsChange} min="1" className="h-8 text-center"/>
                 </div>
                  
              </div>
               <Button onClick={saveSettings} className="w-full h-8" size="sm">
                  <Save className="mr-2 h-4 w-4" /> Save Settings
               </Button>
            </div>
          ) : (
            <>
            
            <Tabs value={mode} onValueChange={handleModeChange} className="mb-4">
              <TabsList className="grid w-full grid-cols-2 h-8"> 
                <TabsTrigger value={TimerMode.Pomodoro} className="text-xs px-1 h-6">Pomodoro</TabsTrigger>
                <TabsTrigger value={TimerMode.ShortBreak} className="text-xs px-1 h-6">Short Break</TabsTrigger>
                
              </TabsList>
              
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
                size="lg" 
                onClick={isActive ? stopTimer : startTimer}
                className="w-24" 
                aria-label={isActive ? "Pause Timer" : "Start Timer"}
              >
                {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
               
               <Button variant="outline" size="icon" disabled>
                 
                 <span className="w-5 h-5"></span> 
               </Button>
            </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
