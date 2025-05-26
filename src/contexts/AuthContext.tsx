
"use client";

import type * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User as FirebaseUser, AuthError } from 'firebase/auth';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { app, auth as firebaseAuth, db } from '@/lib/firebase/firebase'; // Use initialized auth and db

interface AuthContextType {
  user: FirebaseUser | null;
  authLoading: boolean;
  firebaseError: AuthError | null;
  signInUser: typeof signInWithEmailAndPassword;
  signUpUser: typeof createUserWithEmailAndPassword;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<AuthError | null>(null);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);

  useEffect(() => {
    // Ensure firebaseAuth (from firebase.ts) is a valid Auth instance
    if (firebaseAuth && typeof firebaseAuth.onAuthStateChanged === 'function') {
      setAuthInstance(firebaseAuth);
    } else {
      console.warn("Firebase Auth instance from firebase.ts is not valid. AuthProvider cannot initialize.");
      setAuthLoading(false);
      setFirebaseError({ code: "auth/internal-error", message: "Firebase Auth not properly initialized from firebase.ts" } as AuthError);
    }
  }, []);

  useEffect(() => {
    if (!authInstance) {
      if (app && Object.keys(app).length > 0 && app.name) { // Only if app was potentially valid
         // Error already set by previous effect if authInstance is still null
      } else {
        // If app itself wasn't valid, this is likely due to missing env vars
        setFirebaseError({ code: "auth/config-not-found", message: "Firebase app not initialized, check environment variables." } as AuthError);
        setAuthLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(
      authInstance,
      async (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        setFirebaseError(null); // Clear previous errors on auth state change
        if (currentUser) {
          if (db && typeof db.collection === 'function') { // Check if db is valid
            const userRef = doc(db, "users", currentUser.uid);
            try {
              const userDoc = await getDoc(userRef);
              const userData = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                lastLogin: serverTimestamp(),
              };
              if (!userDoc.exists()) {
                await setDoc(userRef, {
                  ...userData,
                  createdAt: serverTimestamp(),
                });
              } else {
                await updateDoc(userRef, userData);
              }
            } catch (error) {
              console.error("Error creating/updating user document in Firestore:", error);
              setFirebaseError(error as AuthError);
            }
          } else {
            console.warn("Firestore (db) not available for user document creation.");
          }
        }
      },
      (error) => {
        console.error("Auth state change error:", error);
        setFirebaseError(error as AuthError);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authInstance]);

  const signInUser: typeof signInWithEmailAndPassword = useCallback(
    async (email, password) => {
      if (!authInstance) {
        const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized for sign-in." } as AuthError;
        console.error(err.message);
        setFirebaseError(err);
        throw err;
      }
      setFirebaseError(null);
      try {
        return await signInWithEmailAndPassword(authInstance, email, password);
      } catch (error) {
        setFirebaseError(error as AuthError);
        throw error;
      }
    },
    [authInstance]
  );

  const signUpUser: typeof createUserWithEmailAndPassword = useCallback(
    async (email, password) => {
      if (!authInstance) {
        const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized for sign-up." } as AuthError;
        console.error(err.message);
        setFirebaseError(err);
        throw err;
      }
      setFirebaseError(null);
      try {
        return await createUserWithEmailAndPassword(authInstance, email, password);
      } catch (error) {
        setFirebaseError(error as AuthError);
        throw error;
      }
    },
    [authInstance]
  );

  const SsignOutUser = useCallback(async () => {
    if (!authInstance) {
      console.error("Firebase Auth not initialized for sign-out.");
      return;
    }
    setFirebaseError(null);
    try {
      await signOut(authInstance);
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      setFirebaseError(error as AuthError);
    }
  }, [authInstance]);

  const value = useMemo(() => ({
    user,
    authLoading,
    firebaseError,
    signInUser,
    signUpUser,
    signOutUser: SsignOutUser,
  }), [user, authLoading, firebaseError, signInUser, signUpUser, SsignOutUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider. Ensure AuthProvider is correctly placed in your component tree (e.g., in layout.tsx) and that Firebase is initializing correctly.');
  }
  return context;
};
