// Loads data from the server when a screen is shown, with reload support.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from './api';

export function useApi<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time the screen comes into view.
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return { data, error, loading, reload, setData };
}
