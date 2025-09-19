
"use client";

import type * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle, Star } from 'lucide-react';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TodaysTasksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export function TodaysTasksDialog({ isOpen, onClose, tasks }: TodaysTasksDialogProps) {
  const today = new Date();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">
            Tasks for Today ({format(today, 'MMMM d')})
          </DialogTitle>
          <DialogDescription>
            Here is your list of tasks to complete today. Good luck!
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-2 py-4">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <Card key={task.id} className={cn("flex items-center p-3 shadow-sm", task.highPriority && "border-accent")}>
                  {task.highPriority ? (
                     <Star className="h-5 w-5 mr-3 text-accent fill-accent shrink-0" />
                  ) : (
                     <Circle className="h-5 w-5 mr-3 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-grow min-w-0">
                      <p className="font-medium truncate" title={task.name}>{task.name}</p>
                      {task.description && (
                         <p className="text-xs text-muted-foreground truncate" title={task.description}>
                            {task.description}
                         </p>
                      )}
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No tasks scheduled for today!</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Let's Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
