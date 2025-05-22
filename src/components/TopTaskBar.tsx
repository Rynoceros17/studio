
"use client";

import type * as React from 'react';
import { format, parseISO, isValid, differenceInDays, differenceInWeeks, startOfDay } from 'date-fns';
import { ChevronDown, ChevronUp, CalendarClock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft } from '@/lib/utils';

interface TaskWithDueDate extends Task {
  dueDate: string; // Ensure dueDate is present for tasks in this bar
}

interface TopTaskBarProps {
  tasks: TaskWithDueDate[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function TopTaskBar({ tasks, isExpanded, onToggle }: TopTaskBarProps) {
  return (
    <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
      <CardHeader
        className="flex flex-row items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center">
          <CalendarClock className="h-5 w-5 mr-2 text-primary" />
          <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
        </div>
        <Button variant="ghost" size="icon" aria-label={isExpanded ? "Collapse deadlines" : "Expand deadlines"}>
          {isExpanded ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
        </Button>
      </CardHeader>

      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {isExpanded && (
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No upcoming deadlines.
              </div>
            ) : (
              <ScrollArea className="h-[250px] whitespace-nowrap"> {/* Horizontal scroll */}
                <div className="flex space-x-3 p-4">
                  {tasks.map(task => {
                    const timeLeft = calculateTimeLeft(task.dueDate);
                    let timeText = "";
                    let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";

                    if (timeLeft) {
                      if (timeLeft.days < 0) {
                        timeText = "Past Due";
                        timeBadgeVariant = "destructive";
                      } else if (timeLeft.days === 0) {
                        timeText = "Due Today";
                        timeBadgeVariant = "default";
                      } else if (timeLeft.days < 7) {
                        timeText = `${timeLeft.days} day${timeLeft.days === 1 ? '' : 's'} left`;
                        if (timeLeft.days <=2) timeBadgeVariant = "default";
                      } else {
                        timeText = `${timeLeft.weeks} week${timeLeft.weeks === 1 ? '' : 's'} left`;
                      }
                    }

                    return (
                      <Card key={task.id} className="min-w-[200px] max-w-[250px] bg-secondary/50 shadow-sm border-border">
                        <CardHeader className="p-2 pb-1">
                          <CardTitle className="text-sm font-semibold truncate text-secondary-foreground" title={task.name}>
                            {truncateText(task.name, 25)}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Due: {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 pt-1">
                          {timeText && (
                            <Badge variant={timeBadgeVariant} className="text-xs">
                              {timeText}
                            </Badge>
                          )}
                           {task.highPriority && !timeLeft?.days && ( // Show if no timeText (e.g. far out)
                                <Badge variant="outline" className="text-xs border-accent text-accent mt-1">
                                    High Priority
                                </Badge>
                            )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </div>
    </Card>
  );
}
