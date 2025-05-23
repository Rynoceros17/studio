
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Settings, AlertCircle, CheckCircle, Star } from 'lucide-react'; // Added Star
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { UpcomingItem, TimeLeft } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";


interface TopTaskBarProps {
  items: UpcomingItem[];
  toggleGoalPriority: (goalId: string) => void;
}

function formatTimeLeftForBadge(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "";
  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.isDueToday) return "Due Today";

  const parts: string[] = [];
  if (timeLeft.totalYears > 0) {
    parts.push(`${timeLeft.totalYears}y`);
    if (timeLeft.monthsInYear > 0 && timeLeft.totalYears === 1) { // Show months if only 1 year and some months
      parts.push(`${timeLeft.monthsInYear}mo`);
    }
  } else if (timeLeft.totalMonths > 0) {
    parts.push(`${timeLeft.totalMonths}mo`);
    if (timeLeft.weeksInMonth > 0 && timeLeft.totalMonths === 1) { // Show weeks if only 1 month and some weeks
      parts.push(`${timeLeft.weeksInMonth}w`);
    }
  } else if (timeLeft.totalWeeks > 0) {
    parts.push(`${timeLeft.totalWeeks}w`);
    if (timeLeft.daysInWeek > 0 && timeLeft.totalWeeks === 1) { // Show days if only 1 week and some days
       parts.push(`${timeLeft.daysInWeek}d`);
    }
  } else if (timeLeft.fullDaysRemaining > 0) {
    parts.push(`${timeLeft.fullDaysRemaining}d`);
    if (timeLeft.hoursComponent > 0 && timeLeft.fullDaysRemaining <= 2) { // Show hours if 1-2 days left
      parts.push(`${timeLeft.hoursComponent}h`);
    }
  } else if (timeLeft.hoursComponent >= 0) { // Due in less than a day but not past due
    parts.push(`${timeLeft.hoursComponent}h`);
    if (timeLeft.minutesComponent > 0 && timeLeft.hoursComponent <= 2) { // Show minutes if 0-2 hours left
        parts.push(`${timeLeft.minutesComponent}m`);
    }
  }


  if (parts.length === 0) return "Upcoming";
  return parts.join(' ') + ' left';
}

function formatDetailedTimeLeft(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";

  const parts: string[] = [];
  if (timeLeft.yearsDetailed > 0) parts.push(`${timeLeft.yearsDetailed}y`);
  if (timeLeft.monthsDetailed > 0) parts.push(`${timeLeft.monthsDetailed}mo`);
  if (timeLeft.weeksDetailed > 0) parts.push(`${timeLeft.weeksDetailed}w`);
  if (timeLeft.daysDetailed > 0) parts.push(`${timeLeft.daysDetailed}d`);
  // Show hours if it's the most granular unit or if there are no larger units and it's due today
  if (timeLeft.hoursDetailed > 0 || (parts.length === 0 && timeLeft.isDueToday && timeLeft.hoursDetailed >= 0)) {
      parts.push(`${timeLeft.hoursDetailed}h`);
  }
  
  if (parts.length === 0) return timeLeft.isDueToday ? "Due Today" : "Upcoming";
  return parts.join(' : ') + ' left';
}


