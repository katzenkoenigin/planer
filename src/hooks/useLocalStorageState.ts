import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
      const parsed = JSON.parse(raw);
      const init = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
      if (Array.isArray(init)) return Array.isArray(parsed) ? (parsed as T) : init;
      if (typeof init === 'object' && init !== null) return parsed && typeof parsed === 'object' ? (parsed as T) : init;
      return (parsed as T) ?? init;
    } catch {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }
  };

  const [state, setState] = useState<T>(read);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState] as const;
}
