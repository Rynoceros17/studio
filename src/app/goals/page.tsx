
// src/app/goals/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import useLocalStorage from '@/hooks/use-local-storage';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PlusCircle, ArrowLeft, Save, CornerDownRight, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn, truncateText } from '@/lib/utils';
import type { Subtask, Goal, Task } from '@/lib/types';
import { TaskForm } from '@/components/TaskForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as FormDialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';

// Helper function to recursively find and update a subtask
const findAndOperateOnSubtask = (
  subtasks: Subtask[],
  targetId: string,
  operation: (subtask: Subtask) => Subtask | null // Return null to delete
): Subtask[] => {
  return subtasks.map(st => {
    if (st.id === targetId) {
      return operation(st);
    }
    if (st.subtasks) {
      const updatedChildren = findAndOperateOnSubtask(st.subtasks, targetId, operation);
      // If children array changed, it means the target was found and operated on (or a child was)
      if (updatedChildren !== st.subtasks) {
          return { ...st, subtasks: updatedChildren.filter(Boolean) as Subtask[] };
      }
    }
    return st;
  }).filter(Boolean) as Subtask[];
};

// Helper function to recursively add a subtask to a parent
const addSubtaskToParentRecursive = (
    subtasks: Subtask[],
    parentId: string,
    newSubtask: Subtask
): Subtask[] => {
    return subtasks.map(st => {
        if (st.id === parentId) {
            return { ...st, subtasks: [...(st.subtasks || []), newSubtask] };
        }
        if (st.subtasks) {
            return { ...st, subtasks: addSubtaskToParentRecursive(st.subtasks, parentId, newSubtask) };
        }
        return st;
    });
};


