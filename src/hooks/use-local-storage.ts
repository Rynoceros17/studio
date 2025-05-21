
import { useState, useEffect, useCallback } from 'react';

// Helper function to safely parse JSON, includes the key for better error logging
function safeJsonParseWithKey<T>(jsonString: string | null, fallback: T, key: string): T {
  if (jsonString === null) {
    return fallback;
  }
  try {
    // Handle the case where "undefined" string might have been stored.
    if (jsonString === "undefined") {
        // console.warn(`Found "undefined" string in localStorage for key "${key}", using fallback.`);
        return fallback;
    }
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.warn(`Failed to parse JSON ("${jsonString}") from localStorage for key "${key}", using fallback.`, e);
    return fallback;
  }
}

function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] { // Return standard React dispatch type
  const [storedValue, setStoredValue] = useState<T>(() => {
    // This function is executed only on the initial render.
    // On the server, or if window is undefined, return initialValue.
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      // Try to get the item from localStorage.
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue.
      return item ? safeJsonParseWithKey(item, initialValue, key) : initialValue;
    } catch (error) {
      // If error reading from localStorage, return initialValue and log the error.
      console.warn(`Error reading localStorage key “${key}” during initial state setup:`, error);
      return initialValue;
    }
  });

  // useEffect to update localStorage when the state (storedValue) changes.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // console.log(`Saving to localStorage key "${key}":`, storedValue);
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        // If error setting item in localStorage, log it.
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, storedValue]);

  // useEffect to listen for storage events to sync across tabs.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        // console.log(`Storage event for key "${key}" in another tab. New value:`, event.newValue);
        // When a storage event occurs, set the state to the new value.
        // Use initialValue as a fallback if the new value is null or parsing fails.
        setStoredValue(safeJsonParseWithKey(event.newValue, initialValue, key));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Cleanup function to remove the event listener when the component unmounts or dependencies change.
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  // Dependencies: key and initialValue.
  // initialValue is used as a fallback in safeJsonParseWithKey.
  // If initialValue's reference changes, the effect re-runs, re-attaching the listener, which is generally fine.
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
