
// src/app/goals/page.tsx
"use client";

import type * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import useLocalStorage from '@/hooks/use-local-storage';
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PlusCircle, ArrowLeft, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn, truncateText } from '@/lib/utils';
import type { Subtask, Goal, Task } from '@/lib/types';
import { TaskForm } from '@/components/TaskForm'; // To create tasks from subtasks
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as FormDialogTitle, // Alias to avoid conflict with CardTitle
} from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';


export default function GoalsPage() {
    const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
    const [newGoalName, setNewGoalName] = useState('');
    const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});
    const { toast } = useToast();

    // State for TaskForm dialog when creating task from subtask
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
    const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []); // Access tasks for adding

    const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00');
        if (isNaN(date.getTime())) {
            console.error("Invalid date string received:", dateString);
            return null;
        }
        return date;
    }, []);

    const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = {
           ...newTaskData,
           id: crypto.randomUUID(),
           files: newTaskData.files ?? [],
           details: newTaskData.details ?? '',
           dueDate: newTaskData.dueDate,
           recurring: newTaskData.recurring ?? false,
           highPriority: newTaskData.highPriority ?? false,
           exceptions: [],
           color: newTaskData.color,
       };
       setTasks((prevTasks) => {
           const updatedTasks = [...prevTasks, newTask];
           updatedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date);
               const dateB = parseISOStrict(b.date);
               if (!dateA && !dateB) return 0;
               if (!dateA) return 1;
               if (!dateB) return -1;
               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;
               if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
               return 0;
           });
           return updatedTasks;
       });
       const taskDate = parseISOStrict(newTaskData.date);
       toast({
           title: "Task Added",
           description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.`,
       });
       setIsTaskFormOpen(false);
       setPrefilledTaskData(null);
    }, [setTasks, toast, parseISOStrict]);


    const addGoal = useCallback(() => {
        if (!newGoalName.trim()) {
            toast({ title: "Missing Goal Name", description: "Please provide a name for the goal.", variant: "destructive" });
            return;
        }
        const newGoal: Goal = { id: crypto.randomUUID(), name: newGoalName.trim(), subtasks: [] };
        setGoals(prev => [...prev, newGoal]);
        setNewGoalName('');
        toast({ title: "Goal Added", description: `"${newGoal.name}" added successfully.` });
    }, [newGoalName, setGoals, toast]);

    const deleteGoal = useCallback((id: string) => {
        const goalToDelete = goals.find(g => g.id === id);
        setGoals(prev => prev.filter(goal => goal.id !== id));
        if (goalToDelete) {
            toast({ title: "Goal Removed", description: `"${goalToDelete.name}" removed.`, variant: "destructive" });
        }
    }, [goals, setGoals, toast]);

    const handleSubtaskInputChange = (goalId: string, value: string) => {
        setNewSubtaskInputs(prev => ({ ...prev, [goalId]: value }));
    };

    const addSubtask = useCallback((goalId: string) => {
        const subtaskName = newSubtaskInputs[goalId]?.trim();
        if (!subtaskName) {
            toast({ title: "Missing Subtask Name", description: "Please provide a name for the subtask.", variant: "destructive" });
            return;
        }
        const newSubtask: Subtask = { id: crypto.randomUUID(), name: subtaskName, completed: false };
        setGoals(prevGoals => prevGoals.map(goal => goal.id === goalId ? { ...goal, subtasks: [...goal.subtasks, newSubtask] } : goal));
        setNewSubtaskInputs(prev => ({ ...prev, [goalId]: '' }));
        toast({ title: "Subtask Added", description: `Subtask "${newSubtask.name}" added.` });
    }, [newSubtaskInputs, setGoals, toast]);

    const deleteSubtask = useCallback((goalId: string, subtaskId: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const subtaskToDelete = goal.subtasks.find(st => st.id === subtaskId);
                if (subtaskToDelete) {
                    toast({ title: "Subtask Removed", description: `Subtask "${subtaskToDelete.name}" removed.`, variant: "destructive" });
                }
                return { ...goal, subtasks: goal.subtasks.filter(subtask => subtask.id !== subtaskId) };
            }
            return goal;
        }));
    }, [setGoals, toast]);

    const toggleSubtaskCompletion = useCallback((goalId: string, subtaskId: string) => {
        setGoals(prevGoals => prevGoals.map(goal => goal.id === goalId ? { ...goal, subtasks: goal.subtasks.map(subtask => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask) } : goal));
    }, [setGoals]);

    const calculateProgress = (goal: Goal): number => {
        if (goal.subtasks.length === 0) return 0;
        const completedCount = goal.subtasks.filter(st => st.completed).length;
        return Math.round((completedCount / goal.subtasks.length) * 100);
    };

    const handleKeyPressGoal = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') addGoal();
    };

    const handleKeyPressSubtask = (event: React.KeyboardEvent<HTMLInputElement>, goalId: string) => {
        if (event.key === 'Enter') addSubtask(goalId);
    };

    const handleCreateTaskFromSubtask = useCallback((subtask: Subtask) => {
        setPrefilledTaskData({ name: subtask.name });
        setIsTaskFormOpen(true);
    }, []);

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <Card className="shadow-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <Link href="/" passHref legacyBehavior>
                            <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10">
                                <ArrowLeft className="h-5 w-5" />
                                <span className="sr-only">Back to Calendar</span>
                            </Button>
                        </Link>
                        <div>
                            <CardTitle className="text-2xl text-primary">Manage Your Goals</CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                Create goals, break them into subtasks, and track your progress.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                    {/* Input Section for New Goal */}
                    <div className="p-4 border rounded-md bg-secondary/30 shadow-sm">
                        <Label htmlFor="goal-name" className="text-sm font-medium text-muted-foreground mb-1 block">
                            New Goal Name
                        </Label>
                        <div className="flex space-x-2">
                            <Input
                                id="goal-name"
                                value={newGoalName}
                                onChange={(e) => setNewGoalName(e.target.value)}
                                placeholder="e.g., Complete online course"
                                className="h-10 text-base md:text-sm flex-grow"
                                onKeyPress={handleKeyPressGoal}
                            />
                            <Button onClick={addGoal} size="default" className="h-10">
                                <Plus className="mr-2 h-4 w-4" /> Add Goal
                            </Button>
                        </div>
                    </div>

                    {/* Goals List */}
                    {goals.length === 0 ? (
                        <p className="text-base text-muted-foreground text-center py-8">No goals yet. Add one above to get started!</p>
                    ) : (
                        <ScrollArea className="max-h-[calc(100vh-300px)]"> {/* Adjust max height as needed */}
                             <div className="space-y-4 pr-2">
                                <Accordion type="multiple" className="w-full">
                                    {goals.map((goal) => {
                                        const progress = calculateProgress(goal);
                                        return (
                                            <AccordionItem key={goal.id} value={goal.id} className="border-none">
                                                <Card className="overflow-hidden shadow-md border hover:shadow-lg transition-shadow duration-200 bg-card">
                                                    <CardHeader className="p-0 flex flex-row items-center justify-between space-x-2 hover:bg-muted/30 rounded-t-md transition-colors">
                                                        <AccordionTrigger className="flex-grow p-4 text-base font-medium text-left text-primary hover:no-underline">
                                                            <div className="flex items-center space-x-3 min-w-0">
                                                                <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={goal.name}>{truncateText(goal.name, 40)}</span>
                                                                <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs shrink-0 h-6 px-2.5">{progress}%</Badge>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-destructive hover:bg-destructive/10 mr-3 shrink-0"
                                                            onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
                                                            aria-label={`Delete goal ${goal.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </CardHeader>
                                                    <AccordionContent>
                                                        <CardContent className="p-4 space-y-4 border-t">
                                                            <Progress value={progress} className="h-2.5" />
                                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                                                {goal.subtasks.length === 0 ? (
                                                                    <p className="text-sm text-muted-foreground italic">No subtasks yet. Add one below.</p>
                                                                ) : (
                                                                    goal.subtasks.map(subtask => (
                                                                        <div key={subtask.id} className="flex items-center justify-between space-x-2 bg-background/70 p-2.5 rounded-md border shadow-sm">
                                                                            <div className="flex items-center space-x-2.5 flex-grow min-w-0">
                                                                                <Checkbox
                                                                                    id={`subtask-${subtask.id}`}
                                                                                    checked={subtask.completed}
                                                                                    onCheckedChange={() => toggleSubtaskCompletion(goal.id, subtask.id)}
                                                                                    className="shrink-0 h-5 w-5"
                                                                                    aria-label={`Mark subtask ${subtask.name} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                                                                                />
                                                                                <Label
                                                                                    htmlFor={`subtask-${subtask.id}`}
                                                                                    className={cn("text-sm truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer", subtask.completed && "line-through text-muted-foreground")}
                                                                                    title={subtask.name}
                                                                                >
                                                                                    {truncateText(subtask.name, 35)}
                                                                                </Label>
                                                                            </div>
                                                                            <div className="flex items-center shrink-0 space-x-1.5">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-primary border-primary hover:bg-primary/10"
                                                                                    onClick={() => handleCreateTaskFromSubtask(subtask)}
                                                                                    aria-label={`Create calendar task for ${subtask.name}`}
                                                                                    title="Create Calendar Task"
                                                                                >
                                                                                    <PlusCircle className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                                                    onClick={() => deleteSubtask(goal.id, subtask.id)}
                                                                                    aria-label={`Delete subtask ${subtask.name}`}
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                            <div className="flex space-x-2 pt-3 border-t">
                                                                <Input
                                                                    value={newSubtaskInputs[goal.id] || ''}
                                                                    onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                                                                    placeholder="Add a subtask..."
                                                                    className="h-9 text-sm flex-grow"
                                                                    onKeyPress={(e) => handleKeyPressSubtask(e, goal.id)}
                                                                />
                                                                <Button onClick={() => addSubtask(goal.id)} size="sm" className="h-9 px-3">
                                                                    <Plus className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </AccordionContent>
                                                </Card>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                             </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* Dialog for TaskForm */}
            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                   <FormDialogTitle className="text-primary">
                     {prefilledTaskData ? "Create Task from Subtask" : "Add New Task"}
                   </FormDialogTitle>
                 </DialogHeader>
                 <TaskForm
                   addTask={addTask}
                   onTaskAdded={() => {
                     setIsTaskFormOpen(false);
                     setPrefilledTaskData(null);
                   }}
                   initialData={prefilledTaskData}
                  />
              </DialogContent>
            </Dialog>
        </div>
    );
}
