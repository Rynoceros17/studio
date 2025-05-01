
"use client";

import type * as React from 'react';
import { useState, useCallback } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Upload, FileImage } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // Import next/image
import { cn, truncateText } from '@/lib/utils';

interface CapturedImage {
    id: string;
    dataUrl: string; // Store image as data URL
    name: string;
}

export function QuickCaptureSheet() {
    const [images, setImages] = useLocalStorage<CapturedImage[]>('weekwise-quick-capture', []);
    const { toast } = useToast();

    const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileReadPromises = Array.from(files).map(file => {
            return new Promise<CapturedImage | null>((resolve) => {
                // Basic validation (e.g., allow only images)
                if (!file.type.startsWith('image/')) {
                    toast({
                        title: "Invalid File Type",
                        description: `"${file.name}" is not an image and was skipped.`,
                        variant: "destructive",
                    });
                    resolve(null);
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                     const dataUrl = e.target?.result as string;
                      if (dataUrl) {
                          resolve({
                            id: crypto.randomUUID(),
                            dataUrl: dataUrl,
                            name: file.name,
                        });
                      } else {
                          toast({
                            title: "Read Error",
                            description: `Could not read file "${file.name}".`,
                            variant: "destructive",
                        });
                        resolve(null);
                      }
                };
                 reader.onerror = () => {
                    toast({
                        title: "Read Error",
                        description: `Error reading file "${file.name}".`,
                        variant: "destructive",
                    });
                    resolve(null);
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(fileReadPromises).then(newImages => {
             const validImages = newImages.filter((img): img is CapturedImage => img !== null);
            if (validImages.length > 0) {
                setImages(prev => [...prev, ...validImages]);
                 toast({
                    title: "Image(s) Added",
                    description: `${validImages.length} image(s) added to Quick Capture.`,
                });
            }
        });

        // Clear the input value to allow uploading the same file again
        event.target.value = '';

    }, [setImages, toast]);

    const deleteImage = useCallback((id: string) => {
        const imageToDelete = images.find(img => img.id === id);
        setImages(prev => prev.filter(img => img.id !== id));
         if (imageToDelete) {
             toast({
                title: "Image Removed",
                description: `"${truncateText(imageToDelete.name, 20)}" removed.`,
                variant: "destructive",
            });
         }
    }, [images, setImages, toast]);

    return (
        <div className="flex flex-col flex-grow p-4 pt-0 space-y-4 overflow-hidden">

            {/* Upload Section */}
            <div className="p-4 border-b shrink-0 space-y-3 bg-secondary/30 rounded-b-md">
                 <Label htmlFor="quick-capture-upload" className="text-xs font-medium text-muted-foreground">
                    Upload Images/Screenshots
                </Label>
                 {/* Use Label styled as Button */}
                <Label
                    htmlFor="quick-capture-upload-input"
                    className={cn(
                        "flex items-center justify-center w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground",
                        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" // Add focus styles
                    )}
                    tabIndex={0} // Make label focusable
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('quick-capture-upload-input')?.click(); }} // Trigger click on Enter/Space
                 >
                    <Upload className="mr-2 h-4 w-4" /> Upload Files
                    <span className="sr-only">Upload images or screenshots</span>
                 </Label>
                <Input
                    id="quick-capture-upload-input"
                    type="file"
                    accept="image/*" // Accept only image files
                    multiple
                    onChange={handleImageUpload}
                    className="hidden" // Hide the actual input
                />
            </div>

            {/* Image List */}
            <ScrollArea className="flex-grow">
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3"> {/* Grid layout */}
                    {images.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center col-span-full pt-4">No images captured yet.</p>
                    ) : (
                        images.map((image) => (
                            <Card key={image.id} className="overflow-hidden shadow-sm border group relative aspect-square flex flex-col"> {/* Aspect ratio and flex */}
                                <CardContent className="p-1 flex-grow flex items-center justify-center relative">
                                    <Image
                                        src={image.dataUrl}
                                        alt={image.name}
                                        fill // Use fill to cover the container
                                        style={{ objectFit: 'contain' }} // Use 'contain' to show the whole image
                                        className="rounded-sm" // Slight rounding
                                        data-ai-hint="user screenshot uploaded image"
                                     />
                                    {/* Overlay for delete button */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => deleteImage(image.id)}
                                            aria-label={`Delete image ${image.name}`}
                                         >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                                 {/* Optional: Add filename below the image */}
                                 {/* <p className="text-[10px] text-muted-foreground truncate text-center p-1 bg-secondary/50" title={image.name}>
                                     {truncateText(image.name, 15)}
                                 </p> */}
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
