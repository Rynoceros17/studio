
"use client";

import type * as React from 'react';
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TaskListSheetProps {
    tasks: Task[];
    completedTasks: Set<string>;
    toggleTaskCompletion: (id: string) => void;
    deleteTask: (id: string) => void;
    parseISOStrict: (dateString: string | undefined) => Date | null; // Add parser function prop
}

export function TaskListSheet({
    tasks,
    completedTasks,
    toggleTaskCompletion,
    deleteTask,
    parseISOStrict, // Destructure parser function
}: TaskListSheetProps) {

    const handleToggle = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering other clicks
        toggleTaskCompletion(id);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering other clicks
        deleteTask(id);
    };

    return (
        <ScrollArea className="h-[calc(100vh-65px)]"> {/* Adjust height based on header */}
            <div className="p-4 space-y-3">
                {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No tasks yet.</p>
                ) : (
                    tasks.map((task) => {
                        const isCompleted = completedTasks.has(task.id);
                        const taskDate = parseISOStrict(task.date); // Use the passed parser function
                        const formattedDate = taskDate ? format(taskDate, 'EEE, MMM d') : 'No Date';

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors duration-200 cursor-pointer",
                                    isCompleted && "opacity-60 bg-muted"
                                )}
                                // Optionally add onClick handler for viewing details later
                                // onClick={() => console.log("View details for:", task.id)}
                            >
                                <div className="flex items-center space-x-3 flex-grow min-w-0">
                                     <Checkbox
                                        id={`list-task-${task.id}`}
                                        checked={isCompleted}
                                        onCheckedChange={() => toggleTaskCompletion(task.id)} // No event needed for direct handler
                                        aria-label={`Mark task ${task.name} as ${isCompleted ? 'incomplete' : 'complete'}`}
                                        className="shrink-0"
                                        onClick={(e) => e.stopPropagation()} // Prevent card click
                                    />
                                    <div className="flex-grow min-w-0">
                                        <p className={cn("text-sm font-medium truncate", isCompleted && "line-through")} title={task.name}>
                                            {task.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formattedDate}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={(e) => handleDelete(task.id, e)}
                                    aria-label={`Delete task ${task.name}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </ScrollArea>
    );
}
