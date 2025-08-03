import clsx from 'clsx';
import { GitMerge, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDeviceCapabilities } from './useDeviceCapabilities';

type HelpScreenProps = {
  isHelpVisible: boolean;
  isPaused: boolean;
  controlsAreVisible: boolean;
  onCloseClicked: () => void;
};

export const HelpScreen = ({ isHelpVisible, isPaused, controlsAreVisible, onCloseClicked }: HelpScreenProps) => {
  const device = useDeviceCapabilities();
  const [closeButton, setCloseButton] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isHelpVisible) {
      closeButton?.focus();
    }
  }, [isHelpVisible, closeButton]);

  useEffect(() => {
    if (!isHelpVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseClicked();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHelpVisible, onCloseClicked]);

  return (
    <div
      className={clsx(
        'absolute inset-0 z-1',
        'text-black dark:text-white dark:text-shadow-lg/30',
        'transition-all duration-500',
        isHelpVisible ? 'opacity-100 backdrop-blur-xs' : 'opacity-0 backdrop-blur-[0]',
        'pointer-events-none',
      )}
    >
      <button
        ref={setCloseButton}
        aria-label="Dismiss help"
        title="Dismiss"
        className={clsx(
          'absolute top-6 right-6',
          'cursor-pointer text-gray-700 dark:text-gray-400',
          isHelpVisible && 'pointer-events-auto',
        )}
        onClick={onCloseClicked}
      >
        <X size={24} />
      </button>

      {/* Help for clock face */}
      <div
        className={clsx(
          'absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2',
          'w-(--clock-diameter) h-(--clock-diameter) breathe-animation',
          'flex flex-col items-center justify-center',
        )}
      >
        <h2 className="text-lg text-gray-800 dark:text-gray-300 mb-2">Clock face</h2>
        <ul className="contents">
          <li>
            <strong>{device.isTouchDevice ? 'Tap' : 'Click'}:</strong> {isPaused ? 'resume' : 'pause'}
          </li>
          <li>
            <strong>Hold:</strong> show end time
          </li>
          <li>
            <strong>{device.isTouchDevice ? 'Swipe' : 'Drag'}:</strong> set time
          </li>
        </ul>
      </div>

      {/* Help for background */}
      <div className={clsx('absolute top-6 left-6')}>
        <h2 className="text-lg text-gray-800 dark:text-gray-300 mb-2">Background</h2>
        <ul>
          <li>
            <strong>{device.isTouchDevice ? 'Tap' : 'Click'}:</strong>{' '}
            {isPaused ? (
              <>
                <del>hide/show controls</del> (when running)
              </>
            ) : (
              <>{controlsAreVisible ? 'hide' : 'show'} controls</>
            )}
          </li>
          <li>
            <strong>{device.isTouchDevice ? 'Tap-tap' : 'Double-click'}:</strong> enter fullscreen
          </li>
          {!device.isMobile && (
            <li>
              <strong>Scroll:</strong> set time
            </li>
          )}
        </ul>
        {device.isMobile && <p className="text-sm mt-2">Full-screen mode hides the phone status bar.</p>}
      </div>

      {/* Links */}
      <div className={clsx('absolute bottom-6 inset-x-6', 'flex flex-col items-center justify-center')}>
        <h2 className="sr-only">Links</h2>
        <ul className="contents">
          <li>
            <a href="https://github.com/z0u/coil-timer" className="pointer-events-auto hover:underline">
              <GitMerge className="inline mx-2" />
              Source code on GitHub
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};
