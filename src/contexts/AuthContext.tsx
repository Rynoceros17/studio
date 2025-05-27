
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
    // This effect attempts to set the authInstance from the imported firebaseAuthFromLib
    // This depends on src/lib/firebase/firebase.ts successfully initializing Firebase
    if (firebaseAuthFromLib && typeof firebaseAuthFromLib.onAuthStateChanged === 'function') {
      setAuthInstance(firebaseAuthFromLib);
    } else {
      console.warn("AuthProvider: Firebase Auth instance from firebase.ts is not valid. AuthProvider cannot initialize auth services.");
      setFirebaseError({ code: "auth/internal-error", message: "Firebase Auth not properly initialized from firebase.ts" } as AuthError);
      setAuthLoading(false); // Stop loading if Firebase itself isn't set up
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (!authInstance) {
      // If authInstance is still null after the first effect (and not because it's still loading),
      // it implies a fundamental issue with Firebase setup (e.g., missing env vars).
      // The first useEffect should have set firebaseError and setAuthLoading to false in this case.
      // We ensure authLoading is false if there's no authInstance to listen to.
      if (authLoading && !firebaseError) { // Only if authLoading is true and no explicit error set by previous effect
         // This state indicates Firebase itself might not have initialized.
         // Let previous effect handle setting firebaseError if firebaseAuthFromLib was bad.
         // If firebaseAuthFromLib was good but authInstance didn't set for some other reason,
         // we ensure loading stops.
        setAuthLoading(false);
      }
      return;
    }

    // console.log("AuthProvider: Setting up onAuthStateChanged listener with authInstance:", authInstance);
    // Ensure authLoading is true before starting listener, if not already set by previous effect.
    if (!authLoading) setAuthLoading(true);

    const unsubscribe = onAuthStateChanged(
      authInstance,
      async (currentUser) => {
        // console.log("AuthProvider: onAuthStateChanged triggered. Current user:", currentUser?.uid || 'None');
        setUser(currentUser);
        setFirebaseError(null);
        if (currentUser) {
          if (db && typeof (db as any).collection === 'function') { // Check if db is a valid Firestore instance
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
            console.warn("AuthProvider: Firestore (db) not available or not a valid Firestore instance for user document creation.");
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
  }, [authInstance, authLoading, firebaseError]); // Added authLoading and firebaseError

  const performAuthOperation = async (operation: () => Promise<any>) => {
    if (!authInstance) {
      const err = { code: "auth/no-auth-instance", message: "Firebase Auth not initialized." } as AuthError;
      console.error(err.message);
      setFirebaseError(err);
      setAuthLoading(false); // Ensure loading stops
      throw err;
    }
    setFirebaseError(null);
    setAuthLoading(true);
    try {
      const result = await operation();
      // setAuthLoading(false); // Handled by onAuthStateChanged or finally block
      return result;
    } catch (error) {
      console.error("AuthProvider: Firebase auth operation error:", (error as AuthError).code, (error as AuthError).message);
      setFirebaseError(error as AuthError);
      // setAuthLoading(false); // Handled by onAuthStateChanged or finally block
      throw error;
    } finally {
      // onAuthStateChanged will set authLoading to false after operations like signIn/signUp
      // For signOut, we set it manually.
      // If the operation doesn't trigger onAuthStateChanged (e.g. some profile updates),
      // ensure loading stops. For signIn/signUp/signOut, onAuthStateChanged is the primary mechanism.
    }
  };

  const signInUser = useCallback(
    (email: string, password: string): Promise<any> =>
      performAuthOperation(() => signInWithEmailAndPassword(authInstance!, email, password)),
    [authInstance]
  );

  const signUpUser = useCallback(
    (email: string, password: string): Promise<any> =>
      performAuthOperation(() => createUserWithEmailAndPassword(authInstance!, email, password)),
    [authInstance]
  );

  const signInWithGoogle = useCallback((): Promise<any> => {
    if (!authInstance) {
      return Promise.reject({ code: "auth/no-auth-instance", message: "Firebase Auth not initialized." });
    }
    const provider = new GoogleAuthProvider();
    return performAuthOperation(() => signInWithPopup(authInstance!, provider));
  }, [authInstance]);

  const signOutUser = useCallback(async () => {
    if (!authInstance) {
      console.error("AuthProvider: Firebase Auth not initialized for sign-out.");
      setAuthLoading(false);
      return;
    }
    setFirebaseError(null);
    setAuthLoading(true);
    try {
      // console.log("AuthProvider: Signing out user.");
      await signOut(authInstance);
      // setUser(null) and setAuthLoading(false) will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("AuthProvider: Error during sign-out:", error);
      setFirebaseError(error as AuthError);
      setAuthLoading(false); // Ensure loading stops on direct error
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
