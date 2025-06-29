
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { addDays, subDays, startOfWeek, format, parseISO, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Edit, Trash2, CheckCircle, Circle } from 'lucide-react';
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

// Helper to convert HH:mm to minutes from midnight for layout calculation
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};


// Calculates the vertical position and height of a task
const getTaskVerticalStyle = (task: Task): React.CSSProperties => {
  if (!task.startTime || !task.endTime) return { display: 'none' };
  const startTotalMinutes = timeToMinutes(task.startTime);
  const endTotalMinutes = timeToMinutes(task.endTime);
  const duration = endTotalMinutes - startTotalMinutes;

  if (duration <= 0) return { display: 'none' };
  
  const top = (startTotalMinutes / 15) * 1.25;
  const height = (duration / 15) * 1.25;

  return {
    top: `${top}rem`,
    height: `${height}rem`,
  };
};

// New function to calculate side-by-side layout for overlapping tasks
const getDayLayout = (dailyTasksWithTime: Task[]) => {
    if (!dailyTasksWithTime || dailyTasksWithTime.length === 0) return [];

    const sortedTasks = [...dailyTasksWithTime].sort((a, b) => {
        const startA = timeToMinutes(a.startTime!);
        const startB = timeToMinutes(b.startTime!);
        if (startA !== startB) return startA - startB;
        const endA = timeToMinutes(a.endTime!);
        const endB = timeToMinutes(b.endTime!);
        return endA - endB;
    });

    const columns: Task[][] = [];
    const taskLayouts = new Map<string, { col: number; totalCols: number }>();

    sortedTasks.forEach(task => {
        let placed = false;
        const taskStart = timeToMinutes(task.startTime!);

        for (const col of columns) {
            const lastTaskInCol = col[col.length - 1];
            if (timeToMinutes(lastTaskInCol.endTime!) <= taskStart) {
                col.push(task);
                taskLayouts.set(task.id, { col: columns.indexOf(col), totalCols: 0 });
                placed = true;
                break;
            }
        }

        if (!placed) {
            columns.push([task]);
            taskLayouts.set(task.id, { col: columns.length - 1, totalCols: 0 });
        }
    });

    const finalLayouts: Array<{ task: Task; layout: React.CSSProperties }> = [];

    sortedTasks.forEach(task => {
        const collisions = sortedTasks.filter(otherTask => {
            if (task.id === otherTask.id) return false;
            const tStart = timeToMinutes(task.startTime!);
            const tEnd = timeToMinutes(task.endTime!);
            const oStart = timeToMinutes(otherTask.startTime!);
            const oEnd = timeToMinutes(otherTask.endTime!);
            return Math.max(tStart, oStart) < Math.min(tEnd, oEnd);
        });

        const myLayout = taskLayouts.get(task.id)!;
        
        let maxCol = myLayout.col;
        collisions.forEach(collidingTask => {
            const layout = taskLayouts.get(collidingTask.id);
            if(layout) {
                maxCol = Math.max(maxCol, layout.col);
            }
        });
        
        myLayout.totalCols = maxCol + 1;

        let width = 98;
        let left = 1;

        if (myLayout.totalCols > 1) {
            width = 75; // 3/4 width
            const maxShift = 25; // This is 100 - 75
            // Avoid division by zero if totalCols is 1, though the `if` prevents this.
            const leftShiftPerCol = myLayout.totalCols > 1 ? maxShift / (myLayout.totalCols - 1) : 0;
            left = myLayout.col * leftShiftPerCol;
        }

        const startTime = timeToMinutes(task.startTime!);

        finalLayouts.push({
            task,
            layout: {
                width: `${width}%`,
                left: `${left}%`,
                zIndex: startTime, // Add zIndex based on start time
            }
        });
    });
    
    return finalLayouts;
};


