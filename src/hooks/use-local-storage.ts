
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
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // State to store our value
  // Read initial value from localStorage if on client, otherwise use initialValue.
  // This function is only executed on the initial render.
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue; // Server-side rendering, use initialValue
    }
    try {
      const item = window.localStorage.getItem(key);
      // If item exists, parse it. Otherwise, use initialValue.
      return item ? safeJsonParseWithKey(item, initialValue, key) : initialValue;
    } catch (error) {
      // If error reading, fallback to initialValue
      console.warn(`Error reading localStorage key “${key}” during initial state setup:`, error);
      return initialValue;
    }
  });

  // useEffect to update localStorage when storedValue changes.
  // This runs on the client after every render where key or storedValue changes.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // console.log(`Saving to localStorage key "${key}":`, storedValue);
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, storedValue]);

  // useEffect to listen for storage events (for cross-tab sync).
  // This runs on the client after mount and if key or initialValue (for fallback) changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        // console.log(`Storage event for key "${key}":`, event.newValue);
        setStoredValue(safeJsonParseWithKey(event.newValue, initialValue, key));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
    // initialValue is a dependency because safeJsonParseWithKey uses it as a fallback.
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
