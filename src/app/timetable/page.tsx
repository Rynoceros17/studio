
// src/app/timetable/page.tsx
'use client';

import type * as React from 'react';
import { useState, useMemo, useEffect, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link'; // Import Link
import { parseIcsContent, type RelevantEvent } from '@/lib/ics-parser';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CalendarClock, AlertCircle, Info, MapPin, FileText, ChevronLeft, ChevronRight, FileUp, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { format, formatDistanceToNow, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import { cn } from '@/lib/utils';

export default function TimetablePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [allEvents, setAllEvents] = useState<RelevantEvent[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday start
  const [icsData, setIcsData] = useState<string | null>(null);
  const [isUploadSectionVisible, setIsUploadSectionVisible] = useState(true);

  const parseAndSetEvents = async (data: string, isInitialLoad = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const parseResult = await parseIcsContent(data);
      if (parseResult.error) {
        setError(parseResult.error);
        setAllEvents(null);
        setIsUploadSectionVisible(true);
      } else {
        const validEvents = parseResult.allEvents.filter(event => {
            try {
                if (typeof event.startDate !== 'string') return false;
                return !isNaN(parseISO(event.startDate).getTime());
            } catch {
                return false;
            }
        });
        setAllEvents(validEvents);
        setError(null);
        setIsUploadSectionVisible(false);
        if (isInitialLoad) {
            setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        }
      }
    } catch (err: any) {
      console.error("Error parsing ICS data:", err);
      setError(`An error occurred while parsing: ${err.message || 'Unknown error'}`);
      setAllEvents(null);
      setIsUploadSectionVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const storedIcsData = localStorage.getItem('icsData');
    const storedFileName = localStorage.getItem('icsFileName');
    if (storedIcsData && storedFileName) {
      setIcsData(storedIcsData);
      setFileName(storedFileName);
      parseAndSetEvents(storedIcsData, true);
    } else {
      setIsUploadSectionVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const fileInput = e.target;

    if (file) {
      if (!file.name.toLowerCase().endsWith('.ics')) {
        setError('Invalid file type. Please upload a .ics file.');
        setFileName(null);
        setIcsData(null);
        setAllEvents(null);
        setIsUploadSectionVisible(true);
        localStorage.removeItem('icsData');
        localStorage.removeItem('icsFileName');
        if (fileInput) fileInput.value = '';
        return;
      }

      setFileName(file.name);
      setError(null);
      setAllEvents(null);
      setIsUploadSectionVisible(true);

      try {
        setIsLoading(true);
        const content = await file.text();
        if (!content) {
           throw new Error("File is empty or could not be read.");
        }
        setIcsData(content);
        localStorage.setItem('icsData', content);
        localStorage.setItem('icsFileName', file.name);
        setError(null);
        await parseAndSetEvents(content, true);
      } catch (err: any) {
        console.error("Error reading file:", err);
        setError(`Could not read file content: ${err.message || 'Unknown error'}`);
        setAllEvents(null);
        setIcsData(null);
        setFileName(null);
        setIsUploadSectionVisible(true);
        localStorage.removeItem('icsData');
        localStorage.removeItem('icsFileName');
        if (fileInput) fileInput.value = '';
      } finally {
          setIsLoading(false);
      }
    } else {
      setFileName(null);
      setIcsData(null);
      setAllEvents(null);
      setError(null);
      setIsUploadSectionVisible(true);
      localStorage.removeItem('icsData');
      localStorage.removeItem('icsFileName');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!icsData) {
       const form = e.target as HTMLFormElement;
       const fileInput = form.elements.namedItem('icsFile') as HTMLInputElement | null;
       if (fileInput?.files?.length && !icsData) {
           setError('File selected, but content could not be read. Please try re-selecting the file.');
       } else if (!fileName) {
           setError('Please select an ICS file.');
       } else {
           setError('Could not read the stored file content. Please try selecting the file again.');
       }
       setIsUploadSectionVisible(true);
      return;
    }
    await parseAndSetEvents(icsData, true);
  };

  const { currentEvent, nextEvent } = useMemo(() => {
    if (!allEvents) return { currentEvent: null, nextEvent: null };
    const now = new Date();
    let current: RelevantEvent | null = null;
    let next: RelevantEvent | null = null;
    const validEvents = allEvents.filter(event => {
        try {
            return typeof event.startDate === 'string' &&
                   typeof event.endDate === 'string' &&
                   !isNaN(parseISO(event.startDate).getTime()) &&
                   !isNaN(parseISO(event.endDate).getTime());
        } catch { return false; }
    });
    const sortedEvents = [...validEvents].sort((a, b) => {
        try {
            return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
        } catch {
             return 0;
        }
    });
    for (const event of sortedEvents) {
        try {
            const startDate = parseISO(event.startDate);
            const endDate = parseISO(event.endDate);
            if (startDate <= now && endDate > now) {
                if (!current || startDate > parseISO(current.startDate)) {
                current = event;
                }
            }
            else if (startDate > now) {
                if (!next || startDate < parseISO(next.startDate)) {
                next = event;
                }
            }
        } catch (e) {
             console.warn("Skipping event in current/next calculation due to date parsing error:", event, e);
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
                        return checkStartDate > currentEndDate;
                    } catch { return false; }
                }) || null;
            }
        } catch (e) {
             console.error("Error adjusting next event based on current event end time:", current, next, e);
             next = null;
        }
    }
    return { currentEvent: current, nextEvent: next };
  }, [allEvents]);

   const eventsForWeek = useMemo(() => {
    if (!allEvents) return [];
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekInterval = { start: currentWeekStart, end: weekEnd };
    return allEvents.filter(event => {
      try {
        const startDate = parseISO(event.startDate);
        const endDate = parseISO(event.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn("Skipping event with invalid date:", event);
            return false;
        }
        return isWithinInterval(startDate, weekInterval) ||
               (startDate < currentWeekStart && endDate >= currentWeekStart);
      } catch (error) {
          console.error("Error processing event date for filtering:", event, error);
          return false;
      }
    });
  }, [allEvents, currentWeekStart]);

  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const toggleUploadVisibility = () => {
    setIsUploadSectionVisible(!isUploadSectionVisible);
  };

  const renderEventCard = (event: RelevantEvent | null, type: 'Current' | 'Next') => {
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let cardDescriptionContent: React.ReactNode = null;
      let cardContentContent: React.ReactNode = null;
      const label = type === 'Current' ? 'Current Class' : 'Next Class';

      if(event) {
          try {
              startDate = parseISO(event.startDate);
              endDate = parseISO(event.endDate);
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                  event = null;
              }
          } catch (error) {
              console.error("Error parsing date for event card:", event, error);
              event = null;
          }
      }

    if (!event || !startDate || !endDate) {
      return (
        <Card className="mt-4 bg-secondary/50">
          <CardHeader>
            <CardTitle className="text-lg font-normal flex items-center gap-2 text-muted-foreground">
              <Info className="w-5 h-5" />
              No {type.toLowerCase()} class found
            </CardTitle>
             {type === 'Next' && currentEvent && (() => {
                 try {
                     const currentEndDate = parseISO(currentEvent.endDate);
                     if (!isNaN(currentEndDate.getTime())) {
                         return (
                            <CardDescription className="text-xs pl-7 text-muted-foreground">
                                (After the current class finishes at {format(currentEndDate, "h:mm a")})
                            </CardDescription>
                         );
                     }
                 } catch { /* Ignore parsing errors here */ }
                 return null;
             })()}
          </CardHeader>
        </Card>
      );
    }

     const now = new Date();
     cardDescriptionContent = (
         <>
            {format(startDate, "eeee, MMMM do, yyyy")}
            <br />
            {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
            {type === 'Next' && startDate > now && (
                <span className="text-muted-foreground ml-2">
                    (starts in {formatDistanceToNow(startDate)})
                </span>
            )}
            {type === 'Current' && endDate > now && (
                <span className="text-muted-foreground ml-2">
                    (ends in {formatDistanceToNow(endDate)})
                </span>
            )}
            {type === 'Current' && endDate <= now && (
                <span className="text-destructive ml-2">
                    (ended {formatDistanceToNow(endDate)} ago)
                </span>
            )}
         </>
     );

     cardContentContent = (
         <>
             {event.isRecurring && (
                 <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                     <Info className="w-3.5 h-3.5" /> Recurring Event Occurrence
                 </p>
             )}
             {event.location && (
                 <p className="flex items-center gap-1.5">
                     <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                     <span className="truncate" title={event.location}>{event.location}</span>
                 </p>
             )}
             {event.description && (
                 <div className="pt-2">
                     <p className="flex items-center gap-1.5 font-medium mb-1">
                         <FileText className="w-4 h-4 text-muted-foreground shrink-0" /> Description:
                     </p>
                     <p className="text-muted-foreground pl-6 whitespace-pre-wrap break-words text-xs leading-relaxed max-h-24 overflow-y-auto">
                         {event.description}
                     </p>
                 </div>
             )}
             {!event.location && !event.description && !event.isRecurring && (
                 <p className="text-muted-foreground italic text-xs pl-6">No additional details.</p>
             )}
         </>
     );

    return (
      <Card className={`mt-4 shadow-md ${type === 'Current' ? 'border-primary ring-1 ring-primary' : 'border-border'} ${isSameDay(startDate, new Date()) ? 'bg-card' : ''}`}>
        <CardHeader>
           <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-1">{label}</CardDescription>
          <CardTitle className="text-xl flex items-center gap-2 text-primary">
             <CalendarClock className={`w-5 h-5 shrink-0 ${type === 'Current' ? 'text-primary' : 'text-muted-foreground'}`} />
             <span className="flex-1 truncate" title={event.summary}>{event.summary || <span className="italic text-muted-foreground">No Title</span>}</span>
          </CardTitle>
           <CardDescription className="text-sm pt-1 pl-7 text-foreground/80">
               {cardDescriptionContent}
           </CardDescription>
        </CardHeader>
         {cardContentContent && (
            <CardContent className="space-y-2 text-sm pt-2 pb-4 pl-7">
                {cardContentContent}
            </CardContent>
         )}
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="w-full mx-auto">
        <Card className="shadow-lg overflow-hidden mb-8 bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div className="flex items-center gap-4">
                 <Link href="/" passHref legacyBehavior>
                    <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground h-10 w-10 flex-shrink-0">
                         <ArrowLeft className="h-5 w-5" />
                         <span className="sr-only">Back to Calendar</span>
                     </Button>
                 </Link>
                 <div className="flex-grow">
                     <CardTitle className="text-2xl text-primary">Timetable Importer</CardTitle>
                     <CardDescription className="text-sm text-muted-foreground">
                         {fileName ? `Viewing timetable from ${fileName}.` : 'Upload your .ics calendar file to view timetable.'}
                     </CardDescription>
                 </div>
             </div>
            {allEvents && !error && (
              <Button variant="ghost" size="icon" onClick={toggleUploadVisibility} aria-label={isUploadSectionVisible ? "Hide upload section" : "Show upload section"}>
                {isUploadSectionVisible ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            )}
          </CardHeader>

          <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              isUploadSectionVisible ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}>
              {isUploadSectionVisible && (
                  <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-6 pb-4">
                      {error && (
                      <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      )}
                      <div className="grid w-full items-center gap-1.5">
                      <Input
                          id="icsFile"
                          name="icsFile"
                          type="file"
                          accept=".ics,text/calendar"
                          onChange={handleFileChange}
                          className="hidden"
                          aria-label="Select ICS file"
                          key={fileName || 'no-file'}
                          />
                      <Label
                          htmlFor="icsFile"
                          className={cn(
                          buttonVariants({ variant: "outline" }),
                          "w-full cursor-pointer flex items-center justify-center gap-2 h-10 border-primary text-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground"
                          )}
                      >
                          <FileUp className="mr-2 h-4 w-4" />
                          {fileName ? `File selected: ${fileName}` : 'Choose .ics File'}
                          <span className="sr-only">Select ICS file</span>
                      </Label>
                          {fileName && !isLoading && !error && (
                              <p className="text-sm text-muted-foreground text-center pt-2">
                              Using file: <span className="font-medium text-foreground">{fileName}</span>
                              </p>
                          )}
                      </div>
                  </CardContent>
                  <CardFooter className="bg-secondary/50 py-4 px-6 border-t">
                      <Button type="submit" disabled={isLoading || !icsData} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                      {isLoading ? (
                          <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {allEvents ? 'Updating Timetable...' : 'Processing...'}
                          </>
                      ) : (
                          <>
                          <Upload className="mr-2 h-4 w-4" /> {allEvents ? 'Refresh Timetable' : 'Show Timetable'}
                          </>
                      )}
                      </Button>
                  </CardFooter>
                  </form>
              )}
          </div>
        </Card>

        {isLoading && !allEvents && <div className="flex justify-center my-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

        {!isLoading && allEvents && !error && (
             <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                 {renderEventCard(currentEvent, 'Current')}
                 {renderEventCard(nextEvent, 'Next')}
             </div>
         )}

       {!isLoading && allEvents && !error && (
         <div className="mt-8">
           <Card className="shadow-md bg-card border-border">
             <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
               <CardTitle className="text-xl text-primary">
                 Week of {format(currentWeekStart, "MMMM do, yyyy")}
               </CardTitle>
               <div className="flex space-x-2">
                 <Button variant="outline" size="icon" onClick={goToPreviousWeek} disabled={!allEvents} className="border-primary text-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
                   <ChevronLeft className="h-4 w-4" />
                   <span className="sr-only">Previous Week</span>
                 </Button>
                 <Button variant="outline" size="icon" onClick={goToNextWeek} disabled={!allEvents} className="border-primary text-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground">
                   <ChevronRight className="h-4 w-4" />
                   <span className="sr-only">Next Week</span>
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="pt-4 pb-2">
               <WeeklyCalendar weekStartDate={currentWeekStart} events={eventsForWeek} />
             </CardContent>
           </Card>
         </div>
       )}

        {!isLoading && !icsData && !error && !isUploadSectionVisible && (
             <div className="mt-8 text-center text-muted-foreground">
               Upload an ICS file to get started. Click the arrow above to show the upload section.
             </div>
        )}
         {!isLoading && !icsData && !error && isUploadSectionVisible && (
             <div className="mt-8 text-center text-muted-foreground">
               Upload an ICS file above to get started.
             </div>
         )}
       </div>
    </div>
  );
}

    