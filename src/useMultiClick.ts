import { MouseEvent } from 'react';
import { useTimeoutRef } from './useTimeoutRef';

type UseMultiClickProps = {
  /** Runs immediately on first click */
  indeterminate?: (e: MouseEvent) => void;
  /** Runs after a delay if there was no second click */
  single?: (e: MouseEvent) => void;
  /** Runs immediately on double-click */
  double?: (e: MouseEvent) => void;
  /** The amount of time to wait for the second click */
  interval?: number;
};

export const useMultiClick = ({ single, double, indeterminate, interval = 250 }: UseMultiClickProps) => {
  const singleClickTimeout = useTimeoutRef();

  const handleClick = (e: MouseEvent) => {
    if (e.detail === 1) {
      indeterminate?.(e);
      singleClickTimeout.set(() => {
        single?.(e);
      }, interval);
    } else if (e.detail === 2) {
      singleClickTimeout.clear();
      double?.(e);
    }
  };

  return handleClick;
};
