
"use client";

import type * as React from 'react';
import { useRef, useCallback } from 'react'; 
import useLocalStorage from '@/hooks/useLocalStorage'; // Changed from useSyncedStorage
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; 


interface TaskListSheetProps {}

export function TaskListSheet({}: TaskListSheetProps) {
    
    const [notes, setNotes] = useLocalStorage<string>('weekwise-scratchpad-notes', '');
    const textareaRef = useRef<HTMLTextAreaElement>(null); 

    const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = event.target;
        const newValue = textarea.value;
        
        
        setNotes(newValue);
    };

     const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = event.currentTarget;
        const value = textarea.value;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd; 

        
        if (event.key === 'Enter') {
            
            const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
            const currentLineText = value.substring(currentLineStart, selectionStart);

            
            const numberedListMatch = currentLineText.match(/^(\s*)(\d+)\.\s+/);
            
            const bulletListMatch = currentLineText.match(/^(\s*)-\s+/);

            if (numberedListMatch) {
                event.preventDefault(); 

                const indentation = numberedListMatch[1] || ''; 
                const currentNumber = parseInt(numberedListMatch[2], 10);
                const nextNumber = currentNumber + 1;
                const textToInsert = `\n${indentation}${nextNumber}. `;

                
                 const newValue =
                    value.substring(0, selectionStart) +
                    textToInsert +
                    value.substring(selectionEnd);

                setNotes(newValue);

                
                
                setTimeout(() => {
                     if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + textToInsert.length;
                    }
                }, 0);

            } else if (bulletListMatch) {
                event.preventDefault(); 

                const indentation = bulletListMatch[1] || ''; 
                const textToInsert = `\n${indentation}- `;

                
                const newValue =
                    value.substring(0, selectionStart) +
                    textToInsert +
                    value.substring(selectionEnd);

                setNotes(newValue);

                
                 setTimeout(() => {
                     if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + textToInsert.length;
                    }
                 }, 0);
            }
            
        }

         
         if (event.key === ' ') {
             const charBeforeSpace = value[selectionStart - 1];
             const twoCharsBeforeSpace = value.substring(selectionStart - 2, selectionStart);
             const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;

             
             if (twoCharsBeforeSpace === '1.' && selectionStart - currentLineStart === 2) {
                 event.preventDefault(); 
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
             
             else if (charBeforeSpace === '-' && selectionStart - currentLineStart === 1) {
                 event.preventDefault(); 
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

    }, [setNotes]); 


    return (
        
        <div className="p-4 flex flex-col flex-grow">
            <Label htmlFor="scratchpad-notes" className="text-sm font-medium mb-2 text-muted-foreground">
                Jot down quick notes or tasks here. (Try starting a line with "1. " or "- ")
            </Label>
            <Textarea
                ref={textareaRef} 
                id="scratchpad-notes"
                value={notes}
                onChange={handleNotesChange}
                onKeyDown={handleKeyDown} 
                placeholder="Start typing..."
                
                className="flex-grow resize-none text-sm" 
                aria-label="Scratchpad notes"
            />
        </div>
    );
}
