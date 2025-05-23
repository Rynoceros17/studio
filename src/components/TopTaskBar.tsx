
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Settings, AlertCircle, CheckCircle, Star } from 'lucide-react'; // Added Settings, Star
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { UpcomingItem, TimeLeft, Goal } from '@/lib/types';
import { cn, truncateText, calculateTimeLeft } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
// Removed ScrollArea as TopTaskBar is no longer scrollable internally
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";


interface TopTaskBarProps {
  items: UpcomingItem[];
  toggleGoalPriority: (goalId: string) => void;
}

// Updated formatting function
function formatTimeLeftForBadge(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";
  // Check for "Due Now" specifically if all components down to seconds are zero for today
  if (timeLeft.isDueToday && timeLeft.totalHours === 0 && timeLeft.totalMinutes === 0 && timeLeft.totalSeconds === 0) {
      return "Due Now";
  }
  if (timeLeft.isDueToday) return "Due Today";

  const { yearsDetailed, monthsDetailed, weeksDetailed, daysDetailed, hoursDetailed, totalMinutes, totalHours } = timeLeft;
  
  const timeParts: string[] = [];
  let hasLargerUnitBeenAdded = false; // Flag to track if we need to show subsequent zero units

  if (yearsDetailed > 0) {
    timeParts.push(`${yearsDetailed}y`);
    hasLargerUnitBeenAdded = true;
  }

  if (monthsDetailed > 0 || hasLargerUnitBeenAdded) {
    timeParts.push(`${monthsDetailed}mo`);
    hasLargerUnitBeenAdded = true;
  }

  if (weeksDetailed > 0 || hasLargerUnitBeenAdded) {
    timeParts.push(`${weeksDetailed}w`);
    hasLargerUnitBeenAdded = true;
  }

  if (daysDetailed > 0 || hasLargerUnitBeenAdded) {
    timeParts.push(`${daysDetailed}d`);
    hasLargerUnitBeenAdded = true;
  }

  // Always show hours if it's the most granular part we're displaying,
  // or if larger units are present (even if hours is 0).
  if (hoursDetailed > 0 || hasLargerUnitBeenAdded) {
    timeParts.push(`${hoursDetailed}h`);
  }
  
  if (timeParts.length === 0) {
    // This case means less than an hour remaining, and not "Due Today" or "Due Now"
    if (totalMinutes > 0 && totalHours === 0) { // Check totalMinutes directly
        return `${totalMinutes}m left`;
    }
    return "Upcoming"; // Fallback if all detailed components are 0
  }

  return timeParts.join(' : ') + ' left';
}


// This function is for the detailed display on the single wide goal card
function formatDetailedTimeLeftForCard(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "N/A";
  if (timeLeft.isPastDue) return "Past Due";

  const { yearsDetailed, monthsDetailed, weeksDetailed, daysDetailed, hoursDetailed } = timeLeft;
  
  const parts: string[] = [];
  let hasLargerUnit = false;

  if (yearsDetailed > 0) {
    parts.push(`${yearsDetailed}y`);
    hasLargerUnit = true;
  }
  if (monthsDetailed > 0 || hasLargerUnit) {
    parts.push(`${monthsDetailed}mo`);
    hasLargerUnit = true;
  }
  if (weeksDetailed > 0 || hasLargerUnit) {
    parts.push(`${weeksDetailed}w`);
    hasLargerUnit = true;
  }
  if (daysDetailed > 0 || hasLargerUnit) {
    parts.push(`${daysDetailed}d`);
    hasLargerUnit = true;
  }
  if (hoursDetailed > 0 || hasLargerUnit) {
    parts.push(`${hoursDetailed}h`);
  }

  if (parts.length === 0) {
     if (timeLeft.isDueToday) return "Due Today";
     if (timeLeft.totalMinutes > 0 && timeLeft.totalHours === 0) return `${timeLeft.totalMinutes}m left`;
     return "Upcoming"; // Fallback if all units are zero but not due today
  }
  return parts.join(' : ') + ' left';
}


export function TopTaskBar({ items, toggleGoalPriority }: TopTaskBarProps) {
  const goalItems = items.filter(item => item.type === 'goal');
  const numberOfGoals = goalItems.length;

  // No longer conditionally applying max-h for scroll, container will expand
  // const scrollAreaMaxHeight = numberOfGoals > 6 ? "max-h-[50vh]" : "";

  return (
    <div className="w-full">
      <Card className="w-full shadow-md bg-card border-border mb-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex items-center">
            <Target className="h-5 w-5 mr-2 text-primary" />
            <CardTitle className="text-lg text-primary">Upcoming Deadlines</CardTitle>
          </div>
          {/* Toggle button removed as per request to keep it always open */}
        </CardHeader>
        <CardContent className="p-0"> {/* Removed ScrollArea wrapper */}
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines for tasks or goals.
            </div>
          ) : (
            <div className={cn(
                "flex flex-wrap gap-4 p-4 justify-center"
                // scrollAreaMaxHeight // Removed
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
                        "min-h-[100px]", // Adjusted min-height for single wide card
                        isHighPriorityGoal ? "bg-card border-accent border-2" : "bg-secondary/30 border-border"
                    );
                  } else {
                    // For multiple goals, they try to fit two per row on md+ screens
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
                                  <CardTitle className={cn("text-base font-semibold truncate", isHighPriorityGoal ? "text-accent-foreground" : "text-secondary-foreground")} title={item.name}>
                                    {truncateText(item.name, isSingleGoalCard ? 40 : 28)}
                                  </CardTitle>
                                </div>
                                <div className="flex items-center shrink-0">
                                  <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriorityGoal ? "text-accent hover:text-accent/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleGoalPriority(item.id); }}>
                                      <Star className={cn("h-4 w-4", isHighPriorityGoal && "fill-accent text-accent")} />
                                      <span className="sr-only">Toggle Priority</span>
                                  </Button>
                                  <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isHighPriorityGoal ? "text-accent-foreground hover:text-accent-foreground/80" : "text-muted-foreground hover:text-primary")} onClick={(e) => { e.stopPropagation(); /* Link handles navigation */ }}>
                                      <Settings className="h-4 w-4" />
                                      <span className="sr-only">Edit Goals</span>
                                  </Button>
                                </div>
                              </div>
                              <CardDescription className={cn("text-xs pl-[22px]", isHighPriorityGoal ? "text-accent-foreground/80" : "text-muted-foreground")}>
                                Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                              <div className={cn(
                                  "text-sm font-semibold text-center my-2 font-mono tracking-tight",
                                   isSingleGoalCard ? "md:text-base" : "text-sm", // Slightly larger for single card
                                   isHighPriorityGoal ? "text-accent-foreground" : "text-foreground"
                                  )}>
                                {isSingleGoalCard ? formatDetailedTimeLeftForCard(timeLeftDetails) : formattedTimeLeftBadge}
                              </div>
                              
                              {timeLeftDetails && timeLeftDetails.isPastDue && (
                                <p className="text-destructive font-medium text-center my-2 text-sm flex items-center justify-center gap-1">
                                  <AlertCircle className="h-4 w-4"/> This goal is past due.
                                </p>
                              )}
                              {typeof item.progress === 'number' && (
                                <div className="mt-auto">
                                  <div className={cn("flex justify-between text-xs mb-0.5", isHighPriorityGoal ? "text-accent-foreground/80" : "text-muted-foreground")}>
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
                       {/* Display files for tasks if needed */}
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

    