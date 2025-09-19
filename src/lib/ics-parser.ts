// src/lib/ics-parser.ts
'use server'; // Mark this module for server-side execution if needed

import * as iCal from 'node-ical'; // Use node-ical library
import type { CalendarResponse, VEvent } from 'node-ical'; // Import types

// Define a simpler event structure for our needs
export interface RelevantEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  startDate: string; // Keep as ISO string
  endDate: string;   // Keep as ISO string
  isRecurring: boolean;
}

export interface ParseResult {
  allEvents: RelevantEvent[];
  error?: string;
}

export async function parseIcsContent(icsContent: string): Promise<ParseResult> {
  try {
    if (!icsContent || typeof icsContent !== 'string') {
        return { allEvents: [], error: 'Invalid ICS content provided.' };
    }

    console.log("Attempting to parse ICS content with node-ical...");
    // node-ical parseICS is synchronous
    const rawEventsObject: CalendarResponse = iCal.parseICS(icsContent);
    console.log("Raw parsed object:", rawEventsObject); // Log the direct output

    if (!rawEventsObject || typeof rawEventsObject !== 'object') {
      return { allEvents: [], error: 'Failed to parse ICS content into a valid object.' };
    }

    const allRelevantEvents: RelevantEvent[] = [];

    // Iterate through the parsed object (map of UIDs to events/calendar components)
    for (const uid in rawEventsObject) {
        if (Object.prototype.hasOwnProperty.call(rawEventsObject, uid)) {
            const eventData = rawEventsObject[uid]; // Type is CalendarComponent

            // Basic validation: check if it's a VEVENT type
            if (eventData.type === 'VEVENT' && eventData.start && eventData.end) {
                // Cast to VEvent for easier access to properties
                const vevent = eventData as VEvent;
                let startDateStr: string;
                let endDateStr: string;

                try {
                    // node-ical returns Date objects for start/end
                    if (!(vevent.start instanceof Date) || isNaN(vevent.start.getTime())) {
                        throw new Error("Invalid start date format");
                    }
                    startDateStr = vevent.start.toISOString();

                    if (!(vevent.end instanceof Date) || isNaN(vevent.end.getTime())) {
                       // Attempt to derive end date from start + duration if end is missing/invalid
                       // node-ical might handle this, but check anyway
                       if (vevent.duration) {
                            // Duration logic could be added here if needed
                            console.warn(`Event UID ${uid} has potentially invalid end date, duration present but calculation not implemented.`);
                            throw new Error("Invalid end date format, duration calculation not implemented");
                       } else {
                           throw new Error("Invalid end date format");
                       }
                    }
                     endDateStr = vevent.end.toISOString();


                     // Handle recurrence - node-ical expands recurring events by default
                     // but also provides recurrenceid for instances.
                     // For simplicity, we'll treat each entry as a separate event.
                     // The 'rrule' property indicates the original recurring definition.
                     const relevantEvent: RelevantEvent = {
                        uid: vevent.uid || uid, // Prefer uid from event data if available
                        summary: vevent.summary || '', // Directly access summary
                        description: vevent.description || null,
                        location: vevent.location || null,
                        startDate: startDateStr,
                        endDate: endDateStr,
                        isRecurring: !!vevent.rrule || !!vevent.recurrenceid // Check for recurrence rule or if it's an instance
                    };
                    allRelevantEvents.push(relevantEvent);

                } catch (dateError: any) {
                     console.warn(`Skipping event UID ${uid} due to date processing error:`, dateError.message, eventData);
                     continue; // Skip this event if dates are invalid/problematic
                }

            } else {
                 console.log(`Skipping non-VEVENT item or item with missing dates: UID ${uid}, Type: ${eventData.type}`);
            }
        }
    }


    console.log(`Successfully processed ${allRelevantEvents.length} events.`);
    return { allEvents: allRelevantEvents };

  } catch (error: any) {
    console.error("Error in parseIcsContent:", error);
    let errorMessage = 'Failed to parse ICS file.';
    if (error instanceof Error) {
        errorMessage = `Parsing error: ${error.message}`;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    return { allEvents: [], error: errorMessage };
  }
}
