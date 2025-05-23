
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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

  // Due in the future
  if (timeLeft.fullDaysRemaining > 0) {
    let daysStr = `${timeLeft.fullDaysRemaining}d`;
    if (timeLeft.hoursInCurrentDay > 0 && timeLeft.fullDaysRemaining <= 2) { // Add hours if 1 or 2 days left
        daysStr += ` ${timeLeft.hoursInCurrentDay}h`;
    }
    return `${daysStr} left`;
  }
  // Due tomorrow (fullDaysRemaining is 0)
  if (timeLeft.hoursInCurrentDay > 0) {
    return `${timeLeft.hoursInCurrentDay}h ${timeLeft.minutesInCurrentHour}m left`;
  }
  if (timeLeft.minutesInCurrentHour > 0) {
    return `${timeLeft.minutesInCurrentHour}m left`;
  }
  return "Upcoming"; // Fallback if exactly at midnight of tomorrow
}


export function TopTaskBar({ items }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  return (
    <div className="w-full mt-4"> {/* Wrapper for TopTaskBar to apply full width */}
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
            <ScrollArea className="max-h-[550px] whitespace-nowrap">
              <div className="flex flex-wrap gap-4 p-4 justify-center">
                {items.map(item => {
                  const timeLeftDetails = calculateTimeLeft(item.dueDate);
                  const formattedTimeLeftBadge = formatTimeLeftForBadge(timeLeftDetails);

                  let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                  if (timeLeftDetails) {
                    if (timeLeftDetails.isPastDue) {
                        timeBadgeVariant = "destructive";
                    } else if (timeLeftDetails.isDueToday || (timeLeftDetails.fullDaysRemaining === 0 && timeLeftDetails.hoursInCurrentDay <= 24 && timeLeftDetails.hoursInCurrentDay >= 0) ) {
                        timeBadgeVariant = "default"; // Urgent or due today
                    } else if (timeLeftDetails.fullDaysRemaining > 0 && timeLeftDetails.fullDaysRemaining <= 2) {
                        timeBadgeVariant = "default"; // Due in next 2 full days
                    }
                  }


                  const cardBaseClass = "shadow-sm border-border flex flex-col";
                  
                  if (item.type === 'goal') {
                    const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0].id;
                    const goalCardWrapperClass = isSingleGoalCard ? "w-full" : "w-full md:w-[calc(50%-0.5rem)]";
                    const goalCardInternalClass = cn(cardBaseClass, "min-w-[300px]", isSingleGoalCard ? "max-w-full" : "max-w-[480px]", isSingleGoalCard ? "min-h-[100px]" : "min-h-[160px]", "bg-secondary/50 hover:shadow-md transition-shadow cursor-pointer");

                    return (
                      <Link href="/goals" key={item.id} className={goalCardWrapperClass}>
                        <Card className={goalCardInternalClass}>
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
                            {timeLeftDetails && !timeLeftDetails.isPastDue && (
                              <div className={cn(
                                "flex text-xs text-muted-foreground mb-2 text-center",
                                isSingleGoalCard ? "items-center justify-around mt-2 mb-1" : "grid grid-cols-3 gap-2"
                              )}>
                                {timeLeftDetails.totalYears > 0 && (
                                  <>
                                    <div>
                                      <p className="font-semibold text-lg text-foreground">{timeLeftDetails.totalYears}</p>
                                      <p>Years Left</p>
                                    </div>
                                    {isSingleGoalCard && <Separator orientation="vertical" className="h-8" />}
                                  </>
                                )}
                                {timeLeftDetails.totalMonths > 0 && (
                                  <>
                                    <div>
                                      <p className="font-semibold text-lg text-foreground">{timeLeftDetails.totalMonths}</p>
                                      <p>Months Left</p>
                                    </div>
                                    {isSingleGoalCard && <Separator orientation="vertical" className="h-8" />}
                                  </>
                                )}
                                 {/* Always show fullDaysRemaining if not past due and not due today */}
                                {!timeLeftDetails.isDueToday && timeLeftDetails.fullDaysRemaining >= 0 && (
                                  <>
                                    <div>
                                        <p className="font-semibold text-lg text-foreground">{timeLeftDetails.fullDaysRemaining}</p>
                                        <p>Full Days Left</p>
                                    </div>
                                    {isSingleGoalCard && <Separator orientation="vertical" className="h-8" />}
                                  </>
                                )}
                                {timeLeftDetails.hoursInCurrentDay >= 0 && (
                                    <>
                                      <div>
                                        <p className="font-semibold text-lg text-foreground">{timeLeftDetails.hoursInCurrentDay}</p>
                                        <p>Hours Left Today</p>
                                      </div>
                                    </>
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
                  const taskCardClass = "w-full sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1rem)] lg:w-[calc(20%-1rem)] min-w-[200px] max-w-[280px] min-h-[100px] bg-secondary/30";
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
