
"use client";

import type * as React from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; // Import Label

// Removed props related to calendar tasks
interface TaskListSheetProps {}

export function TaskListSheet({}: TaskListSheetProps) {
    // State for the textarea content, persisted in local storage
    const [notes, setNotes] = useLocalStorage<string>('weekwise-scratchpad-notes', '');

    const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(event.target.value);
    };

    return (
        // Use flex-grow to allow textarea to fill available space
        <div className="p-4 flex flex-col flex-grow">
            <Label htmlFor="scratchpad-notes" className="text-sm font-medium mb-2 text-muted-foreground">
                Jot down quick notes or tasks here.
            </Label>
            <Textarea
                id="scratchpad-notes"
                value={notes}
                onChange={handleNotesChange}
                placeholder="Start typing..."
                // Make textarea take up remaining height
                className="flex-grow resize-none text-sm" // Added text-sm for consistency
                aria-label="Scratchpad notes"
            />
        </div>
    );
}
