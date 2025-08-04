import z from 'zod';

export const TimerModeSchema = z.enum(['hours', 'minutes']);
export type TimerMode = z.infer<typeof TimerModeSchema>;
