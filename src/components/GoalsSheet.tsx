
"use client";

import type * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Plus, Trash2, PlusCircle } from 'lucide-react'; // Added PlusCircle
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import type { Subtask, Goal } from '@/lib/types'; // Import types

interface GoalsSheetProps {
  onCreateTaskFromSubtask: (subtask: Subtask) => void; // Callback prop
}

export function GoalsSheet({ onCreateTaskFromSubtask }: GoalsSheetProps) {
    const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
    const [newGoalName, setNewGoalName] = useState('');
    const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({}); // { [goalId]: subtaskName }
    const { toast } = useToast();

    const addGoal = useCallback(() => {
        if (!newGoalName.trim()) {
            toast({
                title: "Missing Goal Name",
                description: "Please provide a name for the goal.",
                variant: "destructive",
            });
            return;
        }

        const newGoal: Goal = {
            id: crypto.randomUUID(),
            name: newGoalName.trim(),
            subtasks: [],
        };
        setGoals(prev => [...prev, newGoal]);
        setNewGoalName('');
        toast({
            title: "Goal Added",
            description: `"${newGoal.name}" added successfully.`,
        });
    }, [newGoalName, setGoals, toast]);

    const deleteGoal = useCallback((id: string) => {
        const goalToDelete = goals.find(g => g.id === id);
        setGoals(prev => prev.filter(goal => goal.id !== id));
        if (goalToDelete) {
            toast({
                title: "Goal Removed",
                description: `"${goalToDelete.name}" removed.`,
                variant: "destructive",
            });
        }
    }, [goals, setGoals, toast]);

    const handleSubtaskInputChange = (goalId: string, value: string) => {
        setNewSubtaskInputs(prev => ({ ...prev, [goalId]: value }));
    };

    const addSubtask = useCallback((goalId: string) => {
        const subtaskName = newSubtaskInputs[goalId]?.trim();
        if (!subtaskName) {
            toast({
                title: "Missing Subtask Name",
                description: "Please provide a name for the subtask.",
                variant: "destructive",
            });
            return;
        }

        const newSubtask: Subtask = {
            id: crypto.randomUUID(),
            name: subtaskName,
            completed: false,
        };

        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                return { ...goal, subtasks: [...goal.subtasks, newSubtask] };
            }
            return goal;
        }));

        // Clear the input for that specific goal
        setNewSubtaskInputs(prev => ({ ...prev, [goalId]: '' }));

        toast({
            title: "Subtask Added",
            description: `Subtask "${newSubtask.name}" added to goal.`,
        });
    }, [newSubtaskInputs, setGoals, toast]);

    const deleteSubtask = useCallback((goalId: string, subtaskId: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const subtaskToDelete = goal.subtasks.find(st => st.id === subtaskId);
                if (subtaskToDelete) {
                    toast({
                        title: "Subtask Removed",
                        description: `Subtask "${subtaskToDelete.name}" removed.`,
                        variant: "destructive",
                    });
                }
                return { ...goal, subtasks: goal.subtasks.filter(subtask => subtask.id !== subtaskId) };
            }
            return goal;
        }));
    }, [setGoals, toast]);

    const toggleSubtaskCompletion = useCallback((goalId: string, subtaskId: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                return {
                    ...goal,
                    subtasks: goal.subtasks.map(subtask => {
                        if (subtask.id === subtaskId) {
                            return { ...subtask, completed: !subtask.completed };
                        }
                        return subtask;
                    }),
                };
            }
            return goal;
        }));
    }, [setGoals]);

    const calculateProgress = (goal: Goal): number => {
        if (goal.subtasks.length === 0) return 0;
        const completedCount = goal.subtasks.filter(st => st.completed).length;
        return Math.round((completedCount / goal.subtasks.length) * 100);
    };

    const handleKeyPressGoal = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            addGoal();
        }
    };

    const handleKeyPressSubtask = (event: React.KeyboardEvent<HTMLInputElement>, goalId: string) => {
        if (event.key === 'Enter') {
            addSubtask(goalId);
        }
    };

    // Handle clicking the "Create Task" button for a subtask
    const handleCreateTaskClick = (subtask: Subtask) => {
        onCreateTaskFromSubtask(subtask); // Call the passed-in callback
    };


    return (
        <div className="flex flex-col flex-grow p-4 pt-0 space-y-4 overflow-hidden">

            {/* Input Section for New Goal */}
            <div className="p-4 border-b shrink-0 space-y-3 bg-secondary/30 rounded-b-md">
                <Label htmlFor="goal-name" className="text-xs font-medium text-muted-foreground">
                    New Goal Name
                </Label>
                <div className="flex space-x-2">
                    <Input
                        id="goal-name"
                        value={newGoalName}
                        onChange={(e) => setNewGoalName(e.target.value)}
                        placeholder="e.g., Learn React"
                        className="h-8 text-sm flex-grow"
                        onKeyPress={handleKeyPressGoal}
                    />
                    <Button onClick={addGoal} size="sm" className="h-8">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Goals List */}
            <ScrollArea className="flex-grow">
                <div className="p-4 space-y-4">
                    {goals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center pt-4">No goals yet. Add one above!</p>
                    ) : (
                        <Accordion type="multiple" className="w-full">
                            {goals.map((goal) => {
                                const progress = calculateProgress(goal);
                                return (
                                    <AccordionItem key={goal.id} value={goal.id}>
                                        <Card className="overflow-hidden shadow-sm border hover:shadow-md transition-shadow duration-200 mb-2">
                                            <CardHeader className="p-0 flex flex-row items-center justify-between space-x-2 hover:bg-muted/50 rounded-t-lg">
                                                <AccordionTrigger className="flex-grow p-3 text-sm font-medium text-left">
                                                    <div className="flex items-center space-x-2 min-w-0">
                                                        <span className="truncate" title={goal.name}>{goal.name}</span>
                                                        <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs shrink-0">{progress}%</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 mr-2 shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteGoal(goal.id);
                                                    }}
                                                    aria-label={`Delete goal ${goal.name}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </CardHeader>
                                            <AccordionContent>
                                                <CardContent className="p-3 space-y-3">
                                                    <Progress value={progress} className="h-2" />

                                                    {/* Subtask List */}
                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                        {goal.subtasks.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground">No subtasks yet.</p>
                                                        ) : (
                                                            goal.subtasks.map(subtask => (
                                                                <div key={subtask.id} className="flex items-center justify-between space-x-1 bg-background p-1.5 rounded border">
                                                                    <div className="flex items-center space-x-2 flex-grow min-w-0">
                                                                        <Checkbox
                                                                            id={`subtask-${subtask.id}`}
                                                                            checked={subtask.completed}
                                                                            onCheckedChange={() => toggleSubtaskCompletion(goal.id, subtask.id)}
                                                                            className="shrink-0"
                                                                            aria-label={`Mark subtask ${subtask.name} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                                                                        />
                                                                        <Label
                                                                            htmlFor={`subtask-${subtask.id}`}
                                                                            className={cn("text-xs truncate cursor-pointer", subtask.completed && "line-through text-muted-foreground")}
                                                                            title={subtask.name}
                                                                        >
                                                                            {subtask.name}
                                                                        </Label>
                                                                    </div>
                                                                    <div className="flex items-center shrink-0 space-x-1">
                                                                         {/* Create Task Button */}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 text-primary hover:bg-primary/10"
                                                                            onClick={() => handleCreateTaskClick(subtask)}
                                                                            aria-label={`Create calendar task for ${subtask.name}`}
                                                                            title="Create Calendar Task" // Tooltip for clarity
                                                                        >
                                                                            <PlusCircle className="h-3 w-3" />
                                                                        </Button>
                                                                        {/* Delete Subtask Button */}
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                                                            onClick={() => deleteSubtask(goal.id, subtask.id)}
                                                                            aria-label={`Delete subtask ${subtask.name}`}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    {/* Add Subtask Input */}
                                                    <div className="flex space-x-2 pt-2">
                                                        <Input
                                                            value={newSubtaskInputs[goal.id] || ''}
                                                            onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                                                            placeholder="Add a subtask..."
                                                            className="h-7 text-xs flex-grow"
                                                            onKeyPress={(e) => handleKeyPressSubtask(e, goal.id)}
                                                        />
                                                        <Button onClick={() => addSubtask(goal.id)} size="sm" className="h-7 px-2">
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </AccordionContent>
                                        </Card>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
