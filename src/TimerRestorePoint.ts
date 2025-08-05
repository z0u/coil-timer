import z from 'zod';
import { TimerModeSchema } from './TimerMode';

export const TimerRestorePointSchema = z.record(
  TimerModeSchema,
  z.object({
    remainingTime: z.number(),
  }),
);
export type TimerRestorePoint = z.infer<typeof TimerRestorePointSchema>;
