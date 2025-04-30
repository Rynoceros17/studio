// src/app/dashboard/page.tsx
'use client';

import React, { useState, useMemo, useEffect, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link'; // Import Link
import { parseIcsContent, type RelevantEvent } from '@/lib/ics-parser'; // Updated import path
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CalendarClock, AlertCircle, Info, MapPin, FileText, ChevronLeft, ChevronRight, FileUp, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'; // Added ArrowLeft
import { format, formatDistanceToNow, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, parseISO } from 'date-fns';
import WeeklyCalendar from '@/components/WeeklyCalendar'; // Updated import path
import { cn } from '@/lib/utils'; // Import cn utility

export default function DashboardPage() { // Renamed component for clarity
  const [isLoading, setIsLoading] = useState(false);
  const [allEvents, setAllEvents] = useState<RelevantEvent[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday start
  const [icsData, setIcsData] = useState<string | null>(null); // State to hold ICS content
  const [isUploadSectionVisible, setIsUploadSectionVisible] = useState(true); // State to control upload section visibility

  // --- Function to parse ICS data ---
  const parseAndSetEvents = async (data: string, isInitialLoad = false) => {
    setIsLoading(true);
    setError(null);
    // Don't clear allEvents here if we want to show old events while loading new ones
    // setAllEvents(null);
    try {
      const parseResult = await parseIcsContent(data);
      if (parseResult.error) {
        setError(parseResult.error);
        setAllEvents(null);
        setIsUploadSectionVisible(true); // Show upload on error
      } else {
        // Filter out events without a valid start date before setting state
        const validEvents = parseResult.allEvents.filter(event => {
            try {
                // Basic check if startDate is a string and can be parsed
                if (typeof event.startDate !== 'string') return false;
                return !isNaN(parseISO(event.startDate).getTime());
            } catch {
                return false;
            }
        });
        setAllEvents(validEvents);
        setError(null);
        setIsUploadSectionVisible(false); // Hide upload section on success
        // Only reset the week on initial load or manual refresh, not week navigation
        if (isInitialLoad) {
            setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        }
      }
    } catch (err: any) {
      console.error("Error parsing ICS data:", err);
      setError(`An error occurred while parsing: ${err.message || 'Unknown error'}`);
      setAllEvents(null);
      setIsUploadSectionVisible(true); // Show upload on error
    } finally {
      setIsLoading(false);
    }
  };


  // --- Load from localStorage on mount and parse if data exists ---
  useEffect(() => {
    const storedIcsData = localStorage.getItem('icsData');
    const storedFileName = localStorage.getItem('icsFileName');
    if (storedIcsData && storedFileName) {
      console.log("Found stored ICS data, attempting to parse...");
      setIcsData(storedIcsData);
      setFileName(storedFileName);
      // Automatically parse the stored data on initial load
      parseAndSetEvents(storedIcsData, true); // Pass true for initial load
    } else {
      console.log("No stored ICS data found.");
      setIsUploadSectionVisible(true); // Ensure upload is visible if no stored data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount


  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const fileInput = e.target; // Keep reference to the input element

    if (file) {
      // Validate file type *before* reading
      if (!file.name.toLowerCase().endsWith('.ics')) {
        setError('Invalid file type. Please upload a .ics file.');
        setFileName(null);
        setIcsData(null);
        setAllEvents(null); // Clear events if file is invalid
        setIsUploadSectionVisible(true); // Ensure upload section is visible
        localStorage.removeItem('icsData');
        localStorage.removeItem('icsFileName');
        if (fileInput) fileInput.value = ''; // Reset the input field
        return; // Stop processing if invalid type
      }


      setFileName(file.name);
      setError(null); // Clear previous errors on new file selection
      // Keep existing events visible while processing new file? Or clear? Let's clear for now.
      setAllEvents(null);
      setIsUploadSectionVisible(true); // Keep upload visible while processing


      try {
        setIsLoading(true); // Show loading indicator while reading
        const content = await file.text();
        if (!content) {
           throw new Error("File is empty or could not be read.");
        }
        setIcsData(content); // Store the file content in state
        localStorage.setItem('icsData', content); // Save to localStorage
        localStorage.setItem('icsFileName', file.name); // Save filename too
        setError(null); // Clear error if reading succeeds
        // Parse immediately after successful file read and storage
        await parseAndSetEvents(content, true); // Treat new file upload like initial load for week reset
      } catch (err: any) {
        console.error("Error reading file:", err);
        setError(`Could not read file content: ${err.message || 'Unknown error'}`);
        setAllEvents(null);
        setIcsData(null); // Clear data on error
        setFileName(null); // Clear filename on error
        setIsUploadSectionVisible(true); // Ensure upload section is visible on error
        localStorage.removeItem('icsData');
        localStorage.removeItem('icsFileName');
        if (fileInput) fileInput.value = ''; // Reset input on error
      } finally {
          setIsLoading(false); // Hide loading indicator
      }

    } else {
      // Handle case where file selection is cancelled/cleared
      setFileName(null);
      setIcsData(null);
      setAllEvents(null); // Clear results if file is removed
      setError(null); // Clear errors
      setIsUploadSectionVisible(true); // Ensure upload section is visible
      localStorage.removeItem('icsData');
      localStorage.removeItem('icsFileName');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default form submission

    if (!icsData) {
      // Check if a file is selected but not yet read (e.g., error during read)
       const form = e.target as HTMLFormElement;
       const fileInput = form.elements.namedItem('icsFile') as HTMLInputElement | null;
       if (fileInput?.files?.length && !icsData) {
           setError('File selected, but content could not be read. Please try re-selecting the file.');
       } else if (!fileName) { // Only show 'select file' if no file name is present
           setError('Please select an ICS file.');
       } else {
           // If fileName exists but no icsData, it implies an issue reading it initially
           setError('Could not read the stored file content. Please try selecting the file again.');
       }
       setIsUploadSectionVisible(true); // Make sure upload is visible if there's an error here
      return;
    }

    // Call the parsing function, treat manual submit as a refresh (true for initialLoad)
    await parseAndSetEvents(icsData, true);
  };

  // --- Find Current and Next Event ---
  const { currentEvent, nextEvent } = useMemo(() => {
    if (!allEvents) return { currentEvent: null, nextEvent: null };

    const now = new Date();
    let current: RelevantEvent | null = null;
    let next: RelevantEvent | null = null;

     // Filter out invalid events before sorting and processing
    const validEvents = allEvents.filter(event => {
        try {
            return typeof event.startDate === 'string' &&
                   typeof event.endDate === 'string' &&
                   !isNaN(parseISO(event.startDate).getTime()) &&
                   !isNaN(parseISO(event.endDate).getTime());
        } catch { return false; }
    });


    // Ensure validEvents is sorted by start date for reliable current/next logic
    const sortedEvents = [...validEvents].sort((a, b) => {
        try {
             // Should be safe now due to pre-filtering, but keep try-catch for defense
            return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
        } catch {
             return 0; // Should not happen if pre-filtering worked
        }
    });


    for (const event of sortedEvents) {
        try {
            const startDate = parseISO(event.startDate);
            const endDate = parseISO(event.endDate);

            // Check for current event: Starts before or at 'now' AND ends after 'now'
            if (startDate <= now && endDate > now) {
                // If multiple events are current, prioritize the one that started most recently
                if (!current || startDate > parseISO(current.startDate)) {
                current = event;
                }
            }
            // Check for next event: Starts after 'now'
            else if (startDate > now) {
                // If this is the first 'next' event found, or if it starts earlier than the current 'next'
                if (!next || startDate < parseISO(next.startDate)) {
                next = event;
                }
            }
        } catch (e) {
             console.warn("Skipping event in current/next calculation due to date parsing error:", event, e);
             continue; // Skip if dates are invalid for this event
        }
    }

    // If there's a current event, ensure the 'next' event starts *after* the current one ends
    if (current && next) {
        try {
            const nextStartDate = parseISO(next.startDate);
            const currentEndDate = parseISO(current.endDate);
            if (nextStartDate < currentEndDate) {
                // Find the *actual* next event starting after the current one finishes
                next = sortedEvents.find(event => {
                    try {
                        const checkStartDate = parseISO(event.startDate);
                        // Ensure current.endDate is valid before comparing
                         if (isNaN(currentEndDate.getTime())) return false; // Skip if current event end date is invalid
                        return checkStartDate > currentEndDate; // Find first event starting after current ends
                    } catch { return false; } // Skip if event start date is invalid
                }) || null; // Find the first one, or null if none exist after current
            }
        } catch (e) {
             console.error("Error adjusting next event based on current event end time:", current, next, e);
             // Potentially reset 'next' if error occurs during adjustment
             next = null;
        }
    }


    return { currentEvent: current, nextEvent: next };
  }, [allEvents]);


  // --- Filter Events for the Current Week ---
   const eventsForWeek = useMemo(() => {
    if (!allEvents) return [];
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 }); // Calculate end of week
    const weekInterval = { start: currentWeekStart, end: weekEnd };

    return allEvents.filter(event => {
      try {
        const startDate = parseISO(event.startDate);
        const endDate = parseISO(event.endDate);

        // Basic validation: ensure dates are valid before proceeding
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn("Skipping event with invalid date:", event);
            return false;
        }

        // Include events that *start* within the week OR *overlap* with the week
        return isWithinInterval(startDate, weekInterval) || // Starts within the week
               (startDate < currentWeekStart && endDate >= currentWeekStart); // Starts before, ends within/after
      } catch (error) {
          console.error("Error processing event date for filtering:", event, error);
          return false; // Exclude event if date parsing fails
      }
    });
  }, [allEvents, currentWeekStart]);

  // --- Week Navigation ---
  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  // --- Toggle Upload Section Visibility ---
  const toggleUploadVisibility = () => {
    setIsUploadSectionVisible(!isUploadSectionVisible);
  };


  // --- Rendering Logic ---
  const renderEventCard = (event: RelevantEvent | null, type: 'Current' | 'Next') => {
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let cardDescriptionContent: React.ReactNode = null;
      let cardContentContent: React.ReactNode = null;

      if(event) {
          try {
              startDate = parseISO(event.startDate);
              endDate = parseISO(event.endDate);
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                  // If dates are invalid, treat as if event is null for rendering
                  event = null;
              }
          } catch (error) {
              console.error("Error parsing date for event card:", event, error);
              event = null; // Treat as null if parsing fails
          }
      }


    if (!event || !startDate || !endDate) { // Check if event or dates became null
      return (
        <Card className="mt-4 bg-secondary/50">
          <CardHeader>
            <CardTitle className="text-lg font-normal flex items-center gap-2 text-muted-foreground">
              <Info className="w-5 h-5" />
              No {type.toLowerCase()} event found
            </CardTitle>
             {type === 'Next' && currentEvent && (() => {
                 try {
                     const currentEndDate = parseISO(currentEvent.endDate);
                     if (!isNaN(currentEndDate.getTime())) {
                         return (
                            <CardDescription className="text-xs pl-7 text-muted-foreground">
                                (After the current event finishes at {format(currentEndDate, "h:mm a")})
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


    // If dates are valid, proceed with formatting and rendering
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
                     <span className="truncate" title={event.location}>{event.location}</span> {/* Added truncate */}
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
      <Card className={`mt-4 shadow-md ${type === 'Current' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-primary"> {/* Added text-primary */}
             <CalendarClock className={`w-5 h-5 shrink-0 ${type === 'Current' ? 'text-primary' : 'text-muted-foreground'}`} />
             <span className="flex-1 truncate" title={event.summary}>{event.summary || <span className="italic text-muted-foreground">No Title</span>}</span> {/* Added truncate */}
          </CardTitle>
           <CardDescription className="text-sm pt-1 pl-7 text-foreground/80"> {/* Use less prominent foreground */}
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
        {/* Back Button */}
        <div className="mb-4">
            <Link href="/" passHref legacyBehavior>
                <Button variant="outline" className="text-primary border-primary hover:bg-primary/10">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Calendar
                </Button>
            </Link>
        </div>

      {/* Main Content Area */}
      <div className="w-full max-w-5xl mx-auto"> {/* Increased max width from 3xl to 5xl */}
        <Card className="shadow-lg overflow-hidden mb-8 bg-card border-border"> {/* Added mb-8, explicit background/border */}
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4"> {/* Added border-b and padding */}
            <div>
                <CardTitle className="text-2xl text-primary">ICS Event Viewer</CardTitle> {/* Apply primary color */}
                <CardDescription className="text-sm text-muted-foreground"> {/* Muted description */}
                  {fileName ? `Viewing events from ${fileName}.` : 'Upload your .ics calendar file.'}
                </CardDescription>
            </div>
            {allEvents && !error && ( // Show toggle button only if events are loaded successfully
              <Button variant="ghost" size="icon" onClick={toggleUploadVisibility} aria-label={isUploadSectionVisible ? "Hide upload section" : "Show upload section"}>
                {isUploadSectionVisible ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            )}
          </CardHeader>

          {/* Conditionally render upload form */}
          <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden", // Added overflow-hidden
              isUploadSectionVisible ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}>
              {isUploadSectionVisible && ( // Also conditionally mount/unmount for better performance? Or just hide? Hiding is simpler for state.
                  <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-6 pb-4"> {/* Adjusted padding */}
                      {error && (
                      <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      )}
                      {/* --- File Input Section --- */}
                      <div className="grid w-full items-center gap-1.5">
                      {/* Hidden actual input */}
                      <Input
                          id="icsFile"
                          name="icsFile"
                          type="file"
                          accept=".ics,text/calendar"
                          onChange={handleFileChange}
                          className="hidden" // Hide the default input
                          aria-label="Select ICS file"
                          key={fileName || 'no-file'} // Force re-render of input when file changes/clears
                          />
                      {/* Label styled as a Button */}
                      <Label
                          htmlFor="icsFile"
                          className={cn(
                          buttonVariants({ variant: "outline" }), // Style as an outline button
                          "w-full cursor-pointer flex items-center justify-center gap-2 h-10 border-primary text-primary hover:bg-primary/10" // Adjusted styling
                          )}
                      >
                          <FileUp className="mr-2 h-4 w-4" />
                          {fileName ? `File selected: ${fileName}` : 'Choose .ics File'}
                          <span className="sr-only">Select ICS file</span>
                      </Label>
                          {fileName && !isLoading && !error && ( // Show filename only when not loading/erroring
                              <p className="text-sm text-muted-foreground text-center pt-2">
                              Using file: <span className="font-medium text-foreground">{fileName}</span> {/* Ensure contrast */}
                              </p>
                          )}
                      </div>
                  </CardContent>
                  <CardFooter className="bg-secondary/50 py-4 px-6 border-t"> {/* Styled footer */}
                      <Button type="submit" disabled={isLoading || !icsData} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"> {/* Primary button */}
                      {isLoading ? (
                          <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {allEvents ? 'Updating Events...' : 'Processing...'}
                          </>
                      ) : (
                          <>
                          <Upload className="mr-2 h-4 w-4" /> {allEvents ? 'Refresh Events' : 'Show Events'}
                          </>
                      )}
                      </Button>
                  </CardFooter>
                  </form>
              )}
          </div>
        </Card>

        {/* Show loading indicator centrally if loading during initial parse */}
        {isLoading && !allEvents && <div className="flex justify-center my-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

        {/* Display Current/Next Event Cards */}
        {!isLoading && allEvents && !error && ( // Only show if not loading and events exist
             <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                 {renderEventCard(currentEvent, 'Current')}
                 {renderEventCard(nextEvent, 'Next')}
             </div>
         )}

        {/* Weekly Calendar Section */}
       {!isLoading && allEvents && !error && ( // Only show if not loading and events exist
         <div className="mt-8">
           <Card className="shadow-md bg-card border-border"> {/* Styled card */}
             <CardHeader className="flex flex-row items-center justify-between pb-2 border-b"> {/* Added border-b */}
               <CardTitle className="text-xl text-primary"> {/* Primary color title */}
                 Week of {format(currentWeekStart, "MMMM do, yyyy")}
               </CardTitle>
               <div className="flex space-x-2">
                 <Button variant="outline" size="icon" onClick={goToPreviousWeek} disabled={!allEvents} className="border-primary text-primary hover:bg-primary/10"> {/* Styled button */}
                   <ChevronLeft className="h-4 w-4" />
                   <span className="sr-only">Previous Week</span>
                 </Button>
                 <Button variant="outline" size="icon" onClick={goToNextWeek} disabled={!allEvents} className="border-primary text-primary hover:bg-primary/10"> {/* Styled button */}
                   <ChevronRight className="h-4 w-4" />
                   <span className="sr-only">Next Week</span>
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="pt-4 pb-2"> {/* Adjusted padding */}
               <WeeklyCalendar weekStartDate={currentWeekStart} events={eventsForWeek} />
             </CardContent>
           </Card>
         </div>
       )}

        {/* Show message if no file is loaded and not currently loading and upload is hidden */}
        {!isLoading && !icsData && !error && !isUploadSectionVisible && (
             <div className="mt-8 text-center text-muted-foreground">
               Upload an ICS file to get started. Click the arrow above to show the upload section.
             </div>
        )}
         {/* Show message if no file is loaded and not currently loading and upload is visible */}
         {!isLoading && !icsData && !error && isUploadSectionVisible && (
             <div className="mt-8 text-center text-muted-foreground">
               Upload an ICS file above to get started.
             </div>
         )}
       </div>
    </div>
  );
}
