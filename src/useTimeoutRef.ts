import { useCallback, useEffect, useRef } from 'react';

export const useTimeoutRef = () => {
  const timeoutRef = useRef<number | null>(null);

  // Set a new timeout, clearing any previous one
  const set = useCallback((fn: () => void, ms: number) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(fn, ms);
  }, []);

  // Cancel the timeout
  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => clear, [clear]);

  return { set, clear, ref: timeoutRef };
};