export function TopTaskBar({ items, toggleGoalPriority }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;
  const scrollAreaMaxHeight = numberOfGoals > 6 ? 'max-h-[50vh]' : '';


  return (
    <div className="w-full">
      <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex items-center">
            <Target className="h-5 w-5 mr-2 text-primary" />
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
                  const baseCardClass = "shadow-sm border rounded-lg hover:shadow-md transition-shadow";
                  
                  if (item.type === 'goal') {
                    const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0]?.id;
                    const isHighPriority = item.goalHighPriority === true;

                    let cardWrapperClass = "";
                    let cardInternalClass = cn(
                        baseCardClass,
                        "flex flex-col",
                        isHighPriority ? "bg-card border-transparent ring-2 ring-accent" : "bg-secondary/30 border-border" 
                    );

                    if (isSingleGoalCard) {
                      cardWrapperClass = "w-full"; 
                      cardInternalClass = cn(cardInternalClass, "min-h-[100px]");
                    } else {
                      cardWrapperClass = "w-full md:w-[calc(50%-0.5rem)] min-w-[300px]";
                      cardInternalClass = cn(cardInternalClass, "min-h-[160px]");
                    }

                    return (
                      <div key={item.id} className={cardWrapperClass}>
                        <Link href="/goals" passHref legacyBehavior>
                          <a className="block h-full"> {/* Anchor tag for clickable area */}
                            <Card className={cardInternalClass + " h-full"}>
                              <CardHeader className="p-3 pb-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center min-w-0 flex-grow">
                                    <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                    <CardTitle className={cn("text-base font-semibold truncate", isHighPriority ? "text-accent-foreground" : "text-secondary-foreground")} title={item.name}>
                                      {truncateText(item.name, isSingleGoalCard ? 40 : 28)}
                                    </CardTitle>
                                  </div>
                                  <div className="flex items-center shrink-0">
                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriority ? "text-accent-foreground hover:text-accent-foreground/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGoalPriority(item.id); }}>
                                        <Star className={cn("h-4 w-4", isHighPriority && "fill-accent text-accent")} />
                                        <span className="sr-only">Toggle Priority</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriority ? "text-accent-foreground hover:text-accent-foreground/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* Navigate to specific goal edit if desired, or keep general /goals link */ }}>
                                      <Settings className="h-4 w-4" />
                                      <span className="sr-only">Edit Goals</span>
                                    </Button>
                                  </div>
                                </div>
                                <CardDescription className={cn("text-xs pl-[22px]", isHighPriority ? "text-accent-foreground/80" : "text-muted-foreground")}>
                                  Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                                <div className={cn(
                                    "text-sm font-semibold text-center my-2 font-mono tracking-tight",
                                     isSingleGoalCard ? "md:text-base" : "text-sm",
                                     isHighPriority ? "text-accent-foreground" : "text-foreground"
                                    )}>
                                  {isSingleGoalCard ? formatDetailedTimeLeft(timeLeftDetails) : formatTimeLeftForBadge(timeLeftDetails)}
                                </div>
                                
                                {timeLeftDetails && timeLeftDetails.isPastDue && (
                                  <p className="text-destructive font-medium text-center my-2 text-sm flex items-center justify-center gap-1">
                                    <AlertCircle className="h-4 w-4"/> This goal is past due.
                                  </p>
                                )}
                                {typeof item.progress === 'number' && (
                                  <div className="mt-auto">
                                    <div className={cn("flex justify-between text-xs mb-0.5", isHighPriority ? "text-accent-foreground/80" : "text-muted-foreground")}>
                                      <span>Progress</span>
                                      <span>
                                        {item.progress === 100 && <CheckCircle className="inline h-3.5 w-3.5 text-green-600 mr-1" />}
                                        {item.progress}%
                                      </span>
                                    </div>
                                    <Progress value={item.progress} className={cn("h-1.5", isHighPriority && "bg-accent/30 [&>div]:bg-accent")} />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </a>
                        </Link>
                      </div>
                    );
                  }

                  // Task Card
                  const formattedTimeLeftBadge = formatTimeLeftForBadge(timeLeftDetails);
                  let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                  if (timeLeftDetails) {
                    if (timeLeftDetails.isPastDue) timeBadgeVariant = "destructive";
                    else if (timeLeftDetails.isDueToday || (timeLeftDetails.fullDaysRemaining >= 0 && timeLeftDetails.fullDaysRemaining <= 2) ) timeBadgeVariant = "default";
                  }
                  const taskCardClass = "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.66rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)] min-w-[200px] max-w-[280px] min-h-[90px] bg-card hover:shadow-md transition-shadow";
                  return (
                    <Card key={item.id} className={cn(baseCardClass, taskCardClass, item.taskHighPriority && timeLeftDetails && !timeLeftDetails.isPastDue ? "border-accent ring-1 ring-accent": "border-border")}>
                      <CardHeader className="p-2 pb-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center min-w-0">
                                <CalendarClock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary/80" />
                                <CardTitle className={cn("text-sm font-semibold truncate", item.taskHighPriority ? "text-accent-foreground" : "text-foreground")} title={item.name}>
                                  {truncateText(item.name, 20)}
                                </CardTitle>
                            </div>
                            {formattedTimeLeftBadge && (
                                <Badge variant={timeBadgeVariant} className="text-xs shrink-0 whitespace-nowrap">
                                  {formattedTimeLeftBadge}
                                </Badge>
                            )}
                        </div>
                        <CardDescription className={cn("text-xs pl-[18px]", item.taskHighPriority ? "text-accent-foreground/80" : "text-muted-foreground")}>
                          Scheduled: {item.originalDate ? format(parseISO(item.originalDate), 'MMM d') : 'N/A'}
                           <span className="mx-1">|</span> Due: {item.dueDate ? format(parseISO(item.dueDate), 'MMM d') : 'N/A'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-2 pt-1">
                        {item.taskHighPriority && timeLeftDetails && !timeLeftDetails.isPastDue && (
                            <Badge variant="outline" className="text-xs border-accent text-accent font-medium">
                                <AlertCircle className="h-3 w-3 mr-1"/> High Priority
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
      </Card>
    </div>
  );
}

