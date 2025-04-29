
"use client";

import type * as React from 'react';
import { useRef, useCallback } from 'react'; // Import useCallback
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
        // Basic auto-indent on space after "1." or "-" is now handled in onKeyDown
        // Keep this basic update for typing other characters
        setNotes(newValue);
    };

     const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = event.currentTarget;
        const value = textarea.value;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd; // Needed for replacement

        // Handle Enter key press for list continuation
        if (event.key === 'Enter') {
            // Find the start of the current line
            const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
            const currentLineText = value.substring(currentLineStart, selectionStart);

            // Regex to match numbered list items (e.g., "1. ", " 1. ", "\t1. ")
            const numberedListMatch = currentLineText.match(/^(\s*)(\d+)\.\s+/);
            // Regex to match bulleted list items (e.g., "- ", " - ", "\t- ")
            const bulletListMatch = currentLineText.match(/^(\s*)-\s+/);

            if (numberedListMatch) {
                event.preventDefault(); // Prevent default Enter behavior

                const indentation = numberedListMatch[1] || ''; // Capture existing indentation
                const currentNumber = parseInt(numberedListMatch[2], 10);
                const nextNumber = currentNumber + 1;
                const textToInsert = `\n${indentation}${nextNumber}. `;

                // Insert the new numbered list item
                 const newValue =
                    value.substring(0, selectionStart) +
                    textToInsert +
                    value.substring(selectionEnd);

                setNotes(newValue);

                // Move cursor to the end of the inserted text
                // Use setTimeout to ensure the cursor position updates after state change
                setTimeout(() => {
                     if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + textToInsert.length;
                    }
                }, 0);

            } else if (bulletListMatch) {
                event.preventDefault(); // Prevent default Enter behavior

                const indentation = bulletListMatch[1] || ''; // Capture existing indentation
                const textToInsert = `\n${indentation}- `;

                // Insert the new bullet list item
                const newValue =
                    value.substring(0, selectionStart) +
                    textToInsert +
                    value.substring(selectionEnd);

                setNotes(newValue);

                // Move cursor to the end of the inserted text
                 setTimeout(() => {
                     if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + textToInsert.length;
                    }
                 }, 0);
            }
            // If not a list item, let Enter behave normally (handled by default textarea behavior)
        }

         // Handle Space key press for initial indentation
         if (event.key === ' ') {
             const charBeforeSpace = value[selectionStart - 1];
             const twoCharsBeforeSpace = value.substring(selectionStart - 2, selectionStart);
             const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;

             // Check for "1." just typed at the start of the line
             if (twoCharsBeforeSpace === '1.' && selectionStart - currentLineStart === 2) {
                 event.preventDefault(); // Prevent the space from being added normally
                 const textToInsert = '\t1. ';
                 const newValue =
                    value.substring(0, currentLineStart) +
                    textToInsert +
                    value.substring(selectionEnd);
                setNotes(newValue);
                setTimeout(() => {
                     if (textareaRef.current) {
                        const newCursorPos = currentLineStart + textToInsert.length;
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
                    }
                }, 0);
             }
             // Check for "-" just typed at the start of the line
             else if (charBeforeSpace === '-' && selectionStart - currentLineStart === 1) {
                 event.preventDefault(); // Prevent the space from being added normally
                 const textToInsert = '\t- ';
                 const newValue =
                    value.substring(0, currentLineStart) +
                    textToInsert +
                    value.substring(selectionEnd);
                 setNotes(newValue);
                  setTimeout(() => {
                     if (textareaRef.current) {
                        const newCursorPos = currentLineStart + textToInsert.length;
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
                    }
                }, 0);
             }
         }

    }, [setNotes]); // Added setNotes to dependencies


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
                onKeyDown={handleKeyDown} // Add keydown handler
                placeholder="Start typing..."
                // Make textarea take up remaining height
                className="flex-grow resize-none text-sm" // Added text-sm for consistency
                aria-label="Scratchpad notes"
            />
        </div>
    );
}
