import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';

interface BaseToolbarButtonProps {
  'aria-label': string;
  title: string;
  className?: string;
  children: ReactNode;
  isVisible?: boolean | null;
  onClick?: (e: React.MouseEvent) => void;
}

interface ButtonProps extends BaseToolbarButtonProps {
  href?: never;
  target?: never;
  rel?: never;
}

interface LinkProps extends BaseToolbarButtonProps {
  href: string;
  target?: string;
  rel?: string;
}

type ToolbarButtonProps = ButtonProps | LinkProps;

export const ToolbarButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ToolbarButtonProps>(
  ({ 'aria-label': ariaLabel, title, className, children, isVisible, onClick, ...props }, ref) => {
    const baseClasses = clsx(
      'cursor-pointer text-gray-400',
      'transition-all duration-200 translate-x-[inherit]',
      isVisible == null ? 'opacity-[inherit]' : isVisible ? 'opacity-100' : 'opacity-0',
      'pointer-events-auto',
    );

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    };

    if ('href' in props) {
      const { href, target, rel } = props;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          aria-label={ariaLabel}
          title={title}
          className={clsx(baseClasses, className)}
          onClick={handleClick}
          href={href}
          target={target}
          rel={rel}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        aria-label={ariaLabel}
        title={title}
        className={clsx(baseClasses, className)}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  },
);

ToolbarButton.displayName = 'ToolbarButton';
