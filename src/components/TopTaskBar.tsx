
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Briefcase } from 'lucide-react'; // Briefcase seems unused here, consider removing if not needed elsewhere
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
// Separator might not be needed if we are not using vertical lines between time units
// import { Separator } from '@/components/ui/separator'; 
import type { UpcomingItem } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft, type TimeLeft } from '@/lib/utils';

interface TopTaskBarProps {
  items: UpcomingItem[];
}

// Updated formatTimeLeftForDisplay for the badge
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
  // Use fullDaysRemaining for days part of the badge to represent days after today.
  // hoursComponent is hours left in the current day.
  if (timeLeft.fullDaysRemaining > 0) { 
    return `${timeLeft.fullDaysRemaining}d ${timeLeft.hoursComponent}h left`;
  }
  // If no full days remaining, it's due tomorrow or within today (but not "Due Today" if current time has passed midnight for due date)
  if (timeLeft.hoursComponent >= 0) { // Show hours if non-negative
    return `${timeLeft.hoursComponent}h ${timeLeft.minutesComponent}m left`;
  }
  return "Upcoming";
}

// New function for Y:M:W:D:H string format
function formatDetailedTimeLeft(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";

  // Construct the string using component values from TimeLeft
  const yearsDisplay = timeLeft.totalYears;
  const monthsDisplay = timeLeft.monthsInYear;
  const weeksDisplay = timeLeft.weeksInMonth;
  const daysDisplay = timeLeft.daysInWeek; 
  const hoursDisplay = timeLeft.hoursComponent;

  return `${yearsDisplay}y : ${monthsDisplay}mo : ${weeksDisplay}w : ${daysDisplay}d : ${hoursDisplay}h`;
}


export function TopTaskBar({ items }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  return (
    <div className="w-full mt-4">
      <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex items-center">
            <CalendarClock className="h-5 w-5 mr-2 text-primary" />
            <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines for tasks or goals.
            </div>
          ) : (
            <ScrollArea>
              <div className="flex flex-wrap gap-4 p-4 justify-center">
                {items.map(item => {
                  const timeLeftDetails = calculateTimeLeft(item.dueDate);
                  const formattedTimeLeftBadge = formatTimeLeftForBadge(timeLeftDetails);

                  let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                  if (timeLeftDetails) {
                    if (timeLeftDetails.isPastDue) {
                        timeBadgeVariant = "destructive";
                    } else if (timeLeftDetails.isDueToday || (timeLeftDetails.fullDaysRemaining === 0 && timeLeftDetails.hoursComponent >= 0 && timeLeftDetails.hoursComponent <= 24) ) { // Updated condition for "default" urgency
                        timeBadgeVariant = "default"; 
                    } else if (timeLeftDetails.fullDaysRemaining > 0 && timeLeftDetails.fullDaysRemaining <= 2) {
                        timeBadgeVariant = "default"; 
                    }
                  }

                  const cardBaseClass = "shadow-sm border-border";
                  
                  if (item.type === 'goal') {
                    const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0]?.id;
                    
                    let cardWrapperClass = "";
                    let cardInternalClass = cn(cardBaseClass, "flex flex-col");

                    if (isSingleGoalCard) {
                      cardWrapperClass = "w-full";
                      cardInternalClass = cn(cardInternalClass, "min-h-[100px]"); // Adjusted min-height for single card
                    } else {
                      cardWrapperClass = "w-full md:w-[calc(50%-0.5rem)]"; 
                      cardInternalClass = cn(cardInternalClass, "min-w-[300px] min-h-[160px]");
                    }

                    return (
                      <Link href="/goals" key={item.id} className={cardWrapperClass}>
                        <Card className={cn(cardInternalClass, "bg-secondary/50 hover:shadow-md transition-shadow")}>
                          <CardHeader className="p-3 pb-1.5">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base font-semibold truncate text-secondary-foreground flex items-center" title={item.name}>
                                <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                {truncateText(item.name, isSingleGoalCard ? 40 : 30)}
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
                            {timeLeftDetails && !timeLeftDetails.isPastDue && isSingleGoalCard && (
                               <p className="text-md font-semibold text-foreground text-center mt-2 mb-3 font-mono tracking-tight">
                                {formatDetailedTimeLeft(timeLeftDetails)}
                              </p>
                            )}
                             {timeLeftDetails && !timeLeftDetails.isPastDue && !isSingleGoalCard && (
                               <div className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1 justify-center mt-2 mb-1 text-center">
                                {timeLeftDetails.totalYears > 0 && (
                                   <div> <p className="font-semibold text-lg text-foreground">{timeLeftDetails.totalYears}</p> <p className="text-xs">Years</p> </div>
                                )}
                                {timeLeftDetails.totalMonths > 0 && (
                                  <div> <p className="font-semibold text-lg text-foreground">{timeLeftDetails.monthsInYear > 0 ? timeLeftDetails.monthsInYear : timeLeftDetails.totalMonths}</p> <p className="text-xs">Months</p> </div>
                                )}
                                {timeLeftDetails.totalWeeks > 0 && (
                                  <div> <p className="font-semibold text-lg text-foreground">{timeLeftDetails.weeksInMonth > 0 ? timeLeftDetails.weeksInMonth : timeLeftDetails.totalWeeks}</p> <p className="text-xs">Weeks</p> </div>
                                )}
                                {timeLeftDetails.fullDaysRemaining >= 0 && !timeLeftDetails.isDueToday && (
                                  <div> <p className="font-semibold text-lg text-foreground">{timeLeftDetails.daysInWeek > 0 ? timeLeftDetails.daysInWeek : timeLeftDetails.fullDaysRemaining}</p> <p className="text-xs">Days</p> </div>
                                )}
                                {((timeLeftDetails.isDueToday && timeLeftDetails.hoursComponent >= 0) || (timeLeftDetails.fullDaysRemaining === 0 && !timeLeftDetails.isPastDue && timeLeftDetails.hoursComponent >= 0)) && (
                                  <div> <p className="font-semibold text-lg text-foreground">{timeLeftDetails.hoursComponent}</p> <p className="text-xs">Hours</p> </div>
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
                        </Card>
                      </Link>
                    );
                  }

                  // Task Card
                  const taskCardClass = "w-full sm:w-[calc(33.333%-0.66rem)] md:w-[calc(25%-0.75rem)] lg:w-[calc(20%-0.8rem)] min-w-[200px] max-w-[280px] min-h-[100px] bg-secondary/30";
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
      </Card>
    </div>
  );
}

    