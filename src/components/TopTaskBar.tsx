
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Settings, AlertCircle, CheckCircle, Star, Plus, SeparatorHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { UpcomingItem, TimeLeft } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from "@/components/ui/separator";


interface TopTaskBarProps {
  items: UpcomingItem[];
  toggleGoalPriority: (goalId: string) => void;
}

// Updated formatting function
function formatTimeLeftForBadge(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.isDueToday && timeLeft.hoursComponent === 0 && timeLeft.minutesComponent === 0) return "Due Now";
  if (timeLeft.isDueToday) return "Due Today";

  const parts: string[] = [];
  if (timeLeft.yearsDetailed > 0) parts.push(`${timeLeft.yearsDetailed}y`);
  if (timeLeft.monthsDetailed > 0) parts.push(`${timeLeft.monthsDetailed}mo`);
  if (timeLeft.weeksDetailed > 0) parts.push(`${timeLeft.weeksDetailed}w`);
  // Show days if it's the largest unit or if weeks are shown (even if daysDetailed is 0)
  if (timeLeft.daysDetailed > 0 || (parts.length > 0 && timeLeft.weeksDetailed >= 0 && timeLeft.daysDetailed === 0) || (parts.length === 0 && timeLeft.daysDetailed === 0 && timeLeft.hoursComponent === 0 && timeLeft.minutesComponent === 0)) {
      parts.push(`${timeLeft.daysDetailed}d`);
  }
  // Show hours if it's the largest unit or if days are shown (even if hoursDetailed is 0)
  if (timeLeft.hoursComponent > 0 || (parts.length > 0 && timeLeft.daysDetailed >= 0 && timeLeft.hoursComponent === 0) || (parts.length === 0 && timeLeft.hoursComponent === 0 && timeLeft.minutesComponent > 0) ) {
      if (timeLeft.daysDetailed > 0 || timeLeft.weeksDetailed > 0 || timeLeft.monthsDetailed > 0 || timeLeft.yearsDetailed > 0) { // Only add if a larger unit is present
        parts.push(`${timeLeft.hoursComponent}h`);
      } else if (timeLeft.hoursComponent > 0) { // Or if if hours is the largest unit itself
        parts.push(`${timeLeft.hoursComponent}h`);
      }
  }
  
  if (parts.length === 0) {
      if (timeLeft.minutesComponent > 0) return `${timeLeft.minutesComponent}m left`;
      return "Upcoming";
  }

  return parts.join(' : ') + ' left';
}


