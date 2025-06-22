
'use client';

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';

/**
 * A helper function to deeply remove all keys with 'undefined' values from an object.
 * Firestore does not accept 'undefined'.
 * @param data The object or data to clean.
 * @returns A new version of the data without any 'undefined' values.
 */
function sanitizeForFirestore<T>(data: T): T {
  // This is a simple and effective way to strip undefined values.
  // It works for objects, arrays, and primitives that are JSON-serializable.
  if (data === undefined) {
    return null as any; // Or handle as an error, but null is safer for Firestore
  }
  return JSON.parse(JSON.stringify(data));
}


/**
 * A custom hook to synchronize state between React, localStorage, and Firestore.
 * - Uses Firestore as the source of truth when a user is logged in.
 * - Falls back to localStorage if the user is logged out or Firestore is unavailable.
 * - Syncs data in real-time across browser tabs/devices via Firestore listeners.
 */
export default function useSyncedStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    // Stop any existing listener before setting up a new one.
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }

    // Only sync with Firestore if we have a user with a UID and the db is available.
    if (user && user.uid && db) {
      console.log(`useSyncedStorage (${key}): User is logged in. Setting up Firestore sync.`);
      
      const docRef = doc(db, 'user_data', user.uid, 'data', key);

      // Set up a real-time listener on the Firestore document.
      firestoreUnsubscribeRef.current = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const firestoreData = docSnap.data()?.value;
            console.log(`useSyncedStorage (${key}): Snapshot received. Updating state.`);
            // Use the data from Firestore, falling back to the initial value if it's missing/malformed.
            setStoredValue(firestoreData !== undefined ? firestoreData : initialValue);
          } else {
            // Document doesn't exist, so create it.
            // Check localStorage for data to migrate, otherwise use the initial value.
            console.log(`useSyncedStorage (${key}): Document does not exist. Initializing...`);
            let valueToSet = initialValue;
            if (typeof window !== 'undefined') {
                const localItem = window.localStorage.getItem(key);
                if (localItem) {
                    try {
                        valueToSet = JSON.parse(localItem);
                    } catch (e) {
                        console.warn(`useSyncedStorage (${key}): Failed to parse local storage item, using initial value.`)
                    }
                }
            }
            
            // **CRITICAL FIX**: Sanitize the data before writing to Firestore.
            const sanitizedValue = sanitizeForFirestore(valueToSet);
            setDoc(docRef, { value: sanitizedValue, lastUpdated: serverTimestamp() });
            setStoredValue(valueToSet); // Update local state immediately.
          }
        },
        (error) => {
          console.error(`useSyncedStorage (${key}): Firestore listener error:`, error);
        }
      );
    } else {
      // No user, so fall back to using localStorage.
      console.log(`useSyncedStorage (${key}): No user. Using localStorage.`);
      if (typeof window !== 'undefined') {
        try {
          const item = window.localStorage.getItem(key);
          if (item) {
            setStoredValue(JSON.parse(item));
          } else {
            setStoredValue(initialValue);
          }
        } catch (e) {
           console.warn(`useSyncedStorage (${key}): Failed to read from local storage, using initial value.`)
           setStoredValue(initialValue);
        }
      }
    }

    // Cleanup function: runs when component unmounts or dependencies change.
    return () => {
      if (firestoreUnsubscribeRef.current) {
        console.log(`useSyncedStorage (${key}): Unsubscribing from Firestore listener.`);
        firestoreUnsubscribeRef.current();
        firestoreUnsubscribeRef.current = null;
      }
    };
  }, [user, key, initialValue]); // Rerun effect if user or key changes.

  // The setter function returned by the hook.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (valueOrFn) => {
      // Allow value to be a function, just like in useState.
      const newValue = valueOrFn instanceof Function ? valueOrFn(storedValue) : valueOrFn;
      
      // Update React state immediately for a responsive UI.
      setStoredValue(newValue);

      if (user && user.uid && db) {
        // If logged in, save to Firestore.
        const docRef = doc(db, 'user_data', user.uid, 'data', key);
        
        // **CRITICAL FIX**: Sanitize the data before writing to Firestore.
        const sanitizedValue = sanitizeForFirestore(newValue);

        setDoc(docRef, { value: sanitizedValue, lastUpdated: serverTimestamp() })
          .catch(error => console.error(`useSyncedStorage (${key}): Error saving to Firestore:`, error));
      } else {
        // If not logged in, save to localStorage.
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(key, JSON.stringify(newValue));
            } catch (e) {
                console.warn(`useSyncedStorage (${key}): Failed to save to local storage.`)
            }
        }
      }
    },
    [user, key, storedValue]
  );

  return [storedValue, setValue];
}
