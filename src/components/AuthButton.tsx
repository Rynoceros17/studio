
"use client";

import type * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export function AuthButton() {
  const { user, authLoading, signOutUser } = useAuth();

  if (authLoading) {
    return (
      <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="hidden md:inline ml-2">Loading...</span>
      </Button>
    );
  }

  if (!user) {
    return (
      <Link href="/login" passHref legacyBehavior>
        <Button variant="ghost" className="h-9 w-9 md:h-10 md:w-auto md:px-3 text-primary hover:bg-primary/10">
          <LogIn className="h-5 w-5" />
          <span className="hidden md:inline ml-2">Login</span>
        </Button>
      </Link>
    );
  }

  const userInitial = user.email ? user.email[0].toUpperCase() : <UserIcon className="h-5 w-5" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 md:h-10 md:w-auto md:px-3 rounded-full text-primary hover:bg-primary/10">
          <Avatar className="h-7 w-7 md:h-8 md:w-8">
            <AvatarImage src={undefined} alt={user.email || 'User'} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline ml-2">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.email || "Authenticated User"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Add other items like "Profile", "Settings" if needed */}
        {/* <DropdownMenuItem>Profile</DropdownMenuItem> */}
        <DropdownMenuItem onClick={signOutUser} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
