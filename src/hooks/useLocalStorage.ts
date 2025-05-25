
"use client";

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';

// Helper function to safely parse JSON
function safeJsonParse<T>(jsonString: string | null, fallback: T): T {
  if (jsonString === null) {
    return fallback;
  }
  try {
    // Handle the case where "undefined" string might have been stored.
    if (jsonString === "undefined") {
        return fallback;
    }
    return JSON.parse(jsonString) as T;
  } catch (e) {
    // console.warn(`Failed to parse JSON ("${jsonString}"), using fallback.`, e);
    return fallback;
  }
}

function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once on client.
  const [storedValue, setStoredValueState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? safeJsonParse(item, initialValue) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.warn(`Error reading localStorage key “${key}” on init:`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        // Save state
        setStoredValueState(valueToStore);
        // Save to local storage
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        // A more advanced implementation would handle the error case
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, storedValue] // Add storedValue to ensure the functional update form `value(storedValue)` uses the latest state.
  );


  // useEffect for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        if (event.newValue !== null) { // Check for null explicitly, as empty string is valid JSON ("")
            setStoredValueState(safeJsonParse(event.newValue, initialValue));
        } else {
            // If newValue is null, it means the item was removed from localStorage
            setStoredValueState(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initialValue]); // initialValue is used in safeJsonParse and as fallback.

  return [storedValue, setValue];
}

export default useLocalStorage;