export default function GoalsPage() {
    const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
    const [newGoalName, setNewGoalName] = useState('');
    const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({}); // Key: parentId (goalId or subtaskId)
    const { toast } = useToast();

    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
    const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);

    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
    const [showAddChildInputFor, setShowAddChildInputFor] = useState<string | null>(null); // State for toggling child input
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);


    const toggleSubtaskExpansion = (subtaskId: string) => {
        setExpandedSubtasks(prev => ({ ...prev, [subtaskId]: !prev[subtaskId] }));
    };


    const parseISOStrict = useCallback((dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00');
        if (isNaN(date.getTime())) return null;
        return date;
    }, []);

    const addTask = useCallback((newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = { ...newTaskData, id: crypto.randomUUID(), files: newTaskData.files ?? [], details: newTaskData.details ?? '', dueDate: newTaskData.dueDate, recurring: newTaskData.recurring ?? false, highPriority: newTaskData.highPriority ?? false, exceptions: [], color: newTaskData.color };
       setTasks(prevTasks => {
           const updatedTasks = [...prevTasks, newTask];
           updatedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date); const dateB = parseISOStrict(b.date);
               if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;
               if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
               return 0;
           });
           return updatedTasks;
       });
       const taskDate = parseISOStrict(newTaskData.date);
       toast({ title: "Task Added", description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.` });
       setIsTaskFormOpen(false); setPrefilledTaskData(null);
    }, [setTasks, toast, parseISOStrict]);

    const addGoal = useCallback(() => {
        if (!newGoalName.trim()) {
            toast({ title: "Missing Goal Name", description: "Please provide a name for the goal.", variant: "destructive" }); return;
        }
        const newGoal: Goal = { id: crypto.randomUUID(), name: newGoalName.trim(), subtasks: [] };
        setGoals(prev => [...prev, newGoal]);
        setNewGoalName('');
        toast({ title: "Goal Added", description: `"${newGoal.name}" added successfully.` });
    }, [newGoalName, setGoals, toast]);

    const deleteGoal = useCallback((id: string) => {
        const goalToDelete = goals.find(g => g.id === id);
        setGoals(prev => prev.filter(goal => goal.id !== id));
        if (goalToDelete) toast({ title: "Goal Removed", description: `"${goalToDelete.name}" removed.`, variant: "destructive" });
    }, [goals, setGoals, toast]);

    const handleSubtaskInputChange = (parentId: string, value: string) => {
        setNewSubtaskInputs(prev => ({ ...prev, [parentId]: value }));
    };

    const addSubtask = useCallback((goalId: string, parentSubtaskId?: string) => {
        const parentId = parentSubtaskId || goalId;
        const subtaskName = newSubtaskInputs[parentId]?.trim();
        if (!subtaskName) {
            toast({ title: "Missing Subtask Name", description: "Please provide a name for the subtask.", variant: "destructive" }); return;
        }
        const newSubtask: Subtask = { id: crypto.randomUUID(), name: subtaskName, completed: false, subtasks: [] };

        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                if (!parentSubtaskId) { // Adding to goal's top-level subtasks
                    return { ...goal, subtasks: [...goal.subtasks, newSubtask] };
                } else { // Adding to a nested subtask
                    const updatedSubtasks = addSubtaskToParentRecursive(goal.subtasks, parentSubtaskId, newSubtask);
                    return { ...goal, subtasks: updatedSubtasks };
                }
            }
            return goal;
        }));
        setNewSubtaskInputs(prev => ({ ...prev, [parentId]: '' })); // Clear input for parent
        toast({ title: "Subtask Added", description: `Subtask "${newSubtask.name}" added.` });
        setShowAddChildInputFor(null); // Hide the input form after adding
        if (parentSubtaskId) {
            setExpandedSubtasks(prev => ({ ...prev, [parentSubtaskId]: true })); // Ensure parent is expanded
        }
    }, [newSubtaskInputs, setGoals, toast, setExpandedSubtasks, setShowAddChildInputFor]);


    const deleteSubtaskRecursive = (subtasks: Subtask[], subtaskIdToDelete: string): { updatedSubtasks: Subtask[], foundAndDeleted: boolean, deletedSubtaskName?: string } => {
        let foundAndDeleted = false;
        let deletedName: string | undefined;
        const filteredSubtasks = subtasks.filter(st => {
            if (st.id === subtaskIdToDelete) {
                foundAndDeleted = true;
                deletedName = st.name;
                return false;
            }
            return true;
        });

        if (foundAndDeleted) {
            return { updatedSubtasks: filteredSubtasks, foundAndDeleted: true, deletedSubtaskName: deletedName };
        }

        // If not found at current level, recurse into children
        const result = { updatedSubtasks: [] as Subtask[], foundAndDeleted: false, deletedSubtaskName: undefined as string | undefined };
        result.updatedSubtasks = subtasks.map(st => {
            if (st.subtasks) {
                const childResult = deleteSubtaskRecursive(st.subtasks, subtaskIdToDelete);
                if (childResult.foundAndDeleted) {
                    foundAndDeleted = true; // Propagate found status
                    deletedName = childResult.deletedSubtaskName;
                    return { ...st, subtasks: childResult.updatedSubtasks };
                }
            }
            return st;
        });
        result.foundAndDeleted = foundAndDeleted;
        result.deletedSubtaskName = deletedName;
        return result;
    };


    const deleteSubtask = useCallback((goalId: string, subtaskIdToDelete: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const { updatedSubtasks, foundAndDeleted, deletedSubtaskName } = deleteSubtaskRecursive(goal.subtasks, subtaskIdToDelete);
                if (foundAndDeleted && deletedSubtaskName) {
                     toast({ title: "Subtask Removed", description: `Subtask "${deletedSubtaskName}" and its children removed.`, variant: "destructive" });
                }
                return { ...goal, subtasks: updatedSubtasks };
            }
            return goal;
        }));
    }, [setGoals, toast]);


    const toggleSubtaskCompletion = useCallback((goalId: string, subtaskIdToToggle: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const newSubtasks = findAndOperateOnSubtask(goal.subtasks, subtaskIdToToggle, st => ({
                    ...st,
                    completed: !st.completed
                }));
                return { ...goal, subtasks: newSubtasks };
            }
            return goal;
        }));
    }, [setGoals]);


    const isSubtaskEffectivelyComplete = useCallback((subtask: Subtask): boolean => {
        if (!subtask.completed) return false;
        if (subtask.subtasks && subtask.subtasks.length > 0) {
            return subtask.subtasks.every(child => isSubtaskEffectivelyComplete(child));
        }
        return subtask.completed;
    }, []);

    const calculateProgress = useCallback((goal: Goal): number => {
        if (goal.subtasks.length === 0) return 0;
        const effectivelyCompletedCount = goal.subtasks.filter(st => isSubtaskEffectivelyComplete(st)).length;
        return Math.round((effectivelyCompletedCount / goal.subtasks.length) * 100);
    }, [isSubtaskEffectivelyComplete]);


    const handleKeyPressGoal = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') addGoal(); };
    const handleKeyPressSubtask = (event: React.KeyboardEvent<HTMLInputElement>, goalId: string, parentSubtaskId?: string) => {
        if (event.key === 'Enter') {
            addSubtask(goalId, parentSubtaskId);
        }
    };

    const handleCreateTaskFromSubtask = useCallback((subtask: Subtask) => {
        setPrefilledTaskData({ name: subtask.name });
        setIsTaskFormOpen(true);
    }, []);


    const renderSubtasks = (subtasks: Subtask[], goalId: string, depth: number): JSX.Element[] => {
        return subtasks.map(subtask => {
            let bgClass = '';
            let textColorClass = 'text-card-foreground'; // Default dark grey for active tasks
            let expandChevronColorClass = 'text-card-foreground'; // Default dark grey

            if (subtask.completed) {
                bgClass = 'bg-muted opacity-70';
                textColorClass = 'text-muted-foreground';
                expandChevronColorClass = 'text-muted-foreground';
            } else if (depth === 0) { // Parent subtasks
                bgClass = 'bg-muted'; // Very Light Purple (solid)
                // textColorClass is already 'text-card-foreground' by default (dark grey)
                // expandChevronColorClass is already 'text-card-foreground' by default (dark grey)
            } else if (depth === 1) { // Child subtasks
                bgClass = 'bg-muted/60'; // Very pale purple (opacity)
                // textColorClass is already 'text-card-foreground' by default (dark grey)
                // expandChevronColorClass is already 'text-card-foreground' by default (dark grey)
            } else { // Grandchild and deeper (depth >= 2)
                bgClass = 'bg-card'; // White
                // textColorClass is already 'text-card-foreground' by default (dark grey)
                // expandChevronColorClass is already 'text-card-foreground' by default (dark grey)
            }
            
            return (
                <React.Fragment key={subtask.id}>
                    <div
                        className={cn(
                            `flex items-center justify-between space-x-2 p-2.5 rounded-md border shadow-sm my-1`,
                            bgClass
                        )}
                    >
                        <div className="flex items-center space-x-2.5 flex-grow min-w-0">
                            {(subtask.subtasks && subtask.subtasks.length > 0) ? (
                                 <Button variant="ghost" size="icon" onClick={() => toggleSubtaskExpansion(subtask.id)} className={cn("h-6 w-6 shrink-0", expandChevronColorClass, `hover:bg-transparent hover:opacity-75` )}>
                                    {expandedSubtasks[subtask.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                            ) : (
                                <div className="w-6 shrink-0"></div> 
                            )}
                            <Checkbox
                                id={`subtask-${subtask.id}`}
                                checked={subtask.completed}
                                onCheckedChange={() => toggleSubtaskCompletion(goalId, subtask.id)}
                                className={cn(
                                    "shrink-0 h-5 w-5 border-primary", 
                                    "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                )}
                                aria-label={`Mark subtask ${subtask.name} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                            />
                            <Label
                                htmlFor={`subtask-${subtask.id}`}
                                className={cn(
                                    "text-sm truncate cursor-pointer",
                                    textColorClass,
                                    subtask.completed && "line-through"
                                )}
                                title={subtask.name}
                            >
                                {truncateText(subtask.name, 30)}
                            </Label>
                        </div>
                        <div className="flex items-center shrink-0 space-x-1.5">
                            <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                    "h-7 w-7 border-dashed",
                                    subtask.completed ? "text-muted-foreground cursor-not-allowed" : "text-card-foreground hover:border-primary hover:text-primary"
                                )}
                                onClick={() => !subtask.completed && setShowAddChildInputFor(subtask.id)}
                                aria-label={`Add child subtask to ${subtask.name}`}
                                title="Add Child Subtask"
                                disabled={subtask.completed}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                    "h-7 w-7",
                                    subtask.completed ? "text-muted-foreground border-muted cursor-not-allowed" : "text-primary border-primary hover:bg-primary/10"
                                )}
                                onClick={() => !subtask.completed && handleCreateTaskFromSubtask(subtask)}
                                aria-label={`Create calendar task for ${subtask.name}`}
                                title="Create Calendar Task"
                                disabled={subtask.completed}
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost" 
                                size="icon"
                                className={cn("h-7 w-7 text-destructive hover:bg-destructive/10")}
                                onClick={() => deleteSubtask(goalId, subtask.id)}
                                aria-label={`Delete subtask ${subtask.name}`}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <div className="my-1">
                        {showAddChildInputFor === subtask.id && (
                            <div className="flex space-x-2 items-center p-2 border rounded-md bg-card shadow">
                                <Input
                                    value={newSubtaskInputs[subtask.id] || ''}
                                    onChange={(e) => handleSubtaskInputChange(subtask.id, e.target.value)}
                                    placeholder="Add a child subtask..."
                                    className="h-8 text-xs flex-grow"
                                    onKeyPress={(e) => handleKeyPressSubtask(e, goalId, subtask.id)}
                                    autoFocus
                                />
                                <Button onClick={() => addSubtask(goalId, subtask.id)} size="sm" className="h-8 px-2.5 text-xs shrink-0">
                                    <CornerDownRight className="mr-1 h-3 w-3" /> Add
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-8 w-8 text-xs shrink-0">
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {subtask.subtasks && subtask.subtasks.length > 0 && expandedSubtasks[subtask.id] && (
                        renderSubtasks(subtask.subtasks, goalId, depth + 1)
                    )}
                </React.Fragment>
            );
        });
    };


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
                                Create goals, break them into subtasks (and sub-subtasks!), and track your progress.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                    <div className="p-4 border rounded-md bg-secondary/30 shadow-sm">
                        <Label htmlFor="goal-name" className="text-sm font-medium text-muted-foreground mb-1 block">New Goal Name</Label>
                        <div className="flex space-x-2">
                            <Input id="goal-name" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} placeholder="e.g., Complete online course" className="h-10 text-base md:text-sm flex-grow" onKeyPress={handleKeyPressGoal}/>
                            <Button onClick={addGoal} size="default" className="h-10"><Plus className="mr-2 h-4 w-4" /> Add Goal</Button>
                        </div>
                    </div>

                    {!isClient ? (
                         <p className="text-base text-muted-foreground text-center py-8">Loading goals...</p>
                    ) : goals.length === 0 ? (
                        <p className="text-base text-muted-foreground text-center py-8">No goals yet. Add one above to get started!</p>
                    ) : (
                        <ScrollArea className="max-h-[calc(100vh-300px)]">
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
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 mr-3 shrink-0" onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} aria-label={`Delete goal ${goal.name}`}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </CardHeader>
                                                    <AccordionContent>
                                                        <CardContent className="p-4 space-y-4 border-t bg-muted/20"> {/* Lighter background for content area */}
                                                            <Progress value={progress} className="h-2.5" />
                                                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                                                {goal.subtasks.length === 0 ? (
                                                                    <p className="text-sm text-muted-foreground italic text-center py-2">No subtasks yet. Add one below.</p>
                                                                ) : (
                                                                    renderSubtasks(goal.subtasks, goal.id, 0) // Start depth at 0 for top-level subtasks
                                                                )}
                                                            </div>
                                                            {/* Input for adding top-level subtask to the goal */}
                                                            <div className="flex space-x-2 pt-3 border-t mt-3">
                                                                <Input
                                                                    value={newSubtaskInputs[goal.id] || ''}
                                                                    onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                                                                    placeholder="Add a top-level subtask..."
                                                                    className="h-9 text-sm flex-grow bg-card" // Ensure input has distinct background
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

            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader><FormDialogTitle className="text-primary">{prefilledTaskData ? "Create Task from Subtask" : "Add New Task"}</FormDialogTitle></DialogHeader>
                 <TaskForm addTask={addTask} onTaskAdded={() => { setIsTaskFormOpen(false); setPrefilledTaskData(null); }} initialData={prefilledTaskData}/>
              </DialogContent>
            </Dialog>
        </div>
    );
}

