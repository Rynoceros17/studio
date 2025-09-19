
"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-sm text-center shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">
            WeekWise
          </CardTitle>
          <CardDescription>
            Organizing your universe...
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Please wait a moment.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
