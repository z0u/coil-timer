import * as math from '@thi.ng/math';
import z from 'zod';
import { Hours } from './time-utils';

const RunningStateSchema = z.object({
  is: z.literal('running'),
  endTime: z.number(),
});

const PausedStateSchema = z.object({
  is: z.literal('paused'),
  remainingTime: z.number(),
});

const FinishedStateSchema = z.object({
  is: z.literal('finished'),
});

const InteractingStateSchema = z.object({
  is: z.literal('interacting'),
  was: z.union([z.literal('running'), z.literal('paused')]),
  remainingTime: z.number(),
});

// State definitions
export const TimerStateSchema = z.union([
  RunningStateSchema,
  PausedStateSchema,
  FinishedStateSchema,
  InteractingStateSchema,
]);

export type TimerState = z.infer<typeof TimerStateSchema>;
type RunningState = z.infer<typeof RunningStateSchema>;
type PausedState = z.infer<typeof PausedStateSchema>;
type FinishedState = z.infer<typeof FinishedStateSchema>;
type InteractingState = z.infer<typeof InteractingStateSchema>;

export const toRunning = (state: Readonly<PausedState | InteractingState>): RunningState => {
  const endTime = Date.now() + state.remainingTime;
  return { is: 'running', endTime };
};

export const toPaused = (state: Readonly<RunningState | InteractingState | FinishedState>): Readonly<PausedState> => {
  if (state.is === 'finished') {
    return { is: 'paused', remainingTime: 0 };
  } else if (state.is === 'interacting') {
    return { is: 'paused', remainingTime: clampHours(state.remainingTime) };
  } else {
    const remainingTime = clampHours(state.endTime - Date.now());
    return { is: 'paused', remainingTime };
  }
};

export const togglePaused = (state: Readonly<RunningState | PausedState>): Readonly<RunningState | PausedState> => {
  return state.is === 'running' ? toPaused(state) : toRunning(state);
};

export const runningOrPaused = (
  is: 'running' | 'paused',
  timeRemaining: number,
): Readonly<RunningState | PausedState> => {
  if (is === 'running') return { is: 'running', endTime: Date.now() + timeRemaining };
  else return { is: 'paused', remainingTime: clampHours(timeRemaining) };
};

export const toFinished = (_state: Readonly<RunningState>): Readonly<FinishedState> => {
  return { is: 'finished' };
};

export const toInteracting = (state: Readonly<RunningState> | Readonly<PausedState>): Readonly<InteractingState> => {
  return {
    is: 'interacting',
    was: state.is,
    remainingTime: state.is === 'running' ? state.endTime - Date.now() : state.remainingTime,
  };
};

export function changeTime(
  state: Readonly<RunningState | PausedState>,
  delta: number,
): Readonly<RunningState | PausedState> {
  const remainingTime = state.is === 'paused' ? state.remainingTime : state.endTime - Date.now();
  const newRemainingTime = clampHours(remainingTime + delta);

  if (state.is === 'running' && newRemainingTime > 0) {
    return { is: 'running', endTime: Date.now() + newRemainingTime };
  } else {
    return { is: 'paused', remainingTime: newRemainingTime };
  }
}

const clampHours = (duration: number) => math.clamp(duration, 0, 24 * Hours);
