
"use client";

import type * as React from 'react';
import Link from 'next/link'; // Import Link
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Briefcase } from 'lucide-react'; // Added Briefcase
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator'; // Import Separator
import type { UpcomingItem } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft, type TimeLeft } from '@/lib/utils';

interface TopTaskBarProps {
  items: UpcomingItem[];
}

function formatTimeLeftForDisplay(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "";

  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.totalDays === 0 && timeLeft.totalHours >=0 && timeLeft.totalHours < 24 && !timeLeft.isPastDue) return "Due Today";


  if (timeLeft.years > 0) {
    return `${timeLeft.years}y ${timeLeft.monthsInYear}m left`;
  }
  if (timeLeft.totalMonths > 0) {
    return `${timeLeft.totalMonths}m ${timeLeft.daysInMonth}d left`;
  }
  if (timeLeft.totalDays > 0) {
     return `${timeLeft.totalDays}d ${timeLeft.hoursInDay}h left`;
  }
  if (timeLeft.totalHours >= 0) {
      return `${timeLeft.hoursInDay}h left`;
  }
  return "Upcoming"; // Fallback
}

export function TopTaskBar({ items }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  return (
    <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
      <CardHeader
        className="flex flex-row items-center justify-between p-3"
      >
        <div className="flex items-center">
          <CalendarClock className="h-5 w-5 mr-2 text-primary" />
          <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
        </div>
        {/* Toggle button removed as per previous request */}
      </CardHeader>

      <div className="opacity-100 max-h-[600px]"> {/* Always expanded */}
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
                    const formattedTimeLeftBadge = formatTimeLeftForDisplay(timeLeftDetails);

                    let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                    if (timeLeftDetails?.isPastDue) {
                        timeBadgeVariant = "destructive";
                    } else if (timeLeftDetails?.totalDays === 0 && !timeLeftDetails.isPastDue) {
                        timeBadgeVariant = "default";
                    } else if (timeLeftDetails && !timeLeftDetails.isPastDue && timeLeftDetails.totalDays > 0 && timeLeftDetails.totalDays <= 2) {
                        timeBadgeVariant = "default";
                    }

                    const cardBaseClass = "shadow-sm border-border flex flex-col";
                    const taskCardClass = "w-full sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1rem)] lg:w-[calc(20%-1rem)] min-w-[200px] max-w-[280px] min-h-[100px] bg-secondary/30";
                    
                    if (item.type === 'goal') {
                      const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0].id;
                      const goalCardDynamicWidthClass = isSingleGoalCard ? "w-full" : "md:w-[calc(50%-0.5rem)]";
                      const goalCardMinHeightClass = isSingleGoalCard ? "min-h-[100px]" : "min-h-[160px]";

                      return (
                        <Link href="/goals" key={item.id} className={cn(cardBaseClass, goalCardDynamicWidthClass, "min-w-[300px] max-w-[480px]", goalCardMinHeightClass, "bg-secondary/50 hover:shadow-md transition-shadow cursor-pointer")}>
                            <CardHeader className="p-3 pb-1.5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-semibold truncate text-secondary-foreground flex items-center" title={item.name}>
                                        <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                        {truncateText(item.name, isSingleGoalCard ? 40 : 35)}
                                    </CardTitle>
                                    {formattedTimeLeftBadge && (
                                        <Badge variant={timeBadgeVariant} className="text-xs shrink-0 ml-2">{formattedTimeLeftBadge}</Badge>
                                    )}
                                </div>
                                <CardDescription className="text-xs text-muted-foreground">
                                Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                                {timeLeftDetails && !timeLeftDetails.isPastDue && (
                                   <div className={cn(
                                       "flex text-xs text-muted-foreground mb-2 text-center",
                                       isSingleGoalCard ? "items-center justify-around mt-2 mb-1" : "grid grid-cols-3 gap-2"
                                   )}>
                                        {/* Months Left */}
                                        {timeLeftDetails.totalMonths > 0 && (
                                            <>
                                                <div>
                                                    <p className="font-semibold text-lg text-foreground">{timeLeftDetails.totalMonths}</p>
                                                    <p>Months Left</p>
                                                </div>
                                                {isSingleGoalCard && <Separator orientation="vertical" className="h-8" />}
                                            </>
                                        )}
                                        {/* Days Left */}
                                        {( (timeLeftDetails.totalMonths > 0 && timeLeftDetails.daysInMonth > 0) || (timeLeftDetails.totalMonths === 0 && timeLeftDetails.totalDays > 0) ) && (
                                            <>
                                                <div>
                                                    <p className="font-semibold text-lg text-foreground">
                                                        {timeLeftDetails.totalMonths > 0 ? timeLeftDetails.daysInMonth : timeLeftDetails.totalDays}
                                                    </p>
                                                    <p>Days Left</p>
                                                </div>
                                                 {isSingleGoalCard && timeLeftDetails.hoursInDay > 0 && timeLeftDetails.totalDays === 0 && <Separator orientation="vertical" className="h-8" />}
                                            </>
                                        )}
                                        {/* Hours Left */}
                                        {timeLeftDetails.totalDays === 0 && timeLeftDetails.hoursInDay >= 0 && !timeLeftDetails.isPastDue && (
                                            <div>
                                                <p className="font-semibold text-lg text-foreground">{timeLeftDetails.hoursInDay}</p>
                                                <p>Hours Left</p>
                                            </div>
                                        )}
                                   </div>
                                )}
                                {timeLeftDetails && timeLeftDetails.isPastDue && (
                                    <div className="text-center text-destructive font-medium my-4 text-sm">
                                        This goal is past due.
                                    </div>
                                )}

                                {typeof item.progress === 'number' && (
                                <div className="mt-auto">
                                    <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                        <span>Progress</span>
                                        <span>{item.progress}%</span>
                                    </div>
                                    <Progress value={item.progress} className="h-1.5" />
                                </div>
                                )}
                            </CardContent>
                        </Link>
                      );
                    }

                    // Task Card
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
                          {formattedTimeLeftBadge && (
                            <Badge variant={timeBadgeVariant} className="text-xs mr-1 mb-1">{formattedTimeLeftBadge}</Badge>
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
      </div>
    </Card>
  );
}

