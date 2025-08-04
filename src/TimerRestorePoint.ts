import z from 'zod';
import { TimerModeSchema } from './TimerMode';

export const TimerRestorePointSchema = z.object({
  mode: TimerModeSchema,
  remainingTime: z.number(),
});
export type TimerRestorePoint = z.infer<typeof TimerRestorePointSchema>;
