
import { useState, useEffect, useCallback } from 'react';

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
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    // This part runs only on the client during initial hydration/mount for useState.
    // However, to prevent hydration errors, it's safer to always return initialValue here,
    // and then load from localStorage in a useEffect.
    return initialValue;
  });

  // useEffect to update the state with the value from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      if (item !== null) { // Only update if item actually exists
        setStoredValue(safeJsonParse(item, initialValue));
      }
    } catch (error) {
      // If error also return initialValue
      console.warn(`Error reading localStorage key “${key}”:`, error);
      setStoredValue(initialValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if key changes

  // useEffect to update localStorage when the storedValue state changes
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = storedValue;
      // Save state
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);


  // useEffect for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        if (event.newValue) {
            setStoredValue(safeJsonParse(event.newValue, initialValue));
        } else {
            // If newValue is null, it means the item was removed from localStorage
            setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // initialValue is not needed as a dep here, safeJsonParse handles fallback

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
