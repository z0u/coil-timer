import z from 'zod';
import { useLocalStorage } from './useLocalStorage';

export type TimerMode = 'hours' | 'minutes';

const TimerModeSchema = z.enum(['hours', 'minutes']);

export const usePersistentTimerMode = () => {
  return useLocalStorage('timer-mode', TimerModeSchema, 'hours');
};