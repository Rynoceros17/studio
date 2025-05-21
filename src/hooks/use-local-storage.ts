
import { useState, useEffect, useCallback } from 'react';

// Helper to safely parse JSON, now includes the key for better error logging
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
): [T, (value: T | ((val: T) => T)) => void] {
  const [value, setValueState] = useState<T>(initialValue); // Step 1: Always initialize with initialValue

  // Step 2: On client mount, try to load from localStorage and update state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        // If item exists, parse it and set state. Otherwise, `value` remains `initialValue`.
        // This might cause a re-render if localStorage has a different value than initialValue.
        if (item !== null) {
            setValueState(safeJsonParseWithKey(item, initialValue, key));
        }
      } catch (error) {
        // This catch is primarily for if localStorage itself is unavailable,
        // parsing errors are handled in safeJsonParseWithKey.
        console.warn(`Error accessing localStorage for key “${key}” during mount:`, error);
        // `value` remains `initialValue`.
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Run only when key changes (effectively once on mount for a stable key)

  // Step 3: Persist to localStorage whenever the `value` state changes.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // If `value` is actually `undefined`, JSON.stringify will produce the string "undefined".
        // localStorage.setItem will store this string.
        // The loading part (safeJsonParseWithKey) handles parsing "undefined" string by falling back.
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, value]); // Re-run if key or value changes

  // The setValue function remains the same.
  const setValue = useCallback(
    (newValue: T | ((val: T) => T)) => {
      setValueState(newValue); // This will trigger the effect above to save to localStorage
    },
    [] // setValueState from useState is stable
  );

  // Cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        // Check if the new value is actually different from the current state
        // to avoid potential infinite loops if multiple tabs react.
        const currentStringifiedValue = JSON.stringify(value);
        if (event.newValue !== currentStringifiedValue) {
          setValueState(safeJsonParseWithKey(event.newValue, initialValue, key));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initialValue, value]); // Include `value` in dependencies for accurate comparison in handleStorageChange

  return [value, setValue];
}

export default useLocalStorage;
