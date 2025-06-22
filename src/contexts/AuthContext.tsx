
'use client';

import type * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User as FirebaseUser, AuthError } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/firebase'; // Import the initialized services

// --- Define the shape of our context ---
interface AuthContextType {
  user: FirebaseUser | null;
  authLoading: boolean;
  firebaseError: AuthError | null;
  signInUser: (email: string, pass:string) => Promise<any>;
  signUpUser: (email: string, pass: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
  signOutUser: () => Promise<void>;
}

// --- Create the context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Create the AuthProvider component ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<AuthError | null>(null);

  // Effect to listen for changes in the user's authentication state.
  useEffect(() => {
    // Ensure the auth service was initialized correctly before setting up the listener.
    if (!auth) {
      console.warn("AuthProvider: Firebase Auth service is not available. Cannot set up auth listener.");
      setAuthLoading(false);
      return;
    }

    // onAuthStateChanged returns an 'unsubscribe' function.
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        console.log("Auth state changed. Current user:", currentUser?.uid || "None");
        setUser(currentUser);
        setFirebaseError(null);

        // If a user is logged in and the database is available, save/update their info.
        if (currentUser && currentUser.uid && db) { // Check for UID and db
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);

            // Ensure no undefined values are sent to Firestore. Use null as a fallback.
            const userData = {
              uid: currentUser.uid,
              email: currentUser.email || null,
              displayName: currentUser.displayName || null,
              photoURL: currentUser.photoURL || null,
              lastLogin: serverTimestamp(),
            };
            
            // Use setDoc with { merge: true } to create the document if it doesn't exist,
            // or update it if it does, without overwriting existing fields.
            await setDoc(userDocRef, userData, { merge: true });
            console.log(`User document for ${currentUser.uid} created/updated.`);
          } catch (error) {
            console.error("Error saving user data to Firestore:", error);
          }
        }
        
        // Auth state has been determined, so we can stop showing a loading state.
        setAuthLoading(false);
      },
      (error) => {
        console.error("Auth state listener error:", error);
        setFirebaseError(error as AuthError);
        setAuthLoading(false);
      }
    );

    // Clean up the listener when the component unmounts.
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this effect runs only once.

  // --- Auth action functions ---

  // A wrapper to handle loading and error states for all auth operations.
  const performAuthOperation = async (operation: () => Promise<any>) => {
    if (!auth) {
      const err = { code: "auth/not-initialized", message: "Firebase Auth is not available." } as AuthError;
      setFirebaseError(err);
      throw err;
    }
    setFirebaseError(null);
    setAuthLoading(true);
    try {
      const result = await operation();
      return result;
    } catch (error) {
      setFirebaseError(error as AuthError);
      throw error;
    } finally {
      // Let the onAuthStateChanged listener handle setting authLoading to false on success.
      // If there's an error, we set it to false here.
      if (firebaseError) {
          setAuthLoading(false);
      }
    }
  };

  const signInUser = useCallback((email: string, password: string) => 
    performAuthOperation(() => signInWithEmailAndPassword(auth!, email, password)),
  []);

  const signUpUser = useCallback((email: string, password: string) => 
    performAuthOperation(() => createUserWithEmailAndPassword(auth!, email, password)),
  []);

  const signInWithGoogle = useCallback(() => {
    const provider = new GoogleAuthProvider();
    return performAuthOperation(() => signInWithPopup(auth!, provider));
  }, []);

  const signOutUser = useCallback(async () => {
    if (auth) {
      try {
        await signOut(auth);
        // onAuthStateChanged will handle setting the user to null.
      } catch(error) {
        setFirebaseError(error as AuthError);
      }
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders.
  const value = useMemo(() => ({
    user,
    authLoading,
    firebaseError,
    signInUser,
    signUpUser,
    signInWithGoogle,
    signOutUser,
  }), [user, authLoading, firebaseError, signInUser, signUpUser, signInWithGoogle, signOutUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Custom hook to easily access the context ---
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
