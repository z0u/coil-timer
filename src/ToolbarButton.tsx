import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';

interface BaseToolbarButtonProps {
  'aria-label': string;
  title: string;
  className?: string;
  disabled?: boolean;
  highlight?: boolean;
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
  (
    {
      'aria-label': ariaLabel,
      title,
      className,
      disabled = false,
      highlight = false,
      children,
      isVisible,
      onClick,
      ...props
    },
    ref,
  ) => {
    const baseClasses = clsx(
      'cursor-pointer text-gray-700 dark:text-gray-400',
      'transition-[filter,opacity] duration-200 translate-x-[inherit]',
      disabled && !highlight ? 'filter-[opacity(30%)]' : 'filter-[opacity(100%)]',
      isVisible == null ? 'opacity-[inherit]' : isVisible ? 'opacity-100' : 'opacity-0',
      disabled ? 'pointer-events-none' : 'pointer-events-auto',
      'transform active:scale-95',
    );

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) onClick?.(e);
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
          aria-disabled={disabled}
          href={disabled ? undefined : href}
          target={target}
          rel={rel}
          tabIndex={disabled ? -1 : 0}
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
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  },
);

ToolbarButton.displayName = 'ToolbarButton';
