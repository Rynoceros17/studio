
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { parseIcsContent, type RelevantEvent } from '@/lib/ics-parser';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Info, MapPin, FileText, CalendarClock, Upload } from 'lucide-react';
import { format, parseISO, formatDistanceToNow, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

function EventCard({ event, type }: { event: RelevantEvent | null, type: 'Current' | 'Next' }) {
    const label = type === 'Current' ? 'Current Class' : 'Next Class';
    const now = new Date();

    if (!event) {
        return (
            <Card className="bg-secondary/50 border-border">
                <CardHeader>
                    <CardTitle className="text-base font-normal flex items-center gap-2 text-muted-foreground">
                        <Info className="w-4 h-4" />
                        No {type.toLowerCase()} class found
                    </CardTitle>
                </CardHeader>
            </Card>
        );
    }

    let startDate: Date, endDate: Date;
    try {
        startDate = parseISO(event.startDate);
        endDate = parseISO(event.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error("Invalid date");
    } catch {
        return <Card className="bg-destructive/20"><CardHeader><CardTitle className="text-destructive text-sm">Invalid Event Date</CardTitle></CardHeader></Card>;
    }

    return (
        <Card className={cn("shadow-sm", type === 'Current' ? 'border-primary ring-1 ring-primary' : 'border-border', isSameDay(startDate, now) && 'bg-card')}>
            <CardHeader className="p-3 pb-2">
                <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-1">{label}</CardDescription>
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <CalendarClock className={cn("w-4 h-4 shrink-0", type === 'Current' ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="flex-1 truncate" title={event.summary}>{event.summary || "Untitled Event"}</span>
                </CardTitle>
                <CardDescription className="text-xs pt-1 pl-6 text-foreground/80">
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                    {type === 'Next' && startDate > now && (
                        <span className="text-muted-foreground ml-1.5">({formatDistanceToNow(startDate, { addSuffix: true })})</span>
                    )}
                    {type === 'Current' && endDate > now && (
                        <span className="text-muted-foreground ml-1.5">(ends {formatDistanceToNow(endDate, { addSuffix: true })})</span>
                    )}
                </CardDescription>
            </CardHeader>
            {(event.location || event.description) && (
                <CardContent className="space-y-1 text-xs pt-0 pb-3 pl-9">
                    {event.location && (
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={event.location}>{event.location}</span>
                        </p>
                    )}
                    {event.description && (
                        <p className="flex items-start gap-1.5 text-muted-foreground">
                            <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="truncate" title={event.description}>{event.description}</span>
                        </p>
                    )}
                </CardContent>
            )}
        </Card>
    );
}


export function CurrentNextClass() {
    const [isClient, setIsClient] = useState(false);
    const [icsData, setIcsData] = useState<string | null>(null);
    const [allEvents, setAllEvents] = useState<RelevantEvent[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            const storedIcsData = window.localStorage.getItem('icsData');
            setIcsData(storedIcsData);
        }
    }, [isClient]);

    useEffect(() => {
        if (!isClient) return;

        if (icsData) {
            setIsLoading(true);
            parseIcsContent(icsData)
                .then(result => {
                    if (result.error) {
                        setError(result.error);
                        setAllEvents(null);
                    } else {
                        setAllEvents(result.allEvents);
                        setError(null);
                    }
                })
                .finally(() => setIsLoading(false));
        } else {
            setAllEvents(null);
            setIsLoading(false);
            setError(null);
        }
    }, [icsData, isClient]);

    const { currentEvent, nextEvent } = useMemo(() => {
        if (!allEvents) return { currentEvent: null, nextEvent: null };

        const now = new Date();
        let current: RelevantEvent | null = null;
        let next: RelevantEvent | null = null;

        const sortedEvents = [...allEvents].sort((a, b) => {
            try { return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(); }
            catch { return 0; }
        });

        for (const event of sortedEvents) {
            try {
                const startDate = parseISO(event.startDate);
                const endDate = parseISO(event.endDate);
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

                if (startDate <= now && endDate > now) {
                    if (!current || startDate > parseISO(current.startDate)) {
                        current = event;
                    }
                } else if (startDate > now) {
                    if (!next || startDate < parseISO(next.startDate)) {
                        next = event;
                    }
                }
            } catch {
                continue;
            }
        }
        
        if (current && next) {
             try {
                const nextStartDate = parseISO(next.startDate);
                const currentEndDate = parseISO(current.endDate);
                if (nextStartDate < currentEndDate) {
                    next = sortedEvents.find(event => {
                        try {
                            const checkStartDate = parseISO(event.startDate);
                            if (isNaN(currentEndDate.getTime())) return false;
                            return checkStartDate >= currentEndDate;
                        } catch { return false; }
                    }) || null;
                }
            } catch (e) {
                 next = null;
            }
        }


        return { currentEvent: current, nextEvent: next };
    }, [allEvents]);

    if (!isClient || isLoading) {
        return (
            <Card className="shadow-sm">
                <CardContent className="p-4 space-y-2">
                    <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    <p className="text-xs text-center text-muted-foreground">Loading Timetable...</p>
                </CardContent>
            </Card>
        );
    }
    
    if (!icsData) {
        return (
             <Card className="shadow-sm bg-secondary/30 border-dashed">
                <CardContent className="p-4 text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">No Timetable Found</p>
                    <p className="text-xs text-muted-foreground">Upload your .ics file to see your current and next classes here.</p>
                     <Link href="/timetable" passHref legacyBehavior>
                        <Button size="sm" variant="outline" className="mt-2">
                            <Upload className="mr-2 h-4 w-4" />
                            Add Timetable
                        </Button>
                     </Link>
                </CardContent>
            </Card>
        )
    }

    if (error) {
         return (
             <Card className="shadow-sm bg-destructive/10 border-destructive">
                <CardContent className="p-4 text-center space-y-2">
                    <p className="text-sm font-medium text-destructive-foreground">Timetable Error</p>
                    <p className="text-xs text-destructive-foreground/80">{error}</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <EventCard event={currentEvent} type="Current" />
            <EventCard event={nextEvent} type="Next" />
        </div>
    );
}
