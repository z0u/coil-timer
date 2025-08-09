import clsx from 'clsx';
import { GitMerge, RefreshCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { useTemporaryState } from './useTemporaryState';
import { Second } from './time-utils';

type HelpScreenProps = {
  isHelpVisible: boolean;
  bgAction: 'controls' | null;
  jogDialAction: 'pause' | 'resume' | 'reset' | null;
  onCloseClicked: () => void;
};

export const HelpScreen = ({ isHelpVisible, bgAction, jogDialAction, onCloseClicked }: HelpScreenProps) => {
  const device = useDeviceCapabilities();
  const [closeButton, setCloseButton] = useState<HTMLButtonElement | null>(null);
  const [isHiding, setIsHiding] = useTemporaryState(false, 1 * Second);

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

  const _onCloseClicked = () => {
    setIsHiding(true);
    onCloseClicked();
  };

  return (
    <div
      className={clsx(
        'absolute inset-0 z-1',
        'transition-all duration-500',
        isHelpVisible ? 'opacity-100 backdrop-blur-xs' : 'opacity-0 backdrop-blur-[0]',
        'pointer-events-none',
      )}
    >
      {isHelpVisible || isHiding ? (
        <section
          aria-label="Help and instructions"
          className={clsx(
            'absolute inset-0',
            'text-black dark:text-white dark:text-shadow-lg/30',
            'transition-all duration-500',
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
            onClick={_onCloseClicked}
          >
            <X size={24} />
          </button>

          {/* Help for clock face */}
          <div
            className={clsx(
              'w-full h-full', // matches clock face
              'flex flex-col items-center justify-center',
            )}
          >
            <h2 className="text-lg text-gray-800 dark:text-gray-300 mb-2">Clock face</h2>
            <ul className="contents">
              <li>
                <strong>{device.isTouchDevice ? 'Tap' : 'Click'}:</strong>{' '}
                {jogDialAction === 'pause'
                  ? 'pause'
                  : jogDialAction === 'resume'
                    ? 'start/resume'
                    : jogDialAction === 'reset'
                      ? 'reset'
                      : '...'}
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
                {bgAction === 'controls' ? <>hide/show controls</> : <>hide/show controls (when running)</>}
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
          <div className={clsx('absolute bottom-6 inset-x-6', 'flex flex-col items-start justify-center')}>
            <h2 className="sr-only">Links</h2>
            <ul className="content">
              <li className="content">
                <button
                  type="button"
                  className={clsx('pointer-events-auto cursor-pointer py-2')}
                  onClick={() => window.location.reload()}
                  title="Refresh the page to update the app"
                >
                  <RefreshCcw className="inline mx-2" />
                  Refresh app
                </button>
              </li>
              <li className="content">
                <a
                  href="https://github.com/z0u/coil-timer"
                  className="inline-block pointer-events-auto hover:underline py-2"
                >
                  <GitMerge className="inline mx-2" />
                  Source code on GitHub
                </a>
              </li>
              <li className="content">
                <span>&nbsp;</span>
              </li>
            </ul>
          </div>
        </section>
      ) : (
        <></>
      )}
    </div>
  );
};
