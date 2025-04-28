import { useState, useEffect, useCallback } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Function to safely get initial value from localStorage
  const getInitialValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  };

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(getInitialValue);

  // useEffect to update local storage when the state changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      // Save state to local storage
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]); // Depend on storedValue directly

  // Define the setter function using useCallback for stability
   const setValue = useCallback((value: T | ((val: T) => T)) => {
       try {
           // Allow value to be a function so we have the same API as useState
           const valueToStore = value instanceof Function ? value(storedValue) : value;
           // Set state
           setStoredValue(valueToStore);
           // Update local storage immediately as well (redundant with useEffect but ensures consistency if effect hasn't run)
           if (typeof window !== 'undefined') {
               window.localStorage.setItem(key, JSON.stringify(valueToStore));
           }
       } catch (error) {
            console.error(`Error setting value for key “${key}”:`, error);
       }
   }, [key, storedValue]); // Include storedValue in dependency array if needed by functional updates


  // Re-sync with local storage if the key changes (though unlikely in this app)
  useEffect(() => {
      setStoredValue(getInitialValue());
  }, [key]);


  return [storedValue, setValue];
}

export default useLocalStorage;
