
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
  // Initialize with initialValue to ensure server and client first render match
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Effect to load from localStorage after initial client render
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) { // Check if item actually exists
        const valueFromStorage = safeJsonParseWithKey(item, initialValue, key);
        // Only update state if the stored value is different from the current initialValue
        // This can prevent an unnecessary re-render if initialValue is already what's in storage
        // (or if storage is empty and initialValue is the fallback).
        // However, for complex objects, direct comparison might be tricky.
        // A simple update is often fine.
        setStoredValue(valueFromStorage);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}” during effect:`, error);
      // We don't setStoredValue to initialValue here again, as it's already initialized with it.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Removed initialValue from dependency array to avoid re-running if initialValue reference changes unnecessarily.

  // Effect to save to localStorage when storedValue changes
  useEffect(() => {
    // Only save if storedValue is different from the initialValue provided to the hook,
    // or if it's explicitly set to something else by the component.
    // This prevents writing initialValue to localStorage on first load if nothing was there.
    // However, the component might want to persist initialValue if that's its true default.
    // For simplicity and to ensure persistence even if initialValue is used, we save.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
      }
    }
  }, [key, storedValue]);

  // Effect to listen for storage events to sync across tabs
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
  // initialValue is needed here because safeJsonParseWithKey uses it as a fallback.
  }, [key, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
