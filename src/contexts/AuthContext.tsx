
"use client";

import type * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/firebase'; // Ensure db is exported from firebase.ts

interface AuthContextType {
  user: FirebaseUser | null;
  authLoading: boolean;
  firebaseError: Error | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<Error | null>(null);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);

  useEffect(() => {
    if (app) { // Ensure Firebase app is initialized
      try {
        const instance = getAuth(app);
        setAuthInstance(instance);
      } catch (error: any) {
        console.error("Error getting Firebase Auth instance:", error);
        setFirebaseError(error);
        setAuthLoading(false);
      }
    } else {
      console.warn("Firebase app not initialized when AuthProvider mounted.");
      setFirebaseError(new Error("Firebase app not initialized."));
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authInstance) {
      if (app) { // Only set loading to false if app was present but authInstance failed
        setAuthLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(
      authInstance,
      async (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser) {
          // Create or update user document in Firestore
          if (db) { // Check if db is initialized
            const userRef = doc(db, "users", currentUser.uid);
            try {
              const userDoc = await getDoc(userRef);
              if (!userDoc.exists()) {
                await setDoc(userRef, {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                  createdAt: serverTimestamp(),
                  lastLogin: serverTimestamp(),
                });
              } else {
                await updateDoc(userRef, {
                  lastLogin: serverTimestamp(),
                  // Optionally update displayName and photoURL if they can change
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                });
              }
            } catch (error) {
              console.error("Error creating/updating user document in Firestore:", error);
              // setFirebaseError(error as Error); // Optionally set a specific Firestore error
            }
          } else {
             console.warn("Firestore (db) not available for user document creation.");
          }
        }
      },
      (error) => {
        console.error("Auth state change error:", error);
        setFirebaseError(error);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authInstance]);

  const signInWithGoogle = useCallback(async () => {
    if (!authInstance) {
      console.error("Firebase Auth not initialized for sign-in.");
      setFirebaseError(new Error("Authentication service not ready."));
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      setAuthLoading(true);
      await signInWithPopup(authInstance, provider);
      // onAuthStateChanged will handle setting the user and further actions
    } catch (error: any) {
      console.error("Error during Google sign-in:", error);
      setFirebaseError(error);
      // authLoading will be set to false by onAuthStateChanged's error handler or success
    }
  }, [authInstance]);

  const signOutUser = useCallback(async () => {
    if (!authInstance) {
      console.error("Firebase Auth not initialized for sign-out.");
      return;
    }
    try {
      await signOut(authInstance);
      // onAuthStateChanged will handle setting user to null
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      setFirebaseError(error);
    }
  }, [authInstance]);

  const value = useMemo(() => ({
    user,
    authLoading,
    firebaseError,
    signInWithGoogle,
    signOutUser,
  }), [user, authLoading, firebaseError, signInWithGoogle, signOutUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider. Ensure AuthProvider is correctly placed in your component tree (e.g., in layout.tsx) and that Firebase is initializing correctly.');
  }
  return context;
};
