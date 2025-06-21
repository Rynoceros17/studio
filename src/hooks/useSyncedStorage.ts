
"use client";

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firebase';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';

/**
 * A custom hook to synchronize state between React, localStorage, and Firestore.
 * - It uses Firestore as the source of truth when a user is logged in.
 * - It falls back to localStorage if the user is logged out or Firestore is unavailable.
 * - It syncs data in real-time across browser tabs/devices via Firestore listeners.
 */
export default function useSyncedStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // A ref to track if a Firestore listener is active to avoid race conditions.
  const firestoreUnsubscribeRef = useRef<Unsubscribe | null>(null);

  // This effect handles the initial data load and sets up Firestore listeners.
  useEffect(() => {
    // If a user is logged in and the database is available...
    if (user && user.uid && db) {
      console.log(`useSyncedStorage (${key}): User is logged in. Setting up Firestore sync.`);
      
      const docRef = doc(db, 'user_data', user.uid, 'data', key);

      // Set up a real-time listener on the Firestore document.
      firestoreUnsubscribeRef.current = onSnapshot(
        docRef,
        (docSnap) => {
          // When data arrives from Firestore...
          if (docSnap.exists()) {
            // ...update the local state with the Firestore data.
            const firestoreData = docSnap.data()?.value;
            console.log(`useSyncedStorage (${key}): Snapshot received. Updating state.`);
            setStoredValue(firestoreData !== undefined ? firestoreData : initialValue);
          } else {
            // If the document doesn't exist, create it.
            // First, check if there's any data in localStorage to migrate.
            console.log(`useSyncedStorage (${key}): Document does not exist. Initializing from localStorage or initialValue.`);
            const localItem = window.localStorage.getItem(key);
            const valueToSet = localItem ? JSON.parse(localItem) : initialValue;
            setDoc(docRef, { value: valueToSet, lastUpdated: serverTimestamp() });
            setStoredValue(valueToSet); // Set local state immediately.
          }
        },
        (error) => {
          console.error(`useSyncedStorage (${key}): Firestore listener error:`, error);
        }
      );
    } else {
      // If there is no user, use localStorage as the source of truth.
      console.log(`useSyncedStorage (${key}): No user. Using localStorage.`);
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      } else {
        setStoredValue(initialValue);
      }
    }

    // Cleanup function: This runs when the component unmounts or dependencies change.
    return () => {
      if (firestoreUnsubscribeRef.current) {
        console.log(`useSyncedStorage (${key}): Unsubscribing from Firestore listener.`);
        firestoreUnsubscribeRef.current(); // Detach the listener.
        firestoreUnsubscribeRef.current = null;
      }
    };
  }, [user, key, initialValue]); // Rerun this effect if the user, key, or initialValue changes.

  // This is the setter function that will be returned by the hook.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (valueOrFn) => {
      // Allow the value to be a function, just like in useState.
      const newValue = valueOrFn instanceof Function ? valueOrFn(storedValue) : valueOrFn;
      
      // Update the React state immediately for a responsive UI.
      setStoredValue(newValue);

      // If a user is logged in, save the new value to their Firestore document.
      if (user && user.uid && db) {
        const docRef = doc(db, 'user_data', user.uid, 'data', key);
        setDoc(docRef, { value: newValue, lastUpdated: serverTimestamp() })
          .catch(error => console.error(`useSyncedStorage (${key}): Error saving to Firestore:`, error));
      } else {
        // If not logged in, save the value to localStorage.
        window.localStorage.setItem(key, JSON.stringify(newValue));
      }
    },
    [user, key, storedValue] // storedValue is a dependency for the functional update `valueOrFn(storedValue)`.
  );

  return [storedValue, setValue];
}
