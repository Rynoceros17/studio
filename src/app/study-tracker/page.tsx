
// src/app/study-tracker/page.tsx
import type * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function StudyTrackerPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg overflow-hidden mb-8 bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" passHref legacyBehavior>
              <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Calendar</span>
              </Button>
            </Link>
            <div className="flex-grow">
              <CardTitle className="text-2xl text-primary">Study Tracker</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Track your study sessions. (Page under construction)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Study Tracker functionality will be implemented here.</p>
          {/* Placeholder for future Study Tracker component */}
        </CardContent>
      </Card>
    </div>
  );
}
