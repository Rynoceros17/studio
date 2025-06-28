
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { addDays, subDays, startOfWeek, format, parseISO, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Edit, Trash2, CheckCircle, Circle, Star } from 'lucide-react';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn, parseISOStrict } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

interface DetailedCalendarViewProps {
  tasks: Task[];
  onCreateTask: (taskData: Partial<Task>) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task, dateStr: string) => void;
  onToggleComplete: (taskId: string, dateStr: string) => void;
  completedTasks: Set<string>;
  updateTask: (id: string, updates: Partial<Task>) => void;
}

const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    return `${hour} ${ampm}`;
});

const lightBackgroundColors = [
  'hsl(0 0% 100%)',
  'hsl(259 67% 88%)',
  'hsl(259 67% 92%)',
  'hsl(50, 100%, 90%)',
  'hsl(45, 90%, 85%)',
  'hsl(55, 80%, 80%)',
  'hsl(259 67% 82%)',
];

const getTaskStyle = (task: Task, colorToApply: string | null | undefined): React.CSSProperties => {
  if (!task.startTime || !task.endTime) return { display: 'none' };
  const [startH, startM] = task.startTime.split(':').map(Number);
  const [endH, endM] = task.endTime.split(':').map(Number);
  
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;
  const duration = endTotalMinutes - startTotalMinutes;
  
  if (duration <= 0) return { display: 'none' };

  const top = (startTotalMinutes / 15) * 0.875;
  const height = (duration / 15) * 0.875;
  
  return {
    top: `${top}rem`,
    height: `${height}rem`,
    backgroundColor: colorToApply || 'hsl(var(--primary))',
    opacity: task.recurring ? 0.85 : 0.95,
  };
};

