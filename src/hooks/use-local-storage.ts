
import { useState, useEffect, useCallback } from 'react';

function useLocalStorage<T>(
  key: string,
  initialValue: T // This is the value used for SSR and initial client render
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue); // Always start with initialValue

  // useEffect to load the value from localStorage after initial client render
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        // Ensure we don't try to parse "undefined" or other invalid JSON
        if (item === "undefined") {
            setStoredValue(initialValue);
        } else {
            setStoredValue(JSON.parse(item) as T);
        }
      }
      // If item is null, storedValue remains the initialValue from useState, which is fine.
    } catch (error) {
      console.error(`Error reading localStorage key “${key}” from useEffect:`, error);
      // Fallback to initialValue on error.
      setStoredValue(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only run on mount (client-side) or if key changes. initialValue removed.

  // useEffect to update local storage when storedValue changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Prevent overwriting localStorage with initialValue if storedValue hasn't changed from it yet
    // and localStorage already contains some persisted data. This might happen during initial hydration.
    if (storedValue === initialValue) {
        const itemInLs = window.localStorage.getItem(key);
        if (itemInLs !== null && itemInLs !== JSON.stringify(initialValue)) {
            // If LS has something different than initialValue, and storedValue is still initialValue,
            // it means the loading effect might not have finished, or initialValue is truly the current state.
            // In this specific case, we might not want to save initialValue back if LS already has richer data.
            // However, this can get complex. The primary load logic is in the first useEffect.
            // This effect should simply reflect the current `storedValue`.
        }
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue, initialValue]); // initialValue is included here to be cautious if the logic above for not overwriting is used.
                                      // More simply, could be just [key, storedValue] if we always save current storedValue.

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue(value);
    },
    [] // setStoredValue from useState is stable
  );

  // Effect for cross-tab sync (optional but good for robustness)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
        if (event.newValue) {
          try {
            // Ensure we don't try to parse "undefined" from another tab
            if (event.newValue === "undefined") {
                setStoredValue(initialValue);
            } else {
                setStoredValue(JSON.parse(event.newValue) as T);
            }
          } catch (error) {
             console.error(`Error parsing storage change for key “${key}” from another tab:`, error);
             setStoredValue(initialValue); // Fallback on error
          }
        } else {
          // Key was removed or set to null in another tab
          setStoredValue(initialValue);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [key, initialValue]); // initialValue is used as a fallback

  return [storedValue, setValue];
}

export default useLocalStorage;
