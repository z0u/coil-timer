import z from 'zod';
import { TimerRestorePointSchema } from './TimerRestorePoint';
import { TimerStateSchema } from './TimerState';

export const TimerModelSchema = z.object({
  state: TimerStateSchema,
  restorePoint: TimerRestorePointSchema,
});
export type TimerModel = z.infer<typeof TimerModelSchema>;
