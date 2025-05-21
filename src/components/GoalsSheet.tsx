
"use client";

import type * as React from 'react';
import { useState, useCallback } from 'react'; // Removed useMemo as it's not used here
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
        if (goal.subtasks.length === 0) return 0;
        const completedCount = goal.subtasks.filter(st => st.completed).length;
        return Math.round((completedCount / goal.subtasks.length) * 100);
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
                                    <AccordionItem key={goal.id} value={goal.id}>
                                        <Card className="overflow-hidden shadow-sm border mb-2 bg-card">
                                            <AccordionTrigger className="w-full p-3 text-sm font-medium text-left hover:bg-muted/30 rounded-t-md transition-colors">
                                                <div className="flex items-center justify-between space-x-2 min-w-0">
                                                    <span className="truncate" title={goal.name}>{truncateText(goal.name, 30)}</span>
                                                    <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs shrink-0">{progress}%</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <CardContent className="p-3 space-y-2 border-t">
                                                    <Progress value={progress} className="h-2" />
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
