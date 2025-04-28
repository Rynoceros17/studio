
"use client";

import type * as React from 'react';
import { useRef } from 'react'; // Import useRef
import useLocalStorage from '@/hooks/use-local-storage';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; // Import Label

// Removed props related to calendar tasks
interface TaskListSheetProps {}

export function TaskListSheet({}: TaskListSheetProps) {
    // State for the textarea content, persisted in local storage
    const [notes, setNotes] = useLocalStorage<string>('weekwise-scratchpad-notes', '');
    const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the textarea element

    const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = event.target;
        const newValue = textarea.value;
        const cursorPos = textarea.selectionStart;
        let modifiedValue = newValue;
        let newCursorPos = cursorPos;
        let shouldAdjustCursor = false;

        // Check if the character just typed was a space
        if (newValue[cursorPos - 1] === ' ') {
            // Find the start of the current line
            const lineStartIndex = newValue.lastIndexOf('\n', cursorPos - 2) + 1;
            // Get text from line start up to the character before the typed space
            const textBeforeSpaceOnLine = newValue.substring(lineStartIndex, cursorPos - 1);

            // Check for "1." pattern at the start of the line
            if (lineStartIndex === cursorPos - 3 && textBeforeSpaceOnLine === '1.') {
                // Prepend tab for indentation
                modifiedValue =
                    newValue.substring(0, lineStartIndex) +
                    '\t' +
                    newValue.substring(lineStartIndex);
                newCursorPos = cursorPos + 1; // Adjust cursor for the added tab
                shouldAdjustCursor = true;
            }
            // Check for "-" pattern at the start of the line
            else if (lineStartIndex === cursorPos - 2 && textBeforeSpaceOnLine === '-') {
                 // Prepend tab for indentation
                 modifiedValue =
                    newValue.substring(0, lineStartIndex) +
                    '\t' +
                    newValue.substring(lineStartIndex);
                 newCursorPos = cursorPos + 1; // Adjust cursor for the added tab
                 shouldAdjustCursor = true;
            }
        }

        setNotes(modifiedValue);

        // Adjust cursor position in the next tick if necessary
        if (shouldAdjustCursor && textareaRef.current) {
             // Use setTimeout to defer cursor update until after React processes state update
             setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
                }
             }, 0);
        }
    };

    return (
        // Use flex-grow to allow textarea to fill available space
        <div className="p-4 flex flex-col flex-grow">
            <Label htmlFor="scratchpad-notes" className="text-sm font-medium mb-2 text-muted-foreground">
                Jot down quick notes or tasks here. (Try starting a line with "1. " or "- ")
            </Label>
            <Textarea
                ref={textareaRef} // Assign ref
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
