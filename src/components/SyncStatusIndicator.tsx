
"use client";

import type * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SyncStatusIndicator() {
  const { user, authLoading, firebaseError: authFirebaseError } = useAuth();

  // Check if db object exists and seems functional (not just an empty object due to init error)
  const isFirestoreProperlyConfigured = db && typeof (db as any).collection === 'function';

  let statusText: string;
  let statusIcon: React.ReactNode;
  let customBgColor = "";

  if (authLoading) {
    statusText = "Checking...";
    statusIcon = <Loader2 className="h-3 w-3 animate-spin" />;
    customBgColor = "bg-blue-500 hover:bg-blue-600";
  } else if (authFirebaseError || !isFirestoreProperlyConfigured) {
    statusText = "Sync Offline"; // Indicates Firebase/DB issue
    statusIcon = <WifiOff className="h-3 w-3" />;
    customBgColor = "bg-red-600 hover:bg-red-700";
  } else if (user) {
    statusText = "Cloud Active";
    statusIcon = <Cloud className="h-3 w-3" />;
    customBgColor = "bg-green-600 hover:bg-green-700";
  } else {
    statusText = "Local Only";
    statusIcon = <CloudOff className="h-3 w-3" />;
    customBgColor = "bg-slate-500 hover:bg-slate-600";
  }

  return (
    <div className="fixed top-3 left-3 z-[101]"> {/* Increased z-index slightly */}
      <Badge
        variant="outline" // Base variant for border styling, overridden by customBgColor
        className={cn(
          "px-2.5 py-1.5 text-xs flex items-center gap-1.5 shadow-md border-transparent text-white", // Ensure text is white, border transparent by default
          customBgColor
        )}
      >
        {statusIcon}
        {statusText}
      </Badge>
    </div>
  );
}
