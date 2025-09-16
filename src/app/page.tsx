
"use client";

import type * as React from 'react';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { TaskForm } from '@/components/TaskForm';
import { CalendarView } from '@/components/CalendarView';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import type { Task, Goal, UpcomingItem, SingleTaskOutput } from '@/lib/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { TaskListSheet } from '@/components/TaskListSheet';
import { TopTaskBar } from '@/components/TopTaskBar';
import { AuthButton } from '@/components/AuthButton';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, List, Timer as TimerIcon, Bookmark as BookmarkIcon, Target, LayoutDashboard, BookOpen, LogIn, SendHorizonal, Loader2, Save, Info, CalendarClock, Palette, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';
import { format, parseISO, startOfDay, addDays, subDays, isValid, isSameDay, startOfWeek } from 'date-fns';
import { cn, calculateGoalProgress, calculateTimeLeft, parseISOStrict } from '@/lib/utils';
import { parseNaturalLanguageTask } from '@/ai/flows/parse-natural-language-task-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { colorTagToHexMap } from '@/lib/color-map';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { TodaysTasksDialog } from '@/components/TodaysTasksDialog';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LandingPage } from '@/components/LandingPage';
import { motion } from 'framer-motion';
import { HueSlider } from '@/components/HueSlider';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { GoalOfWeekEditor } from '@/components/GoalOfWeekEditor';
import { BookmarkListSheet } from '@/components/BookmarkListSheet';
import { Separator } from '@/components/ui/separator';
import { ThemePresets } from '@/components/ThemePresets';


interface MoveRecurringConfirmationState {
  task: Task;
  originalDateStr: string;
  newDateStr: string;
}


