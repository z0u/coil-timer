import { useEffect, useRef, useState } from 'react';
import deepEqual from './deep-equal';
import { TimerState, TimerStateSchema } from './TimerState';

const STORAGE_KEY = 'spiral-timer-state';

const min_to_ms = (m: number): number => m * 60 * 1000;

const DEFAULT_STATE: TimerState = {
  is: 'paused',
  remainingTime: min_to_ms(10),
};

const loadTimerState = (): TimerState | null => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
  } catch (e) {
    console.warn(`Failed to get state: ${e}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.info(`Failed to parse state: ${e}`);
    return null;
  }

  const result = TimerStateSchema.safeParse(parsed);
  if (!result.success) {
    console.info('Invalid timer state format:', result.error);
    return null;
  }
  const saved = result.data;

  if (saved.is === 'running') {
    const remaining = saved.endTime - Date.now();
    if (remaining > 0) {
      return { is: 'running', endTime: saved.endTime };
    } else {
      return { is: 'paused', remainingTime: 0 };
    }
  } else if (saved.is === 'paused') {
    return { is: 'paused', remainingTime: saved.remainingTime };
  }
  return null;
};

export function usePersistentTimerState() {
  const [timerState, setTimerState] = useState<TimerState>(() => loadTimerState() || DEFAULT_STATE);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    isInteractingRef.current = timerState.is === 'interacting';
    if (isInteractingRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timerState));
    } catch (e) {
      console.warn(`Count not save timer state to local storage: ${e}`);
    }
  }, [timerState]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (isInteractingRef.current || e.key !== STORAGE_KEY) return;
      const state = loadTimerState();
      if (state && !deepEqual(state, timerState)) {
        setTimerState(state);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [timerState]);

  return [timerState, setTimerState] as const;
}
