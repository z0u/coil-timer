import clsx from 'clsx';
import { ReactNode, useEffect, useRef } from 'react';

interface ToolbarProps {
  isVisible: boolean;
  isOpen: boolean;
  onToggle: () => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Toolbar = ({ isVisible, isOpen, onToggle, trigger, children, className }: ToolbarProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle();
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

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isOpen && !target.closest('[data-toolbar]')) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  return (
    <div
      role="navigation"
      data-toolbar
      className={clsx(
        'absolute top-6 inset-x-6',
        'transition-opacity duration-500',
        isVisible ? 'opacity-100' : 'opacity-0',
        'flex flex-row-reverse gap-6',
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
    </div>
  );
};
