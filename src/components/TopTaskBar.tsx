
"use client";

import type * as React from 'react';
import Link from 'next/link'; // Import Link
import { format, parseISO, isSameDay } from 'date-fns';
import { ChevronDown, ChevronUp, CalendarClock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress'; // Import Progress
import type { UpcomingItem } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft, type TimeLeft } from '@/lib/utils';

interface TopTaskBarProps {
  items: UpcomingItem[];
  isExpanded: boolean;
  onToggle: () => void;
}

function formatTimeLeftForDisplay(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "";

  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.totalDays === 0 && timeLeft.totalHours >=0 && timeLeft.totalHours < 24) return "Due Today";


  if (timeLeft.years > 0) {
    return `${timeLeft.years}y ${timeLeft.monthsInYear}m left`;
  }
  if (timeLeft.monthsInYear > 0) {
    return `${timeLeft.monthsInYear}m ${timeLeft.daysInMonth}d left`;
  }
  if (timeLeft.daysInMonth > 0) {
     return `${timeLeft.daysInMonth}d ${timeLeft.hoursInDay}h left`;
  }
  if (timeLeft.totalHours >= 0) {
      return `${timeLeft.hoursInDay}h left`;
  }
  return "Upcoming"; // Fallback
}

export function TopTaskBar({ items, isExpanded, onToggle }: TopTaskBarProps) {
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
          "transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0" // Increased max-height
        )}
      >
        {isExpanded && (
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No upcoming deadlines for tasks or goals.
              </div>
            ) : (
              <ScrollArea className="max-h-[550px] whitespace-nowrap">
                <div className="flex flex-wrap gap-4 p-4 justify-center">
                  {items.map(item => {
                    const timeLeftDetails = calculateTimeLeft(item.dueDate);
                    const formattedTimeLeft = formatTimeLeftForDisplay(timeLeftDetails);

                    let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                    if (timeLeftDetails?.isPastDue) {
                        timeBadgeVariant = "destructive";
                    } else if (timeLeftDetails?.totalDays === 0) {
                        timeBadgeVariant = "default";
                    } else if (timeLeftDetails && timeLeftDetails.totalDays > 0 && timeLeftDetails.totalDays <= 2) {
                        timeBadgeVariant = "default";
                    }


                    const cardBaseClass = "shadow-sm border-border flex flex-col";
                    const taskCardClass = "w-full sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1rem)] lg:w-[calc(20%-1rem)] min-w-[200px] max-w-[280px] min-h-[100px] bg-secondary/30";
                    const goalCardClass = "w-full md:w-[calc(50%-0.5rem)] min-w-[300px] min-h-[160px] bg-secondary/50";


                    if (item.type === 'goal') {
                      return (
                        <Link href="/goals" key={item.id} className={cn(cardBaseClass, goalCardClass, "cursor-pointer hover:shadow-md transition-shadow")}>
                            <CardHeader className="p-3 pb-1.5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-semibold truncate text-secondary-foreground flex items-center" title={item.name}>
                                        <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                        {truncateText(item.name, 35)}
                                    </CardTitle>
                                    {formattedTimeLeft && (
                                        <Badge variant={timeBadgeVariant} className="text-xs shrink-0 ml-2">{formattedTimeLeft}</Badge>
                                    )}
                                </div>
                                <CardDescription className="text-xs text-muted-foreground">
                                Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2 text-center">
                                    <div>
                                        <p className="font-medium text-sm text-foreground">{timeLeftDetails?.totalDays ?? 'N/A'}</p>
                                        <p>Days Left</p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-foreground">{timeLeftDetails?.monthsInYear ?? 'N/A'}</p>
                                        <p>Months Left</p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-foreground">{timeLeftDetails?.totalHours ?? 'N/A'}</p>
                                        <p>Hours Left</p>
                                    </div>
                                </div>
                                {typeof item.progress === 'number' && (
                                <div className="mt-auto">
                                    <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                        <span>Progress</span>
                                        <span>{item.progress}%</span>
                                    </div>
                                    <Progress value={item.progress} className="h-2" />
                                </div>
                                )}
                            </CardContent>
                        </Link>
                      );
                    }

                    // Task Card (remains mostly the same, will wrap)
                    return (
                      <Card key={item.id} className={cn(cardBaseClass, taskCardClass)}>
                        <CardHeader className="p-2 pb-1">
                          <CardTitle className="text-sm font-semibold truncate text-secondary-foreground flex items-center" title={item.name}>
                            <CalendarClock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary/80" />
                            {truncateText(item.name, 25)}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Due: {item.dueDate ? format(parseISO(item.dueDate), 'MMM d, yyyy') : 'No due date'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 pt-1 space-y-1">
                          {formattedTimeLeft && (
                            <Badge variant={timeBadgeVariant} className="text-xs mr-1 mb-1">{formattedTimeLeft}</Badge>
                          )}
                          {item.highPriority && timeLeftDetails && !timeLeftDetails.isPastDue && (
                            <Badge variant="outline" className="text-xs border-accent text-accent">High Priority</Badge>
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
