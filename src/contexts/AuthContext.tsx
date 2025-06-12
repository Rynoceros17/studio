
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
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { app, auth as firebaseAuthFromLib, db } from '@/lib/firebase/firebase'; // Import app, auth, db

interface AuthContextType {
  user: FirebaseUser | null;
  authLoading: boolean;
  firebaseError: AuthError | null;
  signInUser: (email: string, pass: string) => Promise<any>;
  signUpUser: (email: string, pass: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<AuthError | null>(null);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);

  useEffect(() => {
    if (firebaseAuthFromLib && typeof firebaseAuthFromLib.onAuthStateChanged === 'function') {
      // console.log("AuthProvider: Firebase Auth instance from firebase.ts is valid. Setting authInstance.");
      setAuthInstance(firebaseAuthFromLib);
    } else {
      console.warn("AuthProvider: Firebase Auth instance from firebase.ts is not valid. AuthProvider cannot initialize auth services. This might be due to missing Firebase config environment variables or an issue in firebase.ts.");
      setFirebaseError({ code: "auth/internal-error", message: "Firebase Auth not properly initialized from firebase.ts" } as AuthError);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authInstance) {
      // console.log("AuthProvider: authInstance is null, onAuthStateChanged listener not set up.");
      if (authLoading && !firebaseError) { // Only if still loading and no explicit error from previous effect
        // console.log("AuthProvider: authInstance is null and no firebaseError, setting authLoading to false.");
        setAuthLoading(false);
      }
      return;
    }

    // console.log("AuthProvider: Setting up onAuthStateChanged listener with authInstance:", authInstance);
    if (!authLoading) setAuthLoading(true);

    const unsubscribe = onAuthStateChanged(
      authInstance,
      async (currentUser) => {
        // console.log("AuthProvider: onAuthStateChanged triggered. Current user:", currentUser?.uid || 'None');
        setUser(currentUser);
        setFirebaseError(null); // Clear previous auth errors on successful state change
        if (currentUser) {
          if (db && typeof (db as any).collection === 'function') {
            const userRef = doc(db, "users", currentUser.uid);
            console.log(`AuthProvider: Checking/creating Firestore document for user ${currentUser.uid}`);
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
                console.log(`AuthProvider: User document for ${currentUser.uid} does not exist. Creating...`);
                await setDoc(userRef, {
                  ...userData,
                  createdAt: serverTimestamp(),
                });
                console.log(`AuthProvider: User document for ${currentUser.uid} created successfully.`);
              } else {
                console.log(`AuthProvider: User document for ${currentUser.uid} exists. Updating lastLogin.`);
                await updateDoc(userRef, { lastLogin: serverTimestamp() });
                console.log(`AuthProvider: User document for ${currentUser.uid} updated successfully.`);
              }
            } catch (error) {
              console.error(`AuthProvider: Error creating/updating user document for ${currentUser.uid} in Firestore:`, error);
              setFirebaseError(error as AuthError); // This could be a Firestore error, not strictly AuthError
            }
          } else {
            console.warn("AuthProvider: Firestore (db) not available. Cannot create/update user document.");
            // setFirebaseError({ code: "auth/internal-error", message: "Firestore not available for user profile." } as AuthError);
          }
        }
        // console.log("AuthProvider: onAuthStateChanged finished, setting authLoading to false.");
        setAuthLoading(false);
      },
      (error) => {
        console.error("AuthProvider: Auth state change error:", error);
        setFirebaseError(error as AuthError);
        // console.log("AuthProvider: Auth state change error, setting authLoading to false.");
        setAuthLoading(false);
      }
    );

    return () => {
      // console.log("AuthProvider: Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    };
  }, [authInstance]); // Removed authLoading and firebaseError from deps to avoid loops based on their changes

  const performAuthOperation = async (operation: () => Promise<any>) => {
    if (!authInstance) {
      const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized." } as AuthError;
      console.error("performAuthOperation: " + err.message);
      setFirebaseError(err);
      setAuthLoading(false);
      throw err;
    }
    setFirebaseError(null);
    setAuthLoading(true);
    try {
      const result = await operation();
      // On success, onAuthStateChanged will typically handle setting authLoading to false.
      return result;
    } catch (error) {
      console.error("AuthProvider: Firebase auth operation error:", (error as AuthError).code, (error as AuthError).message);
      setFirebaseError(error as AuthError);
      setAuthLoading(false); // Crucial: ensure loading is stopped on error
      throw error;
    }
  };

  const signInUser = useCallback(
    (email: string, password: string): Promise<any> =>
      performAuthOperation(() => signInWithEmailAndPassword(authInstance!, email, password)),
    [authInstance] // performAuthOperation will be recreated if authInstance changes.
  );

  const signUpUser = useCallback(
    (email: string, password: string): Promise<any> =>
      performAuthOperation(() => createUserWithEmailAndPassword(authInstance!, email, password)),
    [authInstance]
  );

  const signInWithGoogle = useCallback((): Promise<any> => {
    if (!authInstance) {
      const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized." } as AuthError;
      setFirebaseError(err);
      setAuthLoading(false);
      return Promise.reject(err);
    }
    const provider = new GoogleAuthProvider();
    return performAuthOperation(() => signInWithPopup(authInstance!, provider));
  }, [authInstance]);

  const signOutUser = useCallback(async () => {
    if (!authInstance) {
      console.error("AuthProvider: Firebase Auth not initialized for sign-out.");
      setAuthLoading(false); // Ensure loading stops if somehow called without authInstance
      return;
    }
    setFirebaseError(null);
    setAuthLoading(true); // Set loading before sign out
    try {
      // console.log("AuthProvider: Signing out user.");
      await signOut(authInstance);
      // setUser(null) and setAuthLoading(false) will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("AuthProvider: Error during sign-out:", error);
      setFirebaseError(error as AuthError);
      setAuthLoading(false); // Ensure loading stops on direct error if onAuthStateChanged doesn't cover it quickly
    }
  }, [authInstance]);

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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider. Ensure AuthProvider is correctly placed in your component tree (e.g., in layout.tsx) and that Firebase is initializing correctly.');
  }
  return context;
};
