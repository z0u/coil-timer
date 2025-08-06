import z from 'zod';

const RestorePointSchema = z.object({
  duration: z.number(),
});

export const TimerRestorePointSchema = z.object({
  minutes: RestorePointSchema,
  hours: RestorePointSchema,
});
export type TimerRestorePoint = z.infer<typeof TimerRestorePointSchema>;
