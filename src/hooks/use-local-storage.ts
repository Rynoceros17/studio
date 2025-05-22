
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
  // Step 1: Initialize state with initialValue.
  // This ensures server-side rendering and the first client render are consistent.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Step 2: useEffect to load from localStorage on mount (client-side only).
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          // Only update state if an item was actually found in localStorage
          // Use a temporary variable to avoid direct state update if value hasn't changed
          const loadedValue = safeJsonParseWithKey(item, initialValue, key);
          // Only set state if the loaded value is different from the current storedValue
          // This can help prevent unnecessary re-renders if initialValue was already the correct one
          // However, for complex objects, a deep comparison might be needed,
          // for now, a simple comparison or just setting it might be fine.
          // Let's simplify and always set it, relying on React to handle no-op if values are identical.
          setStoredValue(loadedValue);
        }
        // If item is null, storedValue remains initialValue, which is correct.
      } catch (error) {
        console.warn(`Error reading localStorage key “${key}” during mount:`, error);
        // Fallback to initialValue is implicitly handled by not setting state here on error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Run only on mount or if key changes. InitialValue removed to prevent re-fetch if it changes unless key changes.

  // Step 3: useEffect to update localStorage when storedValue changes.
  useEffect(() => {
    // Only save to localStorage if it's not the initialValue,
    // or if the initialValue itself represents something to be saved.
    // This check prevents overwriting localStorage with initialValue if localStorage was empty.
    // However, if storedValue is explicitly set to initialValue (e.g. by user action clearing data),
    // it should be saved.
    // The previous effect already handles loading, so this effect should just save.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, storedValue]);

  // Step 4: useEffect for cross-tab synchronization.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        setStoredValue(safeJsonParseWithKey(event.newValue, initialValue, key));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
    // initialValue is a dependency for the fallback in safeJsonParse.
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