function TaskBlock({
    task,
    dateStr,
    colorToApply,
    isCompleted,
    onEditTask,
    onDeleteTask,
    onToggleComplete,
}: {
    task: Task;
    dateStr: string;
    colorToApply: string | null;
    isCompleted: boolean;
    onEditTask: (task: Task) => void;
    onDeleteTask: (task: Task, dateStr: string) => void;
    onToggleComplete: (taskId: string, dateStr: string) => void;
}) {
    const style = getTaskStyle(task, colorToApply);
    
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const isLightColor = colorToApply && lightBackgroundColors.includes(colorToApply);

    let textColorClass = 'text-white';
    let iconColorClass = 'text-white/80 hover:bg-white/20';

    if (isDarkMode) {
      // In dark mode, if any custom background color is applied, use dark text for contrast.
      if (colorToApply) {
        textColorClass = 'text-neutral-800';
        iconColorClass = 'text-neutral-700 hover:bg-neutral-900/10';
      }
    } else {
      // In light mode, use dark text only on the designated light background colors.
      if (isLightColor) {
        textColorClass = 'text-neutral-800';
        iconColorClass = 'text-neutral-700 hover:bg-neutral-900/10';
      }
    }

    // Special styling for the completion checkmark itself to ensure visibility
    const checkmarkIconClass = isCompleted 
        ? (isDarkMode && colorToApply) || (!isDarkMode && isLightColor) ? 'text-green-700' : 'text-green-400'
        : iconColorClass;

    const borderStyle = isCompleted
        ? 'border-transparent'
        : task.highPriority
        ? 'border-accent border-2'
        : 'border-primary';

    return (
        <div
            style={style}
            className={cn(
                "absolute left-1 right-1 p-1 rounded-md overflow-hidden text-[10px] group shadow-md hover:shadow-lg transition-all cursor-pointer",
                "border",
                borderStyle,
                textColorClass,
                isCompleted && "opacity-50",
            )}
            title={`${task.name}\n${task.startTime} - ${task.endTime}`}
            onClick={() => onEditTask(task)}
        >
            <div className={cn("flex items-center gap-1", isCompleted && "line-through")}>
                {task.highPriority && !isCompleted && <Star className="h-2.5 w-2.5 text-accent fill-accent shrink-0" />}
                <p className="font-medium line-clamp-1">{task.name}</p>
            </div>
            {task.description && <p className={cn("line-clamp-1 opacity-80", isCompleted && "line-through")}>{task.description}</p>}
            
            <div className="absolute top-1 right-1 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className={cn("h-4 w-4", checkmarkIconClass)} onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, dateStr); }}>
                    {isCompleted ? <CheckCircle className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
                </Button>
                <Button size="icon" variant="ghost" className={cn("h-4 w-4", iconColorClass)} onClick={(e) => { e.stopPropagation(); onEditTask(task); }}>
                    <Edit className="h-2.5 w-2.5" />
                </Button>
                <Button size="icon" variant="ghost" className={cn("h-4 w-4", iconColorClass)} onClick={(e) => { e.stopPropagation(); onDeleteTask(task, dateStr); }}>
                    <Trash2 className="h-2.5 w-2.5" />
                </Button>
            </div>
        </div>
    );
}

export function DetailedCalendarView({ tasks, onCreateTask, onEditTask, onDeleteTask, onToggleComplete, completedTasks }: DetailedCalendarViewProps) {
  const { theme } = useTheme();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selection, setSelection] = useState<{ startCell: string | null; endCell: string | null }>({ startCell: null, endCell: null });
  const [isSelecting, setIsSelecting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Scroll to 7 AM on initial mount
    if (scrollContainerRef.current) {
      // The 7th hour (7 AM) is at index 7. Each hour slot has a height of h-14 (3.5rem or 56px).
      const sevenAmHourSlotPosition = 7 * 56;
      scrollContainerRef.current.scrollTop = sevenAmHourSlotPosition;
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const days = useMemo(() => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(currentWeekStart, i));
    }
    return week;
  }, [currentWeekStart]);

  const getCellId = (dayIndex: number, hour: number, quarter: number): string => `cell-${dayIndex}-${hour}-${quarter}`;
  const parseCellId = (cellId: string): { dayIndex: number; hour: number; quarter: number } | null => {
    const parts = cellId.replace('cell-', '').split('-');
    if (parts.length !== 3) return null;
    return { dayIndex: parseInt(parts[0], 10), hour: parseInt(parts[1], 10), quarter: parseInt(parts[2], 10) };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.group')) return;
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
    const finalStartMinute = Math.min(startTimeValue, endTimeValue) % 100;
    const finalEndHour = Math.floor(Math.max(startTimeValue, endTimeValue) / 100);
    const finalEndMinute = (Math.max(startTimeValue, endTimeValue) % 100) + 15;
    const startDate = days[dayIndex];
    const finalStartTime = `${String(finalStartHour).padStart(2, '0')}:${String(finalStartMinute).padStart(2, '0')}`;
    let adjustedEndHour = finalEndHour;
    let adjustedEndMinute = finalEndMinute;
    if (adjustedEndMinute >= 60) {
      adjustedEndHour += Math.floor(adjustedEndMinute / 60);
      adjustedEndMinute %= 60;
    }
    const finalEndTime = `${String(adjustedEndHour).padStart(2, '0')}:${String(adjustedEndMinute).padStart(2, '0')}`;
    onCreateTask({ date: format(startDate, 'yyyy-MM-dd'), startTime: finalStartTime, endTime: finalEndTime });
    resetSelection();
  };

  const resetSelection = () => {
    setIsSelecting(false);
    setSelection({ startCell: null, endCell: null });
  };
  
  const tasksWithTime = tasks.filter(t => t.startTime && t.endTime);
  
  const tasksByDay = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const currentDayOfWeek = day.getDay();

        grouped[dateStr] = tasksWithTime.filter(task => {
            if (!task.date) return false;
            const taskDate = parseISOStrict(task.date);
            if (!taskDate) return false;

            if (task.exceptions?.includes(dateStr)) {
                return false;
            }

            if (task.recurring) {
                const taskStartDayOfWeek = taskDate.getDay();
                return taskStartDayOfWeek === currentDayOfWeek && day >= taskDate;
            } else {
                return isSameDay(taskDate, day);
            }
        });
    });
    return grouped;
  }, [tasksWithTime, days]);


  return (
    <div className="flex flex-col h-full" onMouseUp={handleMouseUp} onMouseLeave={isSelecting ? handleMouseUp : undefined}>
      <header className="flex items-center justify-between p-2 border-b shrink-0">
        <h2 className="text-base font-semibold text-primary">{format(currentWeekStart, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>
      <div ref={scrollContainerRef} className="flex flex-grow overflow-auto">
        <div className="w-14 text-[10px] text-center shrink-0">
          <div className="h-12" />
          {timeSlots.map(time => <div key={time} className="h-14 relative text-muted-foreground"><span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background px-1 z-10">{time}</span></div>)}
        </div>
        <div ref={gridRef} className="grid grid-cols-7 flex-grow select-none">
          {days.map((day, dayIndex) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dailyTasks = tasksByDay[dateStr] || [];
            const isToday = isSameDay(day, new Date());
            return (
              <div key={dateStr} className={cn("relative border-l", isToday && "bg-secondary/20")}>
                <div className="sticky top-0 z-20 p-2 text-center bg-background border-b h-12">
                  <p className="text-xs font-medium">{format(day, 'EEE')}</p>
                  <p className={cn("text-xl font-bold", isToday && "text-primary")}>{format(day, 'd')}</p>
                </div>
                <div className="relative">
                  {timeSlots.map((_, hour) => (
                    <div key={hour} className="h-14 border-t relative">
                      {Array.from({ length: 4 }).map((__, quarter) => {
                        const cellId = getCellId(dayIndex, hour, quarter);
                        return (
                          <div
                            key={quarter}
                            className={cn("h-[0.875rem]", quarter === 3 ? "border-b border-solid border-border" : "border-b border-dashed border-border/40", isCellSelected(dayIndex, hour, quarter) && "bg-primary/30")}
                            data-cell-id={cellId}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                          />
                        );
                      })}
                    </div>
                  ))}
                  {dailyTasks.map(task => {
                    const completionKey = `${task.id}_${dateStr}`;
                    const isCompleted = completedTasks.has(completionKey);
                    const isDefaultWhite = task.color === 'hsl(0 0% 100%)';
                    const isDarkMode = theme === 'dark';
                    let colorToApply = task.color;
                    if (isDefaultWhite && isDarkMode) colorToApply = 'hsl(259 67% 82%)';
                    return (
                      <TaskBlock
                        key={`${task.id}_${dateStr}`}
                        task={task}
                        dateStr={dateStr}
                        colorToApply={colorToApply}
                        isCompleted={isCompleted}
                        onEditTask={onEditTask}
                        onDeleteTask={onDeleteTask}
                        onToggleComplete={onToggleComplete}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

    