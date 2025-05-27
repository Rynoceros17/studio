
"use client";

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, onSnapshot, setDoc, getDoc, type Unsubscribe, serverTimestamp } from 'firebase/firestore';

// Helper function to safely parse JSON
function safeJsonParse<T>(jsonString: string | null, fallback: T): T {
  if (jsonString === null) {
    return fallback;
  }
  try {
    if (jsonString === "undefined") {
        return fallback;
    }
    return JSON.parse(jsonString) as T;
  } catch (e) {
    // console.warn(`Failed to parse JSON ("${jsonString}"), using fallback.`, e);
    return fallback;
  }
}

function useSyncedStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const { user, authLoading, firebaseError: authFirebaseError } = useAuth();
  const [storedValue, setStoredValueState] = useState<T>(initialValue);
  const [isFirestoreInitialized, setIsFirestoreInitialized] = useState(false);
  const isSavingRef = useRef(false); // To prevent concurrent saves for the same key

  // Ref to hold the latest storedValue to avoid stale closures in onSnapshot
  const storedValueRef = useRef(storedValue);
  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  // Effect for initializing from localStorage if no user or Firestore fails
  useEffect(() => {
    if (authLoading) return; // Wait for auth state to be resolved

    if (!user || authFirebaseError || !db) {
      // console.log(`useSyncedStorage (${key}): No user or Firebase error. Using localStorage.`);
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setStoredValueState(safeJsonParse(item, initialValue));
        } else {
          setStoredValueState(initialValue);
        }
      } catch (error) {
        console.warn(`Error reading localStorage key “${key}”:`, error);
        setStoredValueState(initialValue);
      }
      setIsFirestoreInitialized(false); // Mark Firestore as not used
      return; // Skip Firestore logic
    }
    // Firestore logic will be handled in the next effect
  }, [key, initialValue, user, authLoading, authFirebaseError]);


  // Effect for Firestore (runs when user exists and db is available)
  useEffect(() => {
    if (!user || !db || authFirebaseError) {
      // If user logs out or Firebase has issues, ensure we're not using Firestore state.
      // The localStorage effect above should handle reverting.
      setIsFirestoreInitialized(false);
      return;
    }

    // console.log(`useSyncedStorage (${key}): User ${user.uid} found. Setting up Firestore listener.`);
    const docRef = doc(db, "users", user.uid, "appData", key);
    let unsubscribe: Unsubscribe | null = null;

    const setupListener = async () => {
      try {
        // Initial fetch to see if data exists or to get the latest before setting listener
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreData = docSnap.data()?.value;
          // console.log(`useSyncedStorage (${key}): Initial fetch from Firestore. Data:`, firestoreData);
          if (JSON.stringify(firestoreData) !== JSON.stringify(storedValueRef.current)) {
            setStoredValueState(firestoreData !== undefined ? firestoreData : initialValue);
          }
        } else {
          // Document doesn't exist, create it with initialValue from props or localStorage
          // console.log(`useSyncedStorage (${key}): Document not found in Firestore. Checking localStorage.`);
          let valueToInitialize = initialValue;
          try {
            const localItem = window.localStorage.getItem(key);
            if (localItem !== null) {
              valueToInitialize = safeJsonParse(localItem, initialValue);
              // console.log(`useSyncedStorage (${key}): Found data in localStorage to initialize Firestore:`, valueToInitialize);
            }
          } catch (e) { /* ignore localStorage read error here */ }
          
          // console.log(`useSyncedStorage (${key}): Creating document in Firestore with:`, valueToInitialize);
          await setDoc(docRef, { value: valueToInitialize, lastUpdated: serverTimestamp() });
          setStoredValueState(valueToInitialize);
        }

        // Then, set up the real-time listener
        unsubscribe = onSnapshot(docRef, (docSnapRealTime) => {
          if (docSnapRealTime.exists()) {
            const firestoreDataRealTime = docSnapRealTime.data()?.value;
            // console.log(`useSyncedStorage (${key}): Firestore snapshot received. Data:`, firestoreDataRealTime);
            // Compare with ref to avoid stale closure issues and unnecessary updates
            if (JSON.stringify(firestoreDataRealTime) !== JSON.stringify(storedValueRef.current)) {
              // console.log(`useSyncedStorage (${key}): Updating local state from Firestore snapshot.`);
              setStoredValueState(firestoreDataRealTime !== undefined ? firestoreDataRealTime : initialValue);
            }
          } else {
            // console.log(`useSyncedStorage (${key}): Firestore document deleted, reverting to initialValue.`);
            // This case should be rare if we create the doc initially.
            // If it happens, we might re-create it or use initialValue.
             setStoredValueState(initialValue);
          }
        }, (error) => {
          console.error(`useSyncedStorage (${key}): Error in onSnapshot listener:`, error);
          // Potentially fall back to localStorage or show an error
        });
        setIsFirestoreInitialized(true);

      } catch (error) {
        console.error(`useSyncedStorage (${key}): Error setting up Firestore listener or initial fetch:`, error);
        setIsFirestoreInitialized(false);
        // Fallback to localStorage if Firestore setup fails
         try {
            const item = window.localStorage.getItem(key);
            if (item !== null) {
              setStoredValueState(safeJsonParse(item, initialValue));
            }
          } catch (e) { /* ignore */ }
      }
    };
    
    setupListener();

    return () => {
      if (unsubscribe) {
        // console.log(`useSyncedStorage (${key}): Unsubscribing from Firestore listener.`);
        unsubscribe();
      }
      setIsFirestoreInitialized(false);
    };
  }, [user, key, db, initialValue, authFirebaseError]); // Added authFirebaseError

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (valueOrFn) => {
      const newValue = valueOrFn instanceof Function ? valueOrFn(storedValueRef.current) : valueOrFn;
      setStoredValueState(newValue); // Update local React state immediately

      if (user && db && isFirestoreInitialized && !authFirebaseError) {
        if (isSavingRef.current) {
            // console.log(`useSyncedStorage (${key}): Save already in progress, skipping.`);
            return;
        }
        isSavingRef.current = true;
        // console.log(`useSyncedStorage (${key}): User is logged in. Saving to Firestore:`, newValue);
        const docRef = doc(db, "users", user.uid, "appData", key);
        setDoc(docRef, { value: newValue, lastUpdated: serverTimestamp() }, { merge: true })
          .then(() => {
            // console.log(`useSyncedStorage (${key}): Successfully saved to Firestore.`);
          })
          .catch((error) => {
            console.error(`useSyncedStorage (${key}): Error saving to Firestore:`, error);
          })
          .finally(() => {
            isSavingRef.current = false;
          });
      } else if (!authFirebaseError) { // Only save to localStorage if no Firebase auth error prevented user check
        // console.log(`useSyncedStorage (${key}): No user / Firebase not initialized. Saving to localStorage.`);
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          }
        } catch (error) {
          console.warn(`Error setting localStorage key “${key}”:`, error);
        }
      }
    },
    [user, key, db, isFirestoreInitialized, authFirebaseError] // Removed storedValue to make setValue stable
  );

  // Effect for cross-tab synchronization (only for localStorage)
  useEffect(() => {
    if (typeof window === 'undefined' || (user && db && isFirestoreInitialized && !authFirebaseError)) {
      // If using Firestore, it handles its own cross-tab sync.
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        if (event.newValue !== null) {
          setStoredValueState(safeJsonParse(event.newValue, initialValue));
        } else {
          setStoredValueState(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue, user, db, isFirestoreInitialized, authFirebaseError]);

  return [storedValue, setValue];
}

export default useSyncedStorage;

    