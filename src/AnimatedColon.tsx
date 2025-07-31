import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { sec_to_ms } from './time-utils';

/** A `:` character that cycles through: none, top, both, bottom, none... */
export const AnimatedColon = ({ isRunning }: { isRunning: boolean }) => {
  const [state, setState] = useState(0); // 0: none, 1: top, 2: both, 3: bottom

  useEffect(() => {
    if (!isRunning) {
      setState(2); // show both dots when not running
      return;
    }
    const interval = setInterval(() => {
      setState((s) => (s + 1) % 4);
    }, sec_to_ms(0.5));
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <span className="relative h-[1em] mx-[0.1em] inline-block align-text-top" aria-hidden="true">
      <span className="opacity-1">:</span>
      <span
        className={clsx(
          'absolute left-1/2 top-[43%] -translate-x-1/2 size-[0.125em]',
          'rounded-full bg-current',
          'transition-opacity duration-200',
          state === 1 || state === 2 ? 'opacity-100' : 'opacity-30',
        )}
      />
      <span
        className={clsx(
          'absolute left-1/2 top-[75%] -translate-x-1/2 size-[0.125em]',
          'rounded-full bg-current',
          'transition-opacity duration-200',
          state === 2 || state === 3 ? 'opacity-100' : 'opacity-30',
        )}
      />
    </span>
  );
};
