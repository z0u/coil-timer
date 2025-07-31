import z from 'zod';

// State definitions
export const TimerStateSchema = z.union([
  z.object({ is: z.literal('running'), endTime: z.number() }),
  z.object({ is: z.literal('paused'), remainingTime: z.number() }),
  z.object({
    is: z.literal('interacting'),
    was: z.union([z.literal('running'), z.literal('paused')]),
    remainingTime: z.number(),
  }),
]);

export type TimerState = z.infer<typeof TimerStateSchema>;
