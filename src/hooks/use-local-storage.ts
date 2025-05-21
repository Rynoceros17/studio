
import { useState, useEffect, useCallback } from 'react';

function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value.
  // Initialize with initialValue. Actual value from localStorage will be loaded in useEffect.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Effect to load stored value from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      }
      // If item is null, storedValue remains initialValue, which is correct.
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      // Fallback to initialValue if reading/parsing fails
      setStoredValue(initialValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if key changes

  // Effect to save value to localStorage whenever storedValue changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  // Setter function
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      // Allow value to be a function, similar to useState's setter
      setStoredValue(value);
    },
    // setStoredValue from useState is stable, so no dependencies needed here
    // if we only pass it. However, if the component using this hook passes
    // `setValue` as a prop that might cause re-renders, this `useCallback`
    // without dependencies on `storedValue` itself can be beneficial.
    // For this implementation, `key` is not strictly needed as `setStoredValue`
    // is stable, but it's harmless.
    [key] 
  );

  return [storedValue, setValue];
}

export default useLocalStorage;
