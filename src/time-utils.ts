import * as math from '@thi.ng/math';

export const secToMs = (s: number): number => s * 1000;
export const minToMs = (m: number): number => secToMs(m * 60);

export const ceilMinutes = (duration: number, minutes: number = 1): number =>
  Math.ceil(duration / minToMs(minutes)) * minToMs(minutes);

export const roundMinutes = (duration: number, minutes: number = 1): number => math.roundTo(duration, minToMs(minutes));
