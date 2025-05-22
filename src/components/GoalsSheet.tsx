
"use client";

import type * as React from 'react';
import { useState, useCallback } from 'react'; // Removed useMemo as it's not used here
import Link from 'next/link'; // Added Link import
import useLocalStorage from '@/hooks/use-local-storage';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Card imports might be simplified if UI changes
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PlusCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn, truncateText } from '@/lib/utils';
import type { Subtask, Goal } from '@/lib/types';

interface GoalsSheetProps {
  // This component might no longer need onCreateTaskFromSubtask if the full page handles it,
  // or it could still be used if the sheet is kept as a quick-add/view feature.
  // For now, assuming it's a standalone display or simple interaction component.
  // If it needs to trigger the main page's task form, the prop is still relevant.
  onCreateTaskFromSubtask?: (subtask: Subtask) => void;
}

// This component is now simplified as the main functionality moves to /goals/page.tsx
// It can be used as a read-only display or a quick-access version if desired later.
// For now, making it a simple display or placeholder.
export function GoalsSheet({ onCreateTaskFromSubtask }: GoalsSheetProps) {
    const [goals] = useLocalStorage<Goal[]>('weekwise-goals', []);
    const { toast } = useToast(); // Kept for potential future interactions

    const calculateProgress = (goal: Goal): number => {
        let totalSubtasks = 0;
        let completedSubtasks = 0;
        const countSubtasksRecursive = (subtasks: Subtask[]) => {
            subtasks.forEach(subtask => {
                totalSubtasks++;
                if (subtask.completed) {
                    completedSubtasks++;
                }
                if (subtask.subtasks && subtask.subtasks.length > 0) {
                    countSubtasksRecursive(subtask.subtasks);
                }
            });
        };
        if (goal.subtasks && goal.subtasks.length > 0) {
            countSubtasksRecursive(goal.subtasks);
        }
        if (totalSubtasks === 0) return 0;
        return Math.round((completedSubtasks / totalSubtasks) * 100);
    };

    return (
        <div className="flex flex-col flex-grow p-4 pt-0 space-y-4 overflow-hidden">
            <div className="p-4 border-b shrink-0 bg-secondary/30 rounded-b-md">
                 <p className="text-sm text-muted-foreground">
                    View and manage your detailed goals on the dedicated <Link href="/goals" className="text-primary underline hover:text-primary/80">Goals Page</Link>.
                 </p>
            </div>

            <ScrollArea className="flex-grow">
                <div className="p-4 space-y-4">
                    {goals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center pt-4">No goals yet. Add them on the Goals page!</p>
                    ) : (
                        <Accordion type="multiple" className="w-full">
                            {goals.map((goal) => {
                                const progress = calculateProgress(goal);
                                return (
                                    <AccordionItem key={goal.id} value={goal.id} className="border-none mb-4">
                                        <Card className="overflow-hidden shadow-md border hover:shadow-lg transition-shadow duration-200 bg-card">
                                            <CardHeader className="p-0 flex flex-row items-center justify-between space-x-2 hover:bg-muted/30 rounded-t-md transition-colors">
                                                <AccordionTrigger className="flex-grow p-4 text-base font-medium text-left text-primary hover:no-underline">
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center space-x-3">
                                                            <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={goal.name}>{truncateText(goal.name, 40)}</span>
                                                            <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs shrink-0 h-6 px-2.5">{progress}%</Badge>
                                                        </div>
                                                        {goal.dueDate && (
                                                            <span className="text-xs text-muted-foreground mt-1">
                                                                Due: {goal.dueDate} {/* Consider formatting this date */}
                                                            </span>
                                                        )}
                                                    </div>
                                                </AccordionTrigger>
                                                {/* Optionally add delete or other actions here if needed in the sheet */}
                                            </CardHeader>
                                            <AccordionContent>
                                                <CardContent className="p-4 space-y-2 border-t bg-muted/20">
                                                    <Progress value={progress} className="h-2.5" />
                                                    {goal.subtasks.length > 0 && (
                                                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                            {goal.subtasks.map(subtask => (
                                                                <div key={subtask.id} className="flex items-center space-x-2 bg-background p-1.5 rounded border text-xs">
                                                                    <Checkbox id={`sheet-subtask-${subtask.id}`} checked={subtask.completed} disabled className="shrink-0"/>
                                                                    <Label htmlFor={`sheet-subtask-${subtask.id}`} className={cn("truncate", subtask.completed && "line-through text-muted-foreground")}>
                                                                        {truncateText(subtask.name, 25)}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {goal.subtasks.length === 0 && (
                                                         <p className="text-xs text-muted-foreground italic text-center py-1">No subtasks for this goal.</p>
                                                    )}
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
