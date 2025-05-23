
"use client";

import type * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Target, Settings, AlertCircle, CheckCircle } from 'lucide-react'; // Added Settings
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { UpcomingItem, TimeLeft } from '@/lib/types'; // Imported TimeLeft
import { cn, truncateText, calculateTimeLeft } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';


// Helper function for the badge display (e.g., "1d 2h left")
function formatTimeLeftForBadge(timeLeft: TimeLeft | null): string {
  if (!timeLeft) return "";
  if (timeLeft.isPastDue) return "Past Due";
  if (timeLeft.isDueToday) return "Due Today";

  const parts: string[] = [];
  if (timeLeft.totalYears > 0) {
    parts.push(`${timeLeft.totalYears}y`);
    if (timeLeft.monthsInYear > 0 && timeLeft.totalYears === 1) { // Show months only if it's like "1y Xmo"
      parts.push(`${timeLeft.monthsInYear}mo`);
    }
  } else if (timeLeft.totalMonths > 0) {
    parts.push(`${timeLeft.totalMonths}mo`);
    if (timeLeft.weeksInMonth > 0 && timeLeft.totalMonths === 1) { // Show weeks only if it's like "1mo Xw"
      parts.push(`${timeLeft.weeksInMonth}w`);
    }
  } else if (timeLeft.totalWeeks > 0) {
    parts.push(`${timeLeft.totalWeeks}w`);
    if (timeLeft.daysInWeek > 0 && timeLeft.totalWeeks === 1) { // Show days only if it's like "1w Xd"
      parts.push(`${timeLeft.daysInWeek}d`);
    }
  } else if (timeLeft.fullDaysRemaining > 0) {
    parts.push(`${timeLeft.fullDaysRemaining}d`);
    if (timeLeft.hoursComponent > 0 && timeLeft.fullDaysRemaining <= 2) { // Show hours if <= 2 days left
      parts.push(`${timeLeft.hoursComponent}h`);
    }
  } else if (timeLeft.hoursComponent >= 0) { // Less than a day left, or due 'tomorrow' but within 24h
    parts.push(`${timeLeft.hoursComponent}h`);
    if (timeLeft.minutesComponent > 0 && timeLeft.hoursComponent <=2 ) { // Show minutes if <=2 hours left
         parts.push(`${timeLeft.minutesComponent}m`);
    }
  }

  if (parts.length === 0) return "Upcoming"; // Fallback
  return parts.join(' ') + ' left';
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
  // Show hours if it's positive, or if it's the only unit left and the task is due today.
  if (timeLeft.hoursDetailed > 0 || (parts.length === 0 && timeLeft.isDueToday)) {
    parts.push(`${timeLeft.hoursDetailed}h`);
  }

  if (parts.length === 0) {
      if (timeLeft.isDueToday) {
          // If hoursDetailed is 0, it means less than an hour of that component is left.
          // We can show minutes if available and relevant.
          // For now, "Due Today" is a safe fallback if no other parts are shown.
          return "Due Today";
      }
      return "Upcoming"; // Should be rare if not due today and all parts are 0
  }

  return parts.join(' : ') + ' left';
}


interface TopTaskBarProps {
  items: UpcomingItem[];
}

export function TopTaskBar({ items }: TopTaskBarProps) {
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
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines for tasks or goals.
            </div>
          ) : (
              <div className="flex flex-wrap gap-4 p-4 justify-center">
                {items.map(item => {
                  const timeLeftDetails = calculateTimeLeft(item.dueDate);
                  
                  const cardBaseClass = "shadow-sm border-border rounded-lg";
                  
                  if (item.type === 'goal') {
                    const isSingleGoalCard = numberOfGoals === 1 && item.id === goalItems[0]?.id;
                    
                    let cardWrapperClass = "";
                    let cardInternalClass = cn(cardBaseClass, "flex flex-col bg-secondary/30 hover:shadow-md transition-shadow");

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
                          <a className="block h-full"> {/* Make the anchor fill the div */}
                            <Card className={cardInternalClass + " h-full"}> {/* Ensure card also fills */}
                              <CardHeader className="p-3 pb-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center min-w-0">
                                    <Target className="h-4 w-4 mr-1.5 shrink-0 text-primary/80" />
                                    <CardTitle className="text-base font-semibold truncate text-secondary-foreground" title={item.name}>
                                      {truncateText(item.name, isSingleGoalCard ? 40 : 28)}
                                    </CardTitle>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0">
                                    <Settings className="h-4 w-4" />
                                    <span className="sr-only">Edit Goals</span>
                                  </Button>
                                </div>
                                <CardDescription className="text-xs text-muted-foreground pl-[22px]">
                                  Due: {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="p-3 pt-1.5 flex flex-col flex-grow justify-between">
                                <div className="text-sm font-semibold text-foreground text-center my-2 font-mono tracking-tight">
                                  {formatDetailedTimeLeft(timeLeftDetails)}
                                </div>
                                
                                {timeLeftDetails && timeLeftDetails.isPastDue && (
                                  <p className="text-destructive font-medium text-center my-2 text-sm flex items-center justify-center gap-1">
                                    <AlertCircle className="h-4 w-4"/> This goal is past due.
                                  </p>
                                )}
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
                    <Card key={item.id} className={cn(cardBaseClass, taskCardClass)}>
                      <CardHeader className="p-2 pb-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center min-w-0">
                                <CalendarClock className="h-3.5 w-3.5 mr-1.5 shrink-0 text-primary/80" />
                                <CardTitle className="text-sm font-semibold truncate text-foreground" title={item.name}>
                                  {truncateText(item.name, 20)}
                                </CardTitle>
                            </div>
                            {formattedTimeLeftBadge && (
                                <Badge variant={timeBadgeVariant} className="text-xs shrink-0 whitespace-nowrap">
                                  {formattedTimeLeftBadge}
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs text-muted-foreground pl-[18px]">
                          Scheduled: {item.originalDate ? format(parseISO(item.originalDate), 'MMM d') : 'N/A'}
                           <span className="mx-1">|</span> Due: {item.dueDate ? format(parseISO(item.dueDate), 'MMM d') : 'N/A'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-2 pt-1">
                        {item.highPriority && timeLeftDetails && !timeLeftDetails.isPastDue && (
                            <Badge variant="outline" className="text-xs border-accent text-accent font-medium">
                                <AlertCircle className="h-3 w-3 mr-1"/> High Priority
                            </Badge>
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