function TaskBlock({
    task,
    dateStr,
    colorToApply,
    isCompleted,
    onEditTask,
    onDeleteTask,
    onToggleComplete,
    layoutStyle,
}: {
    task: Task;
    dateStr: string;
    colorToApply: string | null;
    isCompleted: boolean;
    onEditTask: (task: Task) => void;
    onDeleteTask: (task: Task, dateStr: string) => void;
    onToggleComplete: (taskId: string, dateStr: string) => void;
    layoutStyle: React.CSSProperties;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const verticalStyle = getTaskVerticalStyle(task);
    
    const style = { 
        ...verticalStyle, 
        ...layoutStyle, 
        backgroundColor: colorToApply || 'hsl(var(--primary))',
        zIndex: isHovered ? 2000 : layoutStyle.zIndex,
    };
    
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const isLightColor = colorToApply && lightBackgroundColors.includes(colorToApply);

    // Calculate duration to add conditional hover class
    const [startH, startM] = (task.startTime || '0:0').split(':').map(Number);
    const [endH, endM] = (task.endTime || '0:0').split(':').map(Number);
    const actualDuration = (endH * 60 + endM) - (startH * 60 + startM);
    const isShortTask = actualDuration > 0 && actualDuration < 45;
    const isVeryShortTask = actualDuration > 0 && actualDuration <= 15;

    let textColorClass = 'text-white';
    let iconColorClass = 'text-white/80 hover:bg-white/20';

    if (isDarkMode) {
      if (colorToApply) {
        textColorClass = 'text-neutral-800';
        iconColorClass = 'text-neutral-700 hover:bg-neutral-900/10';
      }
    } else {
      if (isLightColor) {
        textColorClass = 'text-neutral-800';
        iconColorClass = 'text-neutral-700 hover:bg-neutral-900/10';
      }
    }

    const checkmarkIconClass = isCompleted 
        ? (isDarkMode && colorToApply) || (!isDarkMode && isLightColor) ? 'text-green-700' : 'text-green-400'
        : iconColorClass;

    const borderStyle = isCompleted
        ? 'border-transparent'
        : task.highPriority
        ? 'border-accent border-2'
        : 'border-primary/70';

    return (
        <div
            style={style}
            className={cn(
                "absolute p-1 rounded-md overflow-hidden text-[10px] group shadow-md transition-all duration-300",
                "flex flex-col justify-between",
                "border",
                borderStyle,
                textColorClass,
                isCompleted && "opacity-50",
                isShortTask && `hover:min-h-[3.75rem]`
            )}
            title={`${task.name}\n${task.startTime} - ${task.endTime}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex-grow cursor-pointer" onClick={() => onEditTask(task)}>
                <div className={cn("flex items-center gap-1", isCompleted && "line-through")}>
                    
                    <p className={cn("font-medium", isVeryShortTask ? 'line-clamp-1' : 'line-clamp-2')}>{task.name}</p>
                </div>
                {!isVeryShortTask && task.description && <p className={cn("line-clamp-1 opacity-80", isCompleted && "line-through")}>{task.description}</p>}
            </div>

            <div className="flex justify-end items-center space-x-0.5 mt-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" className={cn("h-4 w-4 p-0", checkmarkIconClass)} onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id, dateStr); }}>
                    {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" className={cn("h-4 w-4 p-0", iconColorClass)} onClick={(e) => { e.stopPropagation(); onEditTask(task); }}>
                    <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" className={cn("h-4 w-4 p-0 text-destructive/80 hover:bg-destructive/10")} onClick={(e) => { e.stopPropagation(); onDeleteTask(task, dateStr); }}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

export function DetailedCalendarView({ tasks, onCreateTask, onEditTask, onDeleteTask, onToggleComplete, completedTasks, updateTask }: DetailedCalendarViewProps) {
  const { theme } = useTheme();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selection, setSelection] = useState<{ startCell: string | null; endCell: string | null }>({ startCell: null, endCell: null });
  const [isSelecting, setIsSelecting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollContainerRef.current) {
      const sevenAmHourSlotPosition = 7 * (5 * 16); // 7 * (1.25rem * 4 slots) * 16px/rem
      scrollContainerRef.current.scrollTop = sevenAmHourSlotPosition;
    }
  }, []);

  const days = useMemo(() => {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(currentWeekStart, i));
    }
    return week;
  }, [currentWeekStart]);

  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);

  const getCellId = (dayIndex: number, hour: number, quarter: number): string => `cell-${dayIndex}-${hour}-${quarter}`;
  const parseCellId = (cellId: string): { dayIndex: number; hour: number; quarter: number } | null => {
    const parts = cellId.replace('cell-', '').split('-');
    if (parts.length !== 3) return null;
    return { dayIndex: parseInt(parts[0], 10), hour: parseInt(parts[1], 10), quarter: parseInt(parts[2], 10) };
  };

  const isCellSelected = (dayIndex: number, hour: number, quarter: number): boolean => {
    if (!isSelecting || !selection.startCell || !selection.endCell) {
      return false;
    }
    const start = parseCellId(selection.startCell);
    const end = parseCellId(selection.endCell);

    if (!start || !end) {
      return false;
    }

    if (dayIndex !== start.dayIndex || dayIndex !== end.dayIndex) {
        return false;
    }

    const currentCellValue = hour * 100 + quarter * 15;
    const startValue = start.hour * 100 + start.quarter * 15;
    const endValue = end.hour * 100 + end.quarter * 15;

    const minVal = Math.min(startValue, endValue);
    const maxVal = Math.max(startValue, endValue);

    return currentCellValue >= minVal && currentCellValue <= maxVal;
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

    // Ensure selection is on the same day
    const selectionStartDay = Math.min(start.dayIndex, end.dayIndex);
    const selectionEndDay = Math.max(start.dayIndex, end.dayIndex);
    if (selectionStartDay !== selectionEndDay) {
      toast({ title: "Invalid Selection", description: "Please select a time range within a single day.", variant: "destructive" });
      resetSelection();
      return;
    }

    const dayIndex = selectionStartDay;

    // Calculate total minutes from the start of the day for the start and end of the selection
    const startTotalMinutes = start.hour * 60 + start.quarter * 15;
    const endTotalMinutes = end.hour * 60 + end.quarter * 15;

    // Determine the final start and end times in minutes
    const finalStartMinutes = Math.min(startTotalMinutes, endTotalMinutes);
    const finalEndMinutes = Math.max(startTotalMinutes, endTotalMinutes) + 15; // Add 15 because the selection includes the last block

    const duration = finalEndMinutes - finalStartMinutes;

    if (duration < 30) {
      toast({
        title: "Selection Too Short",
        description: "Tasks must be at least 30 minutes long.",
        variant: "destructive",
      });
      resetSelection();
      return;
    }

    const startDate = days[dayIndex];
    
    // Convert minutes back to HH:mm format
    const finalStartHour = Math.floor(finalStartMinutes / 60);
    const finalStartMinute = finalStartMinutes % 60;
    const finalStartTime = `${String(finalStartHour).padStart(2, '0')}:${String(finalStartMinute).padStart(2, '0')}`;
    
    const finalEndHour = Math.floor(finalEndMinutes / 60);
    const finalEndMinute = finalEndMinutes % 60;
    const finalEndTime = `${String(finalEndHour).padStart(2, '0')}:${String(finalEndMinute).padStart(2, '0')}`;
    
    onCreateTask({ date: format(startDate, 'yyyy-MM-dd'), startTime: finalStartTime, endTime: finalEndTime });
    resetSelection();
  };
  
  const resetSelection = () => {
    setIsSelecting(false);
    setSelection({ startCell: null, endCell: null });
  };
  
  const tasksWithLayoutByDay = useMemo(() => {
    const groupedByDay: { [key: string]: Task[] } = {};
    days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const currentDayOfWeek = day.getDay();

        groupedByDay[dateStr] = tasks.filter(task => {
            if (!task.date || !task.startTime || !task.endTime) return false;
            const taskDate = parseISOStrict(task.date);
            if (!taskDate) return false;

            if (task.exceptions?.includes(dateStr)) return false;
            
            if (task.recurring) {
                const taskStartDayOfWeek = taskDate.getDay();
                return taskStartDayOfWeek === currentDayOfWeek && day >= taskDate;
            } else {
                return isSameDay(taskDate, day);
            }
        });
    });

    const finalLayouts: { [key: string]: Array<{ task: Task; layout: React.CSSProperties }> } = {};
    for (const dateStr in groupedByDay) {
        finalLayouts[dateStr] = getDayLayout(groupedByDay[dateStr]);
    }
    return finalLayouts;
  }, [tasks, days]);


  return (
    <div className="flex flex-col h-full" onMouseUp={handleMouseUp} onMouseLeave={isSelecting ? handleMouseUp : undefined}>
      <header className="flex items-center justify-center relative p-2 border-b shrink-0 bg-background">
        <h2 className="text-base font-semibold text-primary">
          {`${format(currentWeekStart, 'd MMMM')} - ${format(weekEnd, 'd MMMM, yyyy')}`}
        </h2>
        <div className="flex items-center gap-2 absolute right-2 top-1/2 -translate-y-1/2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>
      <div ref={scrollContainerRef} className="flex-grow overflow-auto">
        <div className="flex" style={{ minWidth: '100%' }}>
            
            <div className="w-14 text-[10px] text-center shrink-0 bg-background z-30 sticky left-0">
                <div className="h-[76px]" />
                {timeSlots.map(time => (
                    <div key={time} className="h-[5rem] relative text-muted-foreground">
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background px-1 z-10">{time}</span>
                    </div>
                ))}
            </div>

            <div ref={gridRef} className="grid grid-cols-7 flex-grow select-none">
                {days.map((day, dayIndex) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dailyTasksWithLayout = tasksWithLayoutByDay[dateStr] || [];
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div key={dateStr} className="relative border-l">
                            
                            <div className="sticky top-0 z-20 pt-2 px-2 pb-4 text-center bg-background border-b h-[76px]">
                                <p className="text-xs font-medium">{format(day, 'EEE')}</p>
                                <p className={cn("text-xl font-bold", isToday && "text-primary")}>{format(day, 'd')}</p>
                            </div>
                            
                            <div className={cn("relative", isToday ? "bg-background" : "bg-secondary/30")}>
                                {timeSlots.map((_, hour) => (
                                    <div key={hour} className="h-[5rem] border-t relative">
                                        {Array.from({ length: 4 }).map((__, quarter) => {
                                            const cellId = getCellId(dayIndex, hour, quarter);
                                            return (
                                                <div
                                                    key={quarter}
                                                    className={cn("h-[1.25rem]", quarter === 3 ? "border-b border-solid border-border" : "border-b border-dashed border-border/40", isCellSelected(dayIndex, hour, quarter) && "bg-primary/30")}
                                                    data-cell-id={cellId}
                                                    onMouseDown={handleMouseDown}
                                                    onMouseMove={handleMouseMove}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}

                                {dailyTasksWithLayout.map(({ task, layout }) => {
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
                                            layoutStyle={layout}
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
    </div>
  );
}
