import clsx from 'clsx';
import { ReactNode, useEffect, useRef } from 'react';

interface ToolbarProps {
  ariaLabel: string;
  isVisible: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
  position?: 'top-right' | 'bottom-left' | 'bottom-right';
}

export const Toolbar = ({
  ariaLabel,
  isVisible,
  isOpen = true,
  onToggle,
  trigger,
  children,
  className,
  position = 'top-right',
}: ToolbarProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle?.();
        // Return focus to trigger button - find the button inside the trigger div
        const button = triggerRef.current?.querySelector('button');
        button?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onToggle]);

  // Handle click outside to close, or click on menu items to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const toolbarElement = target.closest('[data-toolbar]');
      const triggerElement = triggerRef.current;

      if (isOpen) {
        // Close if clicking outside the toolbar
        if (!toolbarElement) {
          onToggle?.();
        }
        // Close if clicking on a menu item (but not the trigger button)
        else if (toolbarElement && triggerElement && !triggerElement.contains(target)) {
          // Check if the clicked element is a button or link (menu item)
          const isMenuItem = target.closest('button, a');
          if (isMenuItem) {
            onToggle?.();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClick, { capture: true });
      return () => document.removeEventListener('click', handleClick, { capture: true });
    }
  }, [isOpen, onToggle]);

  return (
    <nav
      data-toolbar
      aria-label={ariaLabel}
      className={clsx(
        'absolute',
        'flex gap-6',
        position === 'bottom-left'
          ? 'bottom-6 left-6 flex-col-reverse portrait:flex-row'
          : position === 'bottom-right'
            ? 'bottom-6 right-6 flex-col-reverse portrait:flex-row-reverse'
            : 'top-6 right-6 flex-col portrait:flex-row-reverse',
        'transition-all duration-500',
        isVisible ? 'opacity-50 hover:opacity-100 visible' : 'opacity-0 invisible',
        className,
      )}
    >
      {/* Trigger button */}
      <div className={clsx('contents')} ref={triggerRef} onClick={onToggle}>
        {trigger}
      </div>

      {/* Menu items - only visible when open */}
      <div
        className={clsx(
          'contents',
          // Opacity and translate are inherited by the children
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2',
          !isOpen && 'pointer-events-none',
        )}
      >
        {children}
      </div>
    </nav>
  );
};
