
'use client';

import type * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For redirection
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, LogIn as LogInIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInUser, firebaseError, authLoading } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }
    try {
      await signInUser(email, password);
      router.push('/'); // Redirect to homepage on successful login
    } catch (error: any) {
      // error is already set in firebaseError by AuthContext
      console.error("Login failed:", error);
      // No need to setLocalError here if firebaseError is used for display
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Login to WeekWise</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {(localError || firebaseError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                {localError || firebaseError?.message || "An unknown error occurred."}
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
                disabled={authLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
                disabled={authLoading}
              />
            </div>
            <Button type="submit" className="w-full h-10" disabled={authLoading}>
              {authLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogInIcon className="mr-2 h-4 w-4" />
              )}
              Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6">
           {/* Optionally add a link to a sign-up page here if you implement it */}
           {/* <p className="text-xs text-muted-foreground">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
          </p> */}
          <Link href="/" passHref legacyBehavior>
            <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
