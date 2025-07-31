import clsx from 'clsx';

type AnimatedColonProps = {
  isRunning: boolean;
};

/** A `:` character that cycles through: none, top, both, bottom, none... */
export const AnimatedColon = ({ isRunning }: AnimatedColonProps) => {
  return (
    <span
      className={clsx(
        'relative h-[1em] inline-block align-text-top',
        'transition-opacity duration-200',
        isRunning ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden="true"
    >
      <span className="opacity-0">:</span>
      <span
        className={clsx(
          'absolute left-1/2 top-[43%] -translate-x-1/2 size-[0.125em]',
          'rounded-full bg-current',
          'animate-[colon-dot_1s_ease_infinite]',
        )}
      />
      <span
        className={clsx(
          'absolute left-1/2 top-[75%] -translate-x-1/2 size-[0.125em]',
          'rounded-full bg-current',
          'animate-[colon-dot_1s_0.5s_ease_infinite]',
        )}
      />
    </span>
  );
};
