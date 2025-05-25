
"use client";

import type * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import useLocalStorage from '@/hooks/useLocalStorage'; // Changed from useSyncedStorage
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn, truncateText } from '@/lib/utils'; 

interface Bookmark {
    id: string;
    name: string;
    url: string;
}

export function BookmarkListSheet() {
    const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>('weekwise-bookmarks', []);
    const [newBookmarkName, setNewBookmarkName] = useState('');
    const [newBookmarkUrl, setNewBookmarkUrl] = useState('');
    const { toast } = useToast();
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isValidUrl = (url: string): boolean => {
        try {
            
            const parsedUrl = new URL(url);
            return ['http:', 'https:'].includes(parsedUrl.protocol) && parsedUrl.hostname !== '';
        } catch (e) {
            return false;
        }
    };

    const addBookmark = useCallback(() => {
        if (!newBookmarkName.trim()) {
            toast({
                title: "Missing Name",
                description: "Please provide a name for the bookmark.",
                variant: "destructive",
            });
            return;
        }
        if (!isValidUrl(newBookmarkUrl)) {
             toast({
                title: "Invalid URL",
                description: "Please enter a valid URL starting with http:// or https://.",
                variant: "destructive",
            });
            return;
        }

        const newBookmark: Bookmark = {
            id: crypto.randomUUID(),
            name: newBookmarkName.trim(),
            url: newBookmarkUrl.trim(),
        };
        setBookmarks(prev => [...prev, newBookmark]);
        setNewBookmarkName('');
        setNewBookmarkUrl('');
        nameInputRef.current?.focus(); 
        toast({
            title: "Bookmark Added",
            description: `"${newBookmark.name}" added successfully.`,
        });
    }, [newBookmarkName, newBookmarkUrl, setBookmarks, toast]);

    const deleteBookmark = useCallback((id: string) => {
        const bookmarkToDelete = bookmarks.find(b => b.id === id);
        setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
        if (bookmarkToDelete) {
            toast({
                title: "Bookmark Removed",
                description: `"${bookmarkToDelete.name}" removed.`,
                variant: "destructive",
            });
        }
    }, [bookmarks, setBookmarks, toast]);

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            addBookmark();
        }
    };

     
     const openLink = (url: string) => {
        
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        
        <div className="flex flex-col flex-grow p-4 pt-0 space-y-4 overflow-hidden"> 

            
            <div className="p-4 border-b shrink-0 space-y-3 bg-secondary/30 rounded-b-md"> 
                <div>
                    <Label htmlFor="bookmark-name" className="text-xs font-medium text-muted-foreground">
                        Bookmark Name
                    </Label>
                    <Input
                        ref={nameInputRef}
                        id="bookmark-name"
                        value={newBookmarkName}
                        onChange={(e) => setNewBookmarkName(e.target.value)}
                        placeholder="e.g., Project Docs"
                        className="h-8 text-sm"
                        onKeyPress={handleKeyPress}
                    />
                </div>
                <div>
                    <Label htmlFor="bookmark-url" className="text-xs font-medium text-muted-foreground">
                        URL (starts with http/https)
                    </Label>
                    <Input
                        id="bookmark-url"
                        value={newBookmarkUrl}
                        onChange={(e) => setNewBookmarkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="h-8 text-sm"
                        type="url" 
                         onKeyPress={handleKeyPress}
                    />
                </div>
                <Button onClick={addBookmark} size="sm" className="w-full h-9">
                    <Plus className="mr-2 h-4 w-4" /> Add Bookmark
                </Button>
            </div>


            
            <ScrollArea className="flex-grow">
                 <div className="p-4 space-y-2"> 
                    {bookmarks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center pt-4">No bookmarks yet. Add one above!</p>
                    ) : (
                        bookmarks.map((bookmark) => (
                            <Card key={bookmark.id} className="overflow-hidden shadow-sm border hover:shadow-md transition-shadow duration-200">
                                <CardContent className="p-2 flex items-center justify-between space-x-2">
                                     <div className="flex items-center space-x-2 flex-grow min-w-0 cursor-pointer group" onClick={() => openLink(bookmark.url)}>
                                        <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary group-hover:underline" title={bookmark.name}>
                                                {bookmark.name}
                                            </p>
                                            
                                            <p className="text-xs text-muted-foreground truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary" title={bookmark.url}>
                                                {truncateText(bookmark.url, 25)} 
                                            </p>
                                        </div>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
                                        onClick={() => deleteBookmark(bookmark.id)}
                                        aria-label={`Delete bookmark ${bookmark.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
