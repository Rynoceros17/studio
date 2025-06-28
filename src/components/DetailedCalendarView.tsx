
"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { addDays, subDays, startOfWeek, endOfWeek, format, setHours, setMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";


interface DetailedCalendarViewProps {
  tasks: Task[];
  onCreateTask: (taskData: Partial<Task>) => void;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour} ${ampm}`;
});


export function DetailedCalendarView({ tasks, onCreateTask }: DetailedCalendarViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selection, setSelection] = useState<{ startCell: string | null; endCell: string | null }>({ startCell: null, endCell: null });
  const [isSelecting, setIsSelecting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const days = useMemo(() => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(currentWeekStart, i));
    }
    return week;
  }, [currentWeekStart]);

  const getCellId = (dayIndex: number, hour: number, quarter: number): string => {
    return `cell-${dayIndex}-${hour}-${quarter}`;
  };

  const parseCellId = (cellId: string): { dayIndex: number; hour: number; quarter: number } | null => {
    const parts = cellId.replace('cell-', '').split('-');
    if (parts.length !== 3) return null;
    return {
      dayIndex: parseInt(parts[0], 10),
      hour: parseInt(parts[1], 10),
      quarter: parseInt(parts[2], 10),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only for left click
    const cellId = e.currentTarget.dataset.cellId;
    if (!cellId) return;

    setIsSelecting(true);
    setSelection({ startCell: cellId, endCell: cellId });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;
    const cellId = e.currentTarget.dataset.cellId;
    if (cellId && cellId !== selection.endCell) {
      setSelection(prev => ({ ...prev, endCell: cellId }));
    }
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection.startCell || !selection.endCell) {
      resetSelection();
      return;
    }

    const start = parseCellId(selection.startCell);
    const end = parseCellId(selection.endCell);

    if (!start || !end) {
      resetSelection();
      return;
    }
    
    // Ensure start is before end
    const selectionStartDay = Math.min(start.dayIndex, end.dayIndex);
    const selectionEndDay = Math.max(start.dayIndex, end.dayIndex);

    if (selectionStartDay !== selectionEndDay) {
        toast({ title: "Invalid Selection", description: "Please select a time range within a single day.", variant: "destructive" });
        resetSelection();
        return;
    }
    
    const dayIndex = selectionStartDay;

    const startTimeValue = start.hour * 100 + start.quarter * 15;
    const endTimeValue = end.hour * 100 + end.quarter * 15;

    const finalStartHour = Math.floor(Math.min(startTimeValue, endTimeValue) / 100);
    const finalStartMinute = (Math.min(startTimeValue, endTimeValue) % 100);
    const finalEndHour = Math.floor(Math.max(startTimeValue, endTimeValue) / 100);
    const finalEndMinute = (Math.max(startTimeValue, endTimeValue) % 100) + 15;

    const startDate = days[dayIndex];
    const finalStartTime = `${String(finalStartHour).padStart(2, '0')}:${String(finalStartMinute).padStart(2, '0')}`;
    let finalEndTime = '';
    
    let adjustedEndHour = finalEndHour;
    let adjustedEndMinute = finalEndMinute;

    if (adjustedEndMinute === 60) {
        adjustedEndHour += 1;
        adjustedEndMinute = 0;
    }
    finalEndTime = `${String(adjustedEndHour).padStart(2, '0')}:${String(adjustedEndMinute).padStart(2, '0')}`;
    
    onCreateTask({
      date: format(startDate, 'yyyy-MM-dd'),
      startTime: finalStartTime,
      endTime: finalEndTime,
    });
    
    resetSelection();
  };

  const resetSelection = () => {
    setIsSelecting(false);
    setSelection({ startCell: null, endCell: null });
  };
  
  const isCellSelected = (dayIndex: number, hour: number, quarter: number): boolean => {
    if (!selection.startCell || !selection.endCell) return false;

    const start = parseCellId(selection.startCell);
    const end = parseCellId(selection.endCell);

    if (!start || !end) return false;

    const minDay = Math.min(start.dayIndex, end.dayIndex);
    const maxDay = Math.max(start.dayIndex, end.dayIndex);
    
    if (dayIndex < minDay || dayIndex > maxDay || minDay !== maxDay) return false;

    const startTimeValue = start.hour * 100 + start.quarter * 15;
    const endTimeValue = end.hour * 100 + end.quarter * 15;
    const cellTimeValue = hour * 100 + quarter * 15;
    
    return cellTimeValue >= Math.min(startTimeValue, endTimeValue) && cellTimeValue <= Math.max(startTimeValue, endTimeValue);
  };
  
  const getTaskStyle = (task: Task): React.CSSProperties => {
    if (!task.startTime || !task.endTime) return {};
    const [startH, startM] = task.startTime.split(':').map(Number);
    const [endH, endM] = task.endTime.split(':').map(Number);
    
    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;
    const duration = endTotalMinutes - startTotalMinutes;
    
    // Each hour slot is h-20 (5rem). A quarter is h-5 (1.25rem).
    const top = (startTotalMinutes / 15) * 1.25; // 1.25rem per 15 mins
    const height = (duration / 15) * 1.25;
    
    return {
      top: `${top}rem`,
      height: `${height}rem`,
      backgroundColor: task.color || 'hsl(var(--primary))',
      opacity: 0.9
    };
  };

  return (
    <div className="flex flex-col h-full" onMouseUp={handleMouseUp} onMouseLeave={isSelecting ? handleMouseUp : undefined}>
      <header className="flex items-center justify-between p-2 border-b shrink-0">
        <h2 className="text-lg font-semibold text-primary">
          {format(currentWeekStart, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex flex-grow overflow-auto">
        <div className="w-20 text-xs text-center text-muted-foreground shrink-0">
          <div className="h-16"></div> {/* Spacer for day header */}
          {timeSlots.map((time, index) => (
            <div key={index} className="h-20 flex items-start justify-center pt-1 border-t relative -top-2">
              <span className="relative -top-2">{time}</span>
            </div>
          ))}
        </div>
        
        <div ref={gridRef} className="grid grid-cols-7 flex-grow select-none">
          {days.map((day, dayIndex) => (
            <div key={day.toISOString()} className="relative border-l">
              <div className="sticky top-0 z-10 p-2 text-center bg-background border-b h-16">
                <p className="text-sm font-medium">{format(day, 'EEE')}</p>
                <p className="text-2xl font-bold">{format(day, 'd')}</p>
              </div>
              
              <div className="relative">
                {timeSlots.map((_, hour) => (
                  <div key={hour} className="h-20 border-t relative">
                    {Array.from({ length: 4 }).map((__, quarter) => (
                      <div
                        key={quarter}
                        className={cn(
                          "h-5",
                          quarter === 3 ? "border-b border-solid border-border" : "border-b border-dashed border-border/40",
                          isCellSelected(dayIndex, hour, quarter) && "bg-primary/30"
                        )}
                        data-cell-id={getCellId(dayIndex, hour, quarter)}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                      />
                    ))}
                  </div>
                ))}
                
                {tasks.filter(t => t.date === format(day, 'yyyy-MM-dd')).map(task => (
                    <div key={task.id} style={getTaskStyle(task)} className="absolute left-1 right-1 p-1 rounded-md text-white overflow-hidden text-xs z-20">
                        <p className="font-bold line-clamp-1">{task.name}</p>
                        <p className="line-clamp-1">{task.description}</p>
                    </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
