import clsx from 'clsx';
import { ReactNode } from 'react';
import { ToolbarButton } from './ToolbarButton';

interface ToggleButtonProps {
  isToggled: boolean;
  onToggle: () => void;
  isVisible?: boolean | null;
  'aria-label': string;
  title: string;
  className?: string;
  disabled?: boolean;
  defaultIcon: ReactNode;
  toggledIcon: ReactNode;
}

export const ToggleButton = ({
  isToggled,
  onToggle,
  isVisible,
  'aria-label': ariaLabel,
  title,
  className,
  disabled,
  defaultIcon,
  toggledIcon,
}: ToggleButtonProps) => {
  return (
    <ToolbarButton
      aria-label={ariaLabel}
      title={title}
      className={clsx('relative', className)}
      disabled={disabled}
      isVisible={isVisible}
      onClick={onToggle}
    >
      <div className={clsx('transition-opacity duration-200', isToggled ? 'opacity-0' : 'opacity-100')}>
        {defaultIcon}
      </div>
      <div
        className={clsx('absolute inset-0', 'transition-opacity duration-200', isToggled ? 'opacity-100' : 'opacity-0')}
      >
        {toggledIcon}
      </div>
    </ToolbarButton>
  );
};
