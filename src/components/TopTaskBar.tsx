
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, TrendingUp, AlertCircle, Info, CheckCircle } from 'lucide-react'; // Keep all icons
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { UpcomingItem } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft, type TimeLeft } from '@/lib/utils';


// Helper function to format time left for the main badge on each card
function formatTimeLeftForBadge(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "";
  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.isDueToday) return "Due Today";

  if (timeLeft.totalYears > 0) {
    return `${timeLeft.totalYears}y ${timeLeft.monthsInYear}mo left`;
  }
  if (timeLeft.totalMonths > 0) {
    return `${timeLeft.totalMonths}mo ${timeLeft.weeksInMonth}w left`;
  }
  if (timeLeft.totalWeeks > 0) {
    return `${timeLeft.totalWeeks}w ${timeLeft.daysInWeek}d left`;
  }
  if (timeLeft.fullDaysRemaining > 0) {
    return `${timeLeft.fullDaysRemaining}d ${timeLeft.hoursComponent}h left`;
  }
  // If due in less than a day but not "today" (e.g. due "tomorrow" but less than 24h from now)
  if (timeLeft.hoursComponent >= 0) {
    return `${timeLeft.hoursComponent}h ${timeLeft.minutesComponent}m left`;
  }
  return "Upcoming";
}

// Helper function for the detailed Y:M:W:D:H string format
function formatDetailedTimeLeft(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";

  const parts: string[] = [];
  if (timeLeft.yearsDetailed > 0) parts.push(`${timeLeft.yearsDetailed}y`);
  if (timeLeft.monthsDetailed > 0) parts.push(`${timeLeft.monthsDetailed}mo`);
  if (timeLeft.weeksDetailed > 0) parts.push(`${timeLeft.weeksDetailed}w`);
  if (timeLeft.daysDetailed > 0) parts.push(`${timeLeft.daysDetailed}d`);
  // Show hours if it's the most granular unit available or if other larger units are present
  if (parts.length > 0 && timeLeft.hoursDetailed >= 0) {
      parts.push(`${timeLeft.hoursDetailed}h`);
  } else if (parts.length === 0 && timeLeft.hoursDetailed >= 0) { // Only hours left
      parts.push(`${timeLeft.hoursDetailed}h`);
  }


  if (parts.length === 0) { // E.g. less than an hour, or exactly on time
      if (timeLeft.isDueToday) return "Due Today"; // Or a more granular minutes/seconds if needed
      return "Upcoming"; // Fallback
  }

  return parts.join(' : ');
}


interface TopTaskBarProps {
  items: UpcomingItem[];
}

export function TopTaskBar({ items }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  const taskItems = items.filter(item => item.type === 'task');

  const scrollAreaMaxHeight = numberOfGoals > 6 ? 'max-h-[50vh]' : '';

  return (
    <div className="w-full">
      <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines for tasks or goals.
            </div>
          ) : (
            <ScrollArea className={cn("w-full", scrollAreaMaxHeight)}>
              <div className="flex flex-wrap gap-4 p-4 justify-center">
                {items.map(item => {
                  const timeLeftDetails = calculateTimeLeft(item.dueDate);
                  const formattedTimeLeftBadge = formatTimeLeftForBadge(timeLeftDetails);

                  let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                  if (timeLeftDetails) {
                    if (timeLeftDetails.isPastDue) {
                        timeBadgeVariant = "destructive";
                    } else if (timeLeftDetails.isDueToday || (timeLeftDetails.fullDaysRemaining === 0 && timeLeftDetails.hoursComponent >= 0 && timeLeftDetails.hoursComponent <= 24) ) {
                        timeBadgeVariant = "default";
                    } else if (timeLeftDetails.fullDaysRemaining > 0 && timeLeftDetails.fullDaysRemaining <= 2) {
                        timeBadgeVariant = "default";
                    }
                  }

                  const cardBaseClass = "shadow-sm border-border rounded-lg";
                  
                  if (item.type === 'goal') {
                    const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0]?.id;
                    
                    let cardWrapperClass = "";
                    let cardInternalClass = cn(cardBaseClass, "flex flex-col bg-secondary/30 hover:shadow-md transition-shadow");

                    if (isSingleGoalCard) {
                      cardWrapperClass = "w-full"; // Takes full width if it's the only goal
                      cardInternalClass = cn(cardInternalClass, "min-h-[100px]");
                    } else {
                      // Allows two goals per row on medium screens, full width on small
                      cardWrapperClass = "w-full md:w-[calc(50%-0.5rem)] min-w-[300px]";
                      cardInternalClass = cn(cardInternalClass, "min-h-[160px]");
                    }

                    return (
                      <Link href="/goals" key={item.id} className={cardWrapperClass}>
                        <Card className={cardInternalClass}>
                          <CardHeader className="p-3 pb-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center min-w-0">
                                <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                <CardTitle className="text-base font-semibold truncate text-secondary-foreground" title={item.name}>
                                  {truncateText(item.name, isSingleGoalCard ? 40 : 28)}
                                </CardTitle>
                              </div>
                              {formattedTimeLeftBadge && (
                                <Badge variant={timeBadgeVariant} className="text-xs shrink-0 whitespace-nowrap">{formattedTimeLeftBadge}</Badge>
                              )}
                            </div>
                            <CardDescription className="text-xs text-muted-foreground pl-[22px]"> {/* Align with title text */}
                              Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                            {timeLeftDetails && !timeLeftDetails.isPastDue && (
                               <p className="text-sm font-semibold text-foreground text-center my-2 font-mono tracking-tight">
                                {formatDetailedTimeLeft(timeLeftDetails)}
                              </p>
                            )}
                            {timeLeftDetails && timeLeftDetails.isPastDue && (
                               <p className="text-destructive font-medium text-center my-2 text-sm flex items-center justify-center gap-1">
                                <AlertCircle className="h-4 w-4"/> This goal is past due.
                               </p>
                            )}
                             {/* Progress Bar */}
                            {typeof item.progress === 'number' && (
                              <div className="mt-auto">
                                <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                  <span>Progress</span>
                                   <span>
                                      {item.progress === 100 && <CheckCircle className="inline h-3.5 w-3.5 text-green-600 mr-1" />}
                                      {item.progress}%
                                   </span>
                                </div>
                                <Progress value={item.progress} className="h-1.5" />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  }

                  // Task Card
                  const taskCardClass = "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.66rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)] min-w-[200px] max-w-[280px] min-h-[90px] bg-card hover:shadow-md transition-shadow";
                  return (
                    <Card key={item.id} className={cn(cardBaseClass, taskCardClass)}>
                      <CardHeader className="p-2 pb-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center min-w-0">
                                <CalendarClock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary/80" />
                                <CardTitle className="text-sm font-semibold truncate text-foreground" title={item.name}>
                                  {truncateText(item.name, 20)}
                                </CardTitle>
                            </div>
                            {item.highPriority && timeLeftDetails && !timeLeftDetails.isPastDue && (
                                <Info className="h-3.5 w-3.5 text-accent shrink-0" title="High Priority"/>
                            )}
                        </div>
                        <CardDescription className="text-xs text-muted-foreground pl-[18px]">
                          Scheduled: {item.originalDate ? format(parseISO(item.originalDate), 'MMM d') : 'N/A'}
                           <span className="mx-1">|</span> Due: {item.dueDate ? format(parseISO(item.dueDate), 'MMM d') : 'N/A'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-2 pt-1">
                        {formattedTimeLeftBadge && (
                          <Badge variant={timeBadgeVariant} className="text-xs">{formattedTimeLeftBadge}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

