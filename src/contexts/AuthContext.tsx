
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
  GoogleAuthProvider, // Added
  signInWithPopup, // Added
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { app, auth as firebaseAuthFromLib, db } from '@/lib/firebase/firebase'; // Import app, auth, db

interface AuthContextType {
  user: FirebaseUser | null;
  authLoading: boolean;
  firebaseError: AuthError | null;
  signInUser: (email: string, pass: string) => Promise<any>;
  signUpUser: (email: string, pass: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>; // Added
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<AuthError | null>(null);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);

  useEffect(() => {
    // Ensure app is initialized before trying to get auth
    if (app && Object.keys(app).length > 0 && app.name && firebaseAuthFromLib) {
        if (firebaseAuthFromLib && typeof firebaseAuthFromLib.onAuthStateChanged === 'function') {
          setAuthInstance(firebaseAuthFromLib);
        } else {
          console.warn("Firebase Auth instance from firebase.ts is not valid. AuthProvider cannot initialize auth services.");
          setFirebaseError({ code: "auth/internal-error", message: "Firebase Auth not properly initialized from firebase.ts" } as AuthError);
          setAuthLoading(false);
        }
    } else {
      // This case should ideally be caught by firebase.ts checks.
      // console.warn("Firebase app not available in AuthContext. AuthProvider cannot initialize.");
      setFirebaseError({ code: "auth/config-not-found", message: "Firebase app not initialized, check environment variables and firebase.ts." } as AuthError);
      setAuthLoading(false);
    }
  }, []); // Removed dependency on `app` as it's module-level

  useEffect(() => {
    if (!authInstance) {
      // If authInstance is still null after the first effect, and firebaseError isn't already set,
      // it implies an issue with firebase.ts or the initial app load.
      if (!firebaseError) { // Only set error if not already set by previous effect
        // console.warn("Auth instance not set in AuthProvider. onAuthStateChanged listener cannot be set up.");
        setAuthLoading(false); // Ensure loading stops
      }
      return;
    }
    // console.log("AuthProvider: Setting up onAuthStateChanged listener with authInstance:", authInstance);
    setAuthLoading(true);
    const unsubscribe = onAuthStateChanged(
      authInstance,
      async (currentUser) => {
        // console.log("AuthProvider: onAuthStateChanged triggered. Current user:", currentUser?.uid || 'None');
        setUser(currentUser);
        setFirebaseError(null); // Clear previous errors on auth state change
        if (currentUser) {
          if (db && typeof (db as any).collection === 'function') {
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
                // console.log(`AuthProvider: User document for ${currentUser.uid} does not exist. Creating...`);
                await setDoc(userRef, {
                  ...userData,
                  createdAt: serverTimestamp(),
                });
              } else {
                // console.log(`AuthProvider: Updating lastLogin for user ${currentUser.uid}.`);
                await updateDoc(userRef, { lastLogin: serverTimestamp() });
              }
            } catch (error) {
              console.error("AuthProvider: Error creating/updating user document in Firestore:", error);
              setFirebaseError(error as AuthError);
            }
          } else {
            console.warn("AuthProvider: Firestore (db) not available for user document creation.");
            setFirebaseError({ code: "auth/internal-error", message: "Firestore not available for user profile." } as AuthError);
          }
        }
        setAuthLoading(false);
      },
      (error) => {
        console.error("AuthProvider: Auth state change error:", error);
        setFirebaseError(error as AuthError);
        setAuthLoading(false);
      }
    );
    return () => {
      // console.log("AuthProvider: Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    };
  }, [authInstance, firebaseError]); // Added firebaseError to deps, so if it's set early, we don't try to setup listener

  const performAuthOperation = async (operation: () => Promise<any>) => {
    if (!authInstance) {
      const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized." } as AuthError;
      console.error(err.message);
      setFirebaseError(err);
      throw err;
    }
    setFirebaseError(null);
    setAuthLoading(true);
    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error("AuthProvider: Firebase auth operation error:", (error as AuthError).code, (error as AuthError).message);
      setFirebaseError(error as AuthError);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const signInUser = useCallback(
    (email: string, password: string):Promise<any> =>
      performAuthOperation(() => signInWithEmailAndPassword(authInstance!, email, password)),
    [authInstance]
  );

  const signUpUser = useCallback(
    (email: string, password: string):Promise<any> =>
      performAuthOperation(() => createUserWithEmailAndPassword(authInstance!, email, password)),
    [authInstance]
  );

  const signInWithGoogle = useCallback(
    ():Promise<any> => {
        const provider = new GoogleAuthProvider();
        return performAuthOperation(() => signInWithPopup(authInstance!, provider));
    },
    [authInstance]
  );

  const signOutUser = useCallback(async () => {
    if (!authInstance) {
      console.error("AuthProvider: Firebase Auth not initialized for sign-out.");
      return;
    }
    setFirebaseError(null);
    setAuthLoading(true); // Show loading during sign out
    try {
      // console.log("AuthProvider: Signing out user.");
      await signOut(authInstance);
      // setUser(null) is handled by onAuthStateChanged
    } catch (error: any) {
      console.error("AuthProvider: Error during sign-out:", error);
      setFirebaseError(error as AuthError);
    } finally {
        setAuthLoading(false);
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

    