export default function Home() {
  const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
  const [currentDisplayDate, setCurrentDisplayDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [goalsByWeek, setGoalsByWeek] = useLocalStorage<Record<string, string>>('weekwise-goals-by-week', {});
  
  const { user, authLoading } = useAuth();
  const isInitialLoad = useRef(true);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

  const { toast } = useToast();
  const [isTaskListOpen, setIsTaskListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);
  const [isTimerVisible, setIsTimerVisible] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isTodaysTasksDialogOpen, setIsTodaysTasksDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [hue, setHue] = useLocalStorage('app-primary-hue', 270);
  const previousHueRef = useRef(hue);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const calendarRef = useRef<{ addTask: (task: Omit<Task, 'id'>) => void }>(null);


  useEffect(() => {
    document.documentElement.style.setProperty('--primary-hue', String(hue));
    const oppositeHue = (hue + 180) % 360;
    document.documentElement.style.setProperty('--opposite-hue', String(oppositeHue));

    if (isDataLoaded && hue !== previousHueRef.current) {
        previousHueRef.current = hue;
    }
  }, [hue, isDataLoaded]);


  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const initialX = window.innerWidth - 300 - 24;
        const initialY = 24;
        setTimerPosition({ x: initialX, y: initialY });
    }
  }, []);

  // Show the "Today's Tasks" dialog only after the user's auth status and data is resolved.
  useEffect(() => {
    if (!authLoading && isDataLoaded) {
        // Temporarily disabled to avoid being annoying during dev
        // setIsTodaysTasksDialogOpen(true);
    }
  }, [authLoading, isDataLoaded]);

  // Effect to handle initial data load (now only for non-task data from page)
  useEffect(() => {
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }

    if (!user && !authLoading) {
      isInitialLoad.current = false;
      setIsDataLoaded(true);
    } else if (user && db) {
      // In a full implementation, you might load other non-task data here.
      isInitialLoad.current = false;
      setIsDataLoaded(true);
    }
    
    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
      }
    };
  }, [user, authLoading, toast]);


  // Effect for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus AI input
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array ensures this effect runs only once


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleTimerDragEnd = (event: DragEndEvent) => {
    if (event.active.id === 'pomodoro-timer') {
      setTimerPosition((prev) => ({
        x: prev.x + event.delta.x,
        y: prev.y + event.delta.y,
      }));
    }
  };

  const toggleGoalPriority = useCallback((goalId: string) => {
    setGoals(prevGoals =>
      prevGoals.map(goal =>
        goal.id === goalId ? { ...goal, highPriority: !goal.highPriority } : goal
      )
    );
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
        toast({
            title: `Goal Priority ${!goal.highPriority ? 'Added' : 'Removed'}`,
            description: `"${goal.name}" is ${!goal.highPriority ? 'now' : 'no longer'} high priority.`,
        });
    }
  }, [goals, setGoals, toast]);


  const upcomingItemsForBar = useMemo((): UpcomingItem[] => {
    if (!isClient) return [];
    // This is now simplified as `tasks` state is in CalendarView.
    // A more advanced implementation might use a shared context or lift state up again
    // if this component *truly* needs realtime task data. For now, we'll only show goals.
    const mappedGoals: UpcomingItem[] = goals
      .filter(goal => {
        if (!goal.dueDate) return false;
        const goalDueDate = parseISOStrict(goal.dueDate);
        if (!goalDueDate) return false;
        const timeLeftDetails = calculateTimeLeft(goal.dueDate);
        if (!timeLeftDetails || timeLeftDetails.isPastDue) return false;
        if (calculateGoalProgress(goal) >= 100) return false;
        return true;
      })
      .map(goal => ({
        id: goal.id,
        name: goal.name,
        dueDate: goal.dueDate!,
        type: 'goal' as 'goal',
        goalHighPriority: goal.highPriority,
        progress: calculateGoalProgress(goal),
      }));

    return mappedGoals.sort((a, b) => {
      const aIsHighPriority = a.goalHighPriority;
      const bIsHighPriority = b.goalHighPriority;

      if (aIsHighPriority && !bIsHighPriority) return -1;
      if (!aIsHighPriority && bIsHighPriority) return 1;

      const dueDateA = parseISOStrict(a.dueDate)!;
      const dueDateB = parseISOStrict(b.dueDate)!;
      return dueDateA.getTime() - dueDateB.getTime();
    });
  }, [goals, isClient]);


  const handleTouchStart = (e: React.TouchEvent) => {
    // Check for two-finger touch
    if (e.touches.length === 2) {
      setTouchStartX(e.touches[0].clientX);
    } else {
      setTouchStartX(null); // Reset if not a two-finger touch
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) {
      // Gesture didn't start with two fingers, so ignore.
      return;
    }

    // Use the first of the "changed" touches to determine the end position.
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const swipeThreshold = 50; // Minimum swipe distance in pixels

    if (deltaX > swipeThreshold) {
      // Swipe Right -> Go to Goals page
      router.push('/goals');
    } else if (deltaX < -swipeThreshold) {
      // Swipe Left -> Go to Timetable page
      router.push('/timetable');
    }

    // Reset touch start position regardless of whether a swipe was detected.
    // This completes the gesture.
    setTouchStartX(null);
  };

    const handleAddTask = (taskData: Omit<Task, 'id'>) => {
        calendarRef.current?.addTask(taskData);
        setIsFormOpen(false); // Close the dialog after adding
    };
  
  if (authLoading || !isDataLoaded) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleTimerDragEnd}>
      <div
        className="flex min-h-screen flex-col items-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <header
          className={cn(
            "bg-background/95 backdrop-blur-sm border-b shadow-sm w-full sticky top-0 z-40",
            "flex flex-col"
          )}
        >
          <div className="relative flex justify-center items-center w-full px-4 h-12 md:h-14">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
               <Sheet open={isThemeSheetOpen} onOpenChange={setIsThemeSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10"
                    aria-label="Change theme color"
                  >
                    <Palette className="h-5 w-5" />
                    <span className="hidden md:inline ml-2">Theme</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[320px]" showOverlay={false}>
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle className="text-lg">Theme Settings</SheetTitle>
                  </SheetHeader>
                  <div className="p-4 space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Mode</Label>
                      {isClient && theme && (
                          <Tabs
                            value={theme === 'system' ? 'light' : theme}
                            onValueChange={setTheme}
                            className="w-full"
                          >
                            <TabsList className="grid w-full grid-cols-2 h-9 p-0.5">
                              <TabsTrigger value="light" className="text-xs h-7 px-2">Light</TabsTrigger>
                              <TabsTrigger value="dark" className="text-xs h-7 px-2">Dark</TabsTrigger>
                            </TabsList>
                          </Tabs>
                      )}
                    </div>
                    <Separator />
                    <HueSlider hue={hue} setHue={setHue} />
                    <Separator />
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Presets</Label>
                        <ThemePresets setHue={setHue} currentHue={hue} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                variant="ghost"
                className="h-9 w-9 md:h-10 md:w-10 text-primary hover:bg-primary/10"
                aria-label="Show welcome message"
                onClick={() => setIsWelcomeOpen(true)}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
              WeekWise.
            </h1>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <AuthButton />
            </div>
          </div>

          <nav className="flex justify-center items-center w-full py-2 space-x-1 md:space-x-2 border-t-[0.5px]">
              <Link
                href="/detailed-view"
                className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")}
                aria-label="Go to detailed view"
              >
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Detailed View</span>
              </Link>
              <Link
                 href="/study-tracker"
                 className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")}
                 aria-label="Go to study tracker"
              >
                  <BookOpen className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Study</span>
              </Link>
              <Link
                 href="/timetable"
                 className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")}
                 aria-label="Go to timetable importer"
              >
                  <CalendarClock className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Timetable</span>
              </Link>
              <Link
                href="/goals"
                className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")}
                aria-label="View goals"
              >
                  <Target className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Goals</span>
              </Link>
              <Sheet open={isBookmarkListOpen} onOpenChange={setIsBookmarkListOpen}>
                  <SheetTrigger asChild>
                      <Button variant="ghost" className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")} aria-label="View bookmarks">
                          <BookmarkIcon className="h-5 w-5" />
                          <span className="ml-2 hidden md:inline">Bookmarks</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                      <div className="p-4 border-b shrink-0">
                          <h3 className="text-lg font-semibold leading-none tracking-tight text-primary">Bookmarks</h3>
                      </div>
                      <BookmarkListSheet />
                  </SheetContent>
              </Sheet>
              <Button
                  variant="ghost"
                  className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")}
                  aria-label="Toggle Pomodoro Timer"
                  onClick={() => setIsTimerVisible(!isTimerVisible)}
              >
                  <TimerIcon className="h-5 w-5" />
                  <span className="ml-2 hidden md:inline">Timer</span>
              </Button>
              <Sheet open={isTaskListOpen} onOpenChange={setIsTaskListOpen}>
                  <SheetTrigger asChild>
                      <Button variant="ghost" className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary bg-primary/5 hover:bg-primary/20 dark:hover:text-primary-foreground")} aria-label="Open scratchpad">
                          <List className="h-5 w-5" />
                          <span className="ml-2 hidden md:inline">Scratchpad</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                      <div className="p-4 border-b shrink-0">
                          <h3 className="text-lg font-semibold leading-none tracking-tight text-primary">Scratchpad</h3>
                      </div>
                      <TaskListSheet />
                  </SheetContent>
              </Sheet>
          </nav>
        </header>

        <main
          className="flex-grow w-full flex-col items-center justify-start p-2 md:p-4 bg-secondary/30 pt-4 md:pt-6"
        >
          <div className="grid grid-cols-12 gap-4 w-full max-w-[1800px] mx-auto">
            {/* Left Column: Goal of the Week & Upcoming */}
            <div className="col-span-12 wide:col-span-2 space-y-4">
              <GoalOfWeekEditor
                currentDisplayDate={currentDisplayDate}
                goalsByWeek={goalsByWeek}
                setGoalsByWeek={setGoalsByWeek}
              />
              <TopTaskBar
               items={upcomingItemsForBar}
               toggleGoalPriority={toggleGoalPriority}
              />
            </div>
            
            {/* Center Column: Calendar */}
            <div className="col-span-12 wide:col-span-8">
                <CalendarView
                    ref={calendarRef}
                    currentDisplayDate={currentDisplayDate}
                    setCurrentDisplayDate={setCurrentDisplayDate}
                />
            </div>

            {/* Right Column: Bookmarks */}
            <div className="col-span-12 wide:col-span-2">
               <Card className="h-full">
                <div className="p-4 border-b shrink-0">
                    <h3 className="text-lg font-semibold leading-none tracking-tight text-primary">Bookmarks</h3>
                </div>
                <BookmarkListSheet />
               </Card>
            </div>
          </div>
          
          {isClient && isTimerVisible && (
            <PomodoroTimer
              position={timerPosition}
              onClose={() => setIsTimerVisible(false)}
            />
          )}

          <TodaysTasksDialog
              isOpen={isTodaysTasksDialogOpen}
              onClose={() => setIsTodaysTasksDialogOpen(false)}
              tasks={[]}
          />

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                        aria-label="Add new task"
                    >
                        <Plus className="h-7 w-7" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-primary">Add New Task</DialogTitle>
                        <DialogDescription>
                            Fill out the details for your new task below.
                        </DialogDescription>
                    </DialogHeader>
                    <TaskForm
                        addTask={handleAddTask}
                        onTaskAdded={() => setIsFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

          <Dialog open={isWelcomeOpen} onOpenChange={setIsWelcomeOpen}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Welcome to WeekWise</DialogTitle>
                      <DialogDescription>
                          This is your personal planner to organize your life, track your goals, and manage your time effectively. Use the AI to quickly add tasks, view your schedule in different formats, and stay on top of your deadlines.
                      </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                      <Button onClick={() => setIsWelcomeOpen(false)}>Get Started</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
        </main>
      </div>
    </DndContext>
  );
}

    