export function TopTaskBar({ items, toggleGoalPriority }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  return (
    <div className="w-full">
      <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex items-center">
            <Target className="h-5 w-5 mr-2 text-primary" />
            <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
          </div>
          <Link href="/goals" passHref legacyBehavior>
            <Button variant="outline" size="sm" className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines for tasks or goals.
            </div>
          ) : (
            <div className={cn(
                "flex flex-wrap gap-4 p-4 justify-center"
                )}>
              {items.map(item => {
                const timeLeftDetails = calculateTimeLeft(item.dueDate);
                const isHighPriorityGoal = item.type === 'goal' && item.goalHighPriority === true;
                const isHighPriorityTask = item.type === 'task' && item.taskHighPriority === true;
                
                const formattedTimeLeftBadge = formatTimeLeftForBadge(timeLeftDetails);
                let timeBadgeVariant: "default" | "secondary" | "destructive" = "secondary";
                if (timeLeftDetails) {
                  if (timeLeftDetails.isPastDue) timeBadgeVariant = "destructive";
                  else if (timeLeftDetails.isDueToday || (timeLeftDetails.fullDaysRemaining >=0 && timeLeftDetails.fullDaysRemaining <=2 && timeLeftDetails.totalHours >=0 )) timeBadgeVariant = "default";
                }

                const cardBaseClasses = "shadow-sm rounded-lg hover:shadow-md transition-shadow flex flex-col";
                
                if (item.type === 'goal') {
                  const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0]?.id;
                  
                  let cardWrapperClass = "";
                  let cardInternalClass = cn(
                      cardBaseClasses,
                      "h-full"
                  );

                  if (isSingleGoalCard) {
                    cardWrapperClass = "w-full"; 
                    cardInternalClass = cn(
                        cardInternalClass, 
                        "min-h-[100px]", 
                        isHighPriorityGoal ? "bg-card border-accent border-2" : "bg-secondary/30 border-border"
                    );
                  } else {
                    cardWrapperClass = "w-full md:w-[calc(50%-0.5rem)] min-w-[300px]"; 
                    cardInternalClass = cn(
                        cardInternalClass, 
                        "min-h-[160px]",
                        isHighPriorityGoal ? "bg-card border-accent border-2" : "bg-secondary/30 border-border"
                    );
                  }

                  return (
                    <div key={item.id} className={cardWrapperClass}>
                      <Link href="/goals" passHref legacyBehavior>
                        <a className="block h-full">
                          <Card className={cardInternalClass}>
                            <CardHeader className="p-3 pb-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center min-w-0 flex-grow">
                                  <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                  <CardTitle className={cn("text-base font-semibold truncate", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-secondary-foreground")} title={item.name}>
                                    {truncateText(item.name, isSingleGoalCard ? 40 : 28)}
                                  </CardTitle>
                                </div>
                                <div className="flex items-center shrink-0">
                                  <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriorityGoal ? "text-accent hover:text-accent/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGoalPriority(item.id); }}>
                                      <Star className={cn("h-4 w-4", isHighPriorityGoal && "fill-accent text-accent")} />
                                      <span className="sr-only">Toggle Priority</span>
                                  </Button>
                                  <Link href="/goals" passHref legacyBehavior>
                                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground hover:text-accent-foreground/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.stopPropagation(); /* Link handles navigation */ }}>
                                        <Settings className="h-4 w-4" />
                                        <span className="sr-only">Edit Goals</span>
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                              <CardDescription className={cn("text-xs pl-[22px]", isHighPriorityGoal ? "text-accent-foreground/80 dark:text-primary-foreground/80" : "text-muted-foreground")}>
                                Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                              {isSingleGoalCard && timeLeftDetails && !timeLeftDetails.isPastDue ? (
                                <div className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1 text-center justify-center my-2">
                                  {timeLeftDetails.totalYears > 0 && (
                                    <div className="flex flex-col items-center px-1">
                                      <span className={cn("text-lg md:text-xl font-bold font-mono", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-foreground")}>{timeLeftDetails.totalYears}</span>
                                      <span className={cn("text-[10px] uppercase", isHighPriorityGoal ? "text-accent-foreground/70 dark:text-primary-foreground/70" : "text-muted-foreground")}>Years</span>
                                    </div>
                                  )}
                                  {timeLeftDetails.totalYears > 0 && timeLeftDetails.totalMonths > 0 && <Separator orientation="vertical" className="h-6 bg-border self-center mx-0.5" />}
                                  
                                  {timeLeftDetails.totalMonths > 0 && (
                                    <div className="flex flex-col items-center px-1">
                                      <span className={cn("text-lg md:text-xl font-bold font-mono", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-foreground")}>{timeLeftDetails.monthsInYear > 0 && timeLeftDetails.totalYears > 0 ? timeLeftDetails.monthsInYear : timeLeftDetails.totalMonths}</span>
                                      <span className={cn("text-[10px] uppercase", isHighPriorityGoal ? "text-accent-foreground/70 dark:text-primary-foreground/70" : "text-muted-foreground")}>Months</span>
                                    </div>
                                  )}
                                  {(timeLeftDetails.totalMonths > 0 && timeLeftDetails.totalWeeks > 0) && <Separator orientation="vertical" className="h-6 bg-border self-center mx-0.5" />}

                                  {timeLeftDetails.totalWeeks > 0 && (
                                    <div className="flex flex-col items-center px-1">
                                        <span className={cn("text-lg md:text-xl font-bold font-mono", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-foreground")}>{timeLeftDetails.weeksInMonth > 0 && timeLeftDetails.totalMonths > 0 ? timeLeftDetails.weeksInMonth : timeLeftDetails.totalWeeks}</span>
                                        <span className={cn("text-[10px] uppercase", isHighPriorityGoal ? "text-accent-foreground/70 dark:text-primary-foreground/70" : "text-muted-foreground")}>Weeks</span>
                                    </div>
                                  )}
                                  {(timeLeftDetails.totalWeeks > 0 && timeLeftDetails.fullDaysRemaining > 0 ) && <Separator orientation="vertical" className="h-6 bg-border self-center mx-0.5" />}
                                  
                                  {timeLeftDetails.fullDaysRemaining > 0 && (
                                    <div className="flex flex-col items-center px-1">
                                      <span className={cn("text-lg md:text-xl font-bold font-mono", isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-foreground")}>{timeLeftDetails.daysInWeek > 0 && timeLeftDetails.totalWeeks > 0 ? timeLeftDetails.daysInWeek : timeLeftDetails.fullDaysRemaining}</span>
                                      <span className={cn("text-[10px] uppercase", isHighPriorityGoal ? "text-accent-foreground/70 dark:text-primary-foreground/70" : "text-muted-foreground")}>Days</span>
                                    </div>
                                  )}
                                  {/* Hours Left Removed */}
                                </div>
                              ) : timeLeftDetails && !timeLeftDetails.isPastDue ? (
                                 <p className={cn(
                                  "text-sm font-semibold text-center my-2 font-mono tracking-tight",
                                   isHighPriorityGoal ? "text-accent-foreground dark:text-primary-foreground" : "text-foreground"
                                  )}>
                                    {formatTimeLeftForBadge(timeLeftDetails)}
                                  </p>
                              ) : null}
                              
                              {timeLeftDetails && timeLeftDetails.isPastDue && (
                                <p className="text-destructive font-medium text-center my-2 text-sm flex items-center justify-center gap-1">
                                  <AlertCircle className="h-4 w-4"/> This goal is past due.
                                </p>
                              )}
                              {typeof item.progress === 'number' && (
                                <div className="mt-auto">
                                  <div className={cn("flex justify-between text-xs mb-0.5", isHighPriorityGoal ? "text-accent-foreground/80 dark:text-primary-foreground/80" : "text-muted-foreground")}>
                                    <span>Progress</span>
                                    <span>
                                      {item.progress === 100 && <CheckCircle className="inline h-3.5 w-3.5 text-green-600 mr-1" />}
                                      {item.progress}%
                                    </span>
                                  </div>
                                  <Progress value={item.progress} className={cn("h-1.5", isHighPriorityGoal && "bg-accent/30 [&>div]:bg-accent")} />
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
                const taskCardClass = "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.66rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)] min-w-[200px] min-h-[90px] bg-card hover:shadow-md transition-shadow";
                return (
                  <Card key={item.id} className={cn(
                      cardBaseClasses,
                      taskCardClass, 
                      isHighPriorityTask && timeLeftDetails && !timeLeftDetails.isPastDue ? "border-accent border-2": "border-border" 
                      )}>
                    <CardHeader className="p-2 pb-1">
                      <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center min-w-0">
                              <CalendarClock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary/80" />
                              <CardTitle className={cn("text-sm font-semibold truncate", isHighPriorityTask ? "text-accent-foreground" : "text-foreground")} title={item.name}>
                                {truncateText(item.name, 20)}
                              </CardTitle>
                          </div>
                          {formattedTimeLeftBadge && (
                              <Badge variant={timeBadgeVariant} className="text-xs shrink-0 whitespace-nowrap">
                                {formattedTimeLeftBadge}
                              </Badge>
                          )}
                      </div>
                      <CardDescription className={cn("text-xs pl-[18px]", isHighPriorityTask ? "text-accent-foreground/80" : "text-muted-foreground")}>
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
                       {!item.taskHighPriority && item.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1" title={item.description}>
                            {truncateText(item.description, 30)}
                        </p>
                       )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
