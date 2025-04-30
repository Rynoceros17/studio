// src/components/WeeklyCalendar.tsx
'use client';

import React from 'react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import type { RelevantEvent } from '@/lib/ics-parser'; // Updated import path
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Info, Repeat } from 'lucide-react'; // Changed Calendar to Repeat for recurrence

interface WeeklyCalendarProps {
  weekStartDate: Date;
  events: RelevantEvent[];
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ weekStartDate, events }) => {
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });
  const days = [];
  let day = weekStartDate;

  while (day <= weekEnd) {
    days.push(new Date(day));
    day = addDays(day, 1);
  }

  const eventsByDay: { [key: string]: RelevantEvent[] } = {};
  days.forEach(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    eventsByDay[dateStr] = events
        .filter(event => {
             try {
                 const eventStartDate = parseISO(event.startDate);
                 // Ensure the date is valid before comparison
                 return !isNaN(eventStartDate.getTime()) && isSameDay(eventStartDate, d);
             } catch {
                 return false; // Ignore events with invalid start dates
             }
        })
        .sort((a, b) => {
            try {
                 // Ensure dates are valid before sorting
                const dateA = parseISO(a.startDate);
                const dateB = parseISO(b.startDate);
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                return dateA.getTime() - dateB.getTime();
            } catch {
                return 0; // Keep original order if dates are invalid
            }
        }); // Sort events within each day by start time
  });


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1 w-full">
      {days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayEvents = eventsByDay[dateStr] || [];
        const isToday = isSameDay(d, new Date());

        return (
          <Card key={dateStr} className={cn(
            "flex flex-col min-h-[300px] max-h-[500px] overflow-hidden bg-secondary/30", // Adjusted min/max height, use secondary for background
            isToday ? 'border-accent border-2 shadow-md' : 'border-transparent' // Use accent for today's border
          )}>
            <CardHeader className="p-1 text-center shrink-0 border-b border-border/50"> {/* Add subtle border */}
              <CardTitle className="text-xs font-medium text-muted-foreground"> {/* Muted foreground for day name */}
                {format(d, 'EEE')}
              </CardTitle>
              <CardDescription className={cn("text-sm font-bold", isToday ? 'text-accent' : 'text-foreground')}> {/* Accent for today's date */}
                {format(d, 'd')}
              </CardDescription>
              {isToday && <Badge variant="outline" className="border-accent text-accent mt-0.5 px-1 py-0 text-[9px] mx-auto">Today</Badge>}
            </CardHeader>
            <ScrollArea className="flex-grow">
              <CardContent className="p-1 space-y-1">
                {dayEvents.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center pt-4">No events</p>
                ) : (
                  dayEvents.map((event, index) => {
                       let eventStartDate: Date | null = null;
                       let eventEndDate: Date | null = null;
                       try {
                           eventStartDate = parseISO(event.startDate);
                           eventEndDate = parseISO(event.endDate);
                           if (isNaN(eventStartDate.getTime()) || isNaN(eventEndDate.getTime())) {
                               throw new Error("Invalid date");
                           }
                       } catch {
                           // Render a placeholder or skip if dates are invalid
                            return (
                                <div key={`${event.uid}-${index}-invalid`} className="p-1.5 rounded bg-destructive/20 text-destructive text-[10px]">
                                    Invalid Event Data
                                </div>
                            );
                       }

                       return (
                        // Use primary/muted colors for event blocks
                        <div key={`${event.uid}-${index}`} className="p-1.5 rounded bg-card border border-border/50 shadow-sm text-[10px] leading-tight">
                            <p className="font-medium text-primary mb-0.5 break-words line-clamp-2" title={event.summary}>
                                {event.summary || <span className="italic text-muted-foreground">No Title</span>}
                            </p>
                            <p className="flex items-center gap-1 text-muted-foreground text-[9px]">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                {format(eventStartDate, "h:mma")} - {format(eventEndDate, "h:mma")}
                            </p>
                             {event.location && (
                                <p className="flex items-center gap-1 text-muted-foreground text-[9px] mt-0.5 truncate" title={event.location}>
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    {event.location}
                                </p>
                             )}
                             {event.isRecurring && (
                                <p className="flex items-center gap-1 text-muted-foreground/80 text-[9px] mt-0.5" title="Recurring event instance">
                                    <Repeat className="w-2.5 h-2.5 shrink-0" /> {/* Use Repeat icon */}
                                    Recurring
                                </p>
                             )}
                        </div>
                       );
                  })
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        );
      })}
    </div>
  );
};

export default WeeklyCalendar;
