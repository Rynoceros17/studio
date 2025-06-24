
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
import { useAuth } from '@/contexts/AuthContext';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" {...props}>
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8C0 120.3 106.5 8 244 8s244 112.3 244 253.8zM134.4 330.7c-32.9-20-54.8-54.1-54.8-94.4 0-61.9 50.5-112.3 112.3-112.3 35.2 0 66.2 16.5 86.8 42.1l-43.6 37.3c-11.4-14.9-29.3-24.6-43.2-24.6-34.9 0-63.3 28.5-63.3 63.3 0 23.3 12.5 43.4 30.8 54.3l-48.8 36.3z"
      />
    </svg>
);


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInUser, signInWithGoogle, firebaseError, authLoading } = useAuth();
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
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setLocalError("Invalid email or password. Please try again. If you don't have an account, you may need to sign up.");
      } else {
        // Use the generic error message from firebaseError if it's not a specific credential issue
        setLocalError(firebaseError?.message || "An unknown error occurred during login.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    try {
      await signInWithGoogle();
      router.push('/'); // Redirect to homepage on successful login
    } catch (error: any) {
      console.error("Google sign-in failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLocalError("Google Sign-In was cancelled.");
      } else {
        setLocalError(firebaseError?.message || "An unknown error occurred during Google sign-in.");
      }
    }
  };

  const displayError = localError || (firebaseError && firebaseError.code !== 'auth/invalid-credential' ? firebaseError.message : null);


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Login to WeekWise</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {displayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                {displayError}
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
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
          
          <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                  </span>
              </div>
          </div>

          <Button variant="outline" className="w-full h-10" onClick={handleGoogleSignIn} disabled={authLoading}>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continue with Google
          </Button>

        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6">
          <p className="text-xs text-muted-foreground">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
          </p>
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
