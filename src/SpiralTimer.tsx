import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { HelpCircle, History, Moon, Pause, Scan, Sun, SunMoon } from 'lucide-react';
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { ClockFace, ClockFaceHandle } from './ClockFace';
import { HelpScreen } from './HelpScreen';
import { JogDial, JogEvent } from './JogDial';
import {
  formatDuration,
  formatDurationSr,
  formatTime,
  formatTimeSr,
  Hour,
  Hours,
  Milliseconds,
  Minute,
  Minutes,
  Second,
  Seconds,
} from './time-utils';
import { TimerState } from './TimerState';
import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';
import { useAnimation } from './useAnimation';
import { useColorScheme } from './useColorScheme';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { useMultiClick } from './useMultiClick';
import { useNonPassiveWheelHandler } from './useNonPassiveWheelHandler';
import { usePersistentTimerState } from './usePersistentTimerState';
import { useTemporaryState } from './useTemporaryState';
import { useWakeLock } from './useWakeLock';

// Interaction state for timer duration adjustments
interface TimerInteraction {
  remainingTime: number;
  hasChanged: boolean;
}

const OVERLAY_TIMEOUT = 5 * Second;

const FPS: Record<TimerState['is'], number> = {
  interacting: 30,
  running: 1,
  paused: 1 / 30, // Twice per minute
};

const SpiralTimer = () => {
  // Device capabilities
  const { isTouchDevice, hasKeyboard } = useDeviceCapabilities();
  const [timerState, setTimerState] = usePersistentTimerState();
  const scheme = useColorScheme();

  const [srTimeEl, setSrTimeEl] = useState<HTMLElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [jogDial, setJogDial] = useState<HTMLButtonElement | null>(null);
  const [clockFace, setClockFace] = useState<ClockFaceHandle | null>(null);
  const [mustShowControls, setMustShowControls] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [clockRadius, setClockRadius] = useState<number | null>(null);

  useWakeLock({ enable: timerState.is === 'running' });

  const timerInteractionRef = useRef<TimerInteraction | null>(null);
  const isOrWas = 'was' in timerState ? timerState.was : timerState.is;

  useEffect(() => {
    setMustShowControls(true);
  }, [timerState.is, setMustShowControls]);

  const clampTime = (time: number) => math.clamp(time, 0, 24 * Hours);

  const setRunningOrPaused = useCallback(
    (state: 'running' | 'paused', remainingTime: number) => {
      const newRemainingTime = clampTime(remainingTime);
      if (newRemainingTime <= 0 && state === 'running') {
        state = 'paused';
      }

      if (state === 'running') {
        const endTime = Date.now() + newRemainingTime;
        setTimerState({ is: 'running', endTime });
      } else {
        // When setting to paused, preserve existing savedDuration if it exists
        // Only set savedDuration to current time if we don't have one yet
        const savedDuration = (timerState.is === 'paused' && 'savedDuration' in timerState && timerState.savedDuration !== undefined) ? 
          timerState.savedDuration : newRemainingTime;
        setTimerState({ is: 'paused', remainingTime: newRemainingTime, savedDuration });
      }
    },
    [setTimerState, timerState],
  );

  const toggleRunningOrPaused = useCallback(() => {
    if (timerState.is === 'interacting') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;
    const nextState = timerState.is === 'running' ? 'paused' : 'running';
    setRunningOrPaused(nextState, remainingTime);
  }, [timerState, setRunningOrPaused]);

  const runFrame = useCallback(() => {
    let remainingTime: number;
    let endTime: number | null;

    if (timerState.is === 'interacting') {
      remainingTime = timerInteractionRef.current!.remainingTime;
      endTime = remainingTime + Date.now();
    } else if (timerState.is === 'running') {
      endTime = timerState.endTime;
      remainingTime = timerState.endTime - Date.now();
      if (remainingTime <= 0) {
        setRunningOrPaused('paused', 0);
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'paused') {
      endTime = timerState.remainingTime + Date.now();
      remainingTime = timerState.remainingTime;
    } else {
      throw new Error(`Unknown state: ${timerState}`);
    }

    if (clockFace) clockFace.setTime(remainingTime);
    if (srTimeEl) {
      srTimeEl.textContent = `${formatDurationSr(math.roundTo(remainingTime, Minutes))} (${formatTimeSr(endTime)})`;
    }
    if (timeEl) {
      timeEl.textContent = zerosAsOs(formatDuration(math.roundTo(remainingTime, Minutes)));
    }
    if (endTimeEl) {
      endTimeEl.textContent = zerosAsOs(formatTime(endTime));
    }
  }, [timerState, clockFace, srTimeEl, timeEl, endTimeEl, setRunningOrPaused]);

  useAnimation({ runFrame, fps: FPS[timerState.is] });

  const addTime = useCallback(
    (change: number) => {
      if (timerState.is === 'interacting') {
        // Do nothing: already dragging
        setTimerState({ ...timerState });
        return;
      }
      const remainingTime = timerState.is === 'paused' ? timerState.remainingTime : timerState.endTime - Date.now();
      const newRemainingTime = clampTime(remainingTime + change);

      if (timerState.is === 'paused') {
        // When adjusting a paused timer with keyboard, preserve the existing savedDuration
        // Don't update it - this is a temporary adjustment, not a committed change
        const savedDuration = 'savedDuration' in timerState && timerState.savedDuration !== undefined ? 
          timerState.savedDuration : timerState.remainingTime; // fallback to current time if no saved duration
        setTimerState({ is: 'paused', remainingTime: newRemainingTime, savedDuration });
      } else {
        setRunningOrPaused(timerState.is, newRemainingTime);
      }
    },
    [timerState, setTimerState, setRunningOrPaused],
  );

  // JogDial interaction handlers
  const handleJogStart = () => {
    if (timerState.is === 'interacting') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;

    timerInteractionRef.current = { remainingTime, hasChanged: false };
    const savedDuration = timerState.is === 'paused' && 'savedDuration' in timerState ? 
      timerState.savedDuration : undefined;
    setTimerState({ is: 'interacting', was: timerState.is, remainingTime, savedDuration });
  };

  const handleJogMove = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const deltaTime = (event.deltaAngle / math.TAU) * 1 * Hour;
    const newDuration = clampTime(timerInteractionRef.current.remainingTime + deltaTime);
    timerInteractionRef.current.remainingTime = newDuration;
    timerInteractionRef.current.hasChanged = event.wasDragged; // wasDragged indicates drag threshold was reached
  };

  const handleJogEnd = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const { remainingTime } = timerInteractionRef.current;

    if (event.wasDragged) {
      // If dragged, round to the nearest minute and resume previous state
      const newRemainingTime = math.roundTo(remainingTime, Minutes);
      
      // Save duration if we were paused and are dragging
      if (timerState.was === 'paused') {
        setTimerState({ is: 'paused', remainingTime: newRemainingTime, savedDuration: newRemainingTime });
      } else {
        setRunningOrPaused(timerState.was, newRemainingTime);
      }
    } else {
      // If tapped, toggle between running and paused
      const nextState = timerState.was === 'running' ? 'paused' : 'running';
      setRunningOrPaused(nextState, remainingTime);
    }
  };

  const handleJogKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (timerState.is === 'interacting') {
      // Prevent simultaneous interaction
      return;
    }

    switch (event.key) {
      case 'Enter':
      case ' ':
        toggleRunningOrPaused();
        break;
      case 'ArrowUp':
        addTime(event.shiftKey ? 1 * Hour : 5 * Minutes);
        break;
      case 'ArrowDown':
        addTime(event.shiftKey ? -1 * Hour : -5 * Minutes);
        break;
      case 'ArrowRight':
        addTime(event.shiftKey ? 5 * Minutes : 1 * Minute);
        break;
      case 'ArrowLeft':
        addTime(event.shiftKey ? -5 * Minutes : -1 * Minute);
        break;
    }
  };

  const handleBackgroundClicks = useMultiClick({
    single: () => setMustShowControls((value) => !value),
    double: () => toggleFullscreen(),
    interval: 250 * Milliseconds,
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  };

  const cycleColorScheme = () => {
    const nextScheme = scheme.selected === 'light' ? 'dark' : scheme.selected === 'dark' ? 'auto' : 'light';
    scheme.update(nextScheme);
  };

  const resetTimer = useCallback(() => {
    if (timerState.is === 'paused' && 'savedDuration' in timerState && timerState.savedDuration !== undefined) {
      setTimerState({ is: 'paused', remainingTime: timerState.savedDuration, savedDuration: timerState.savedDuration });
    }
  }, [timerState, setTimerState]);

  // Check if reset button should be shown
  const shouldShowReset = timerState.is === 'paused' && 
    'savedDuration' in timerState && 
    timerState.savedDuration !== undefined &&
    timerState.remainingTime !== timerState.savedDuration;

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (shouldShowReset) {
        resetTimer();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [shouldShowReset, resetTimer]);

  // Wheel gesture handler for adding/subtracting time
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const change = e.shiftKey ? 5 * Minutes : 30 * Seconds;
      addTime(delta > 0 ? -change : change);
    },
    [addTime],
  );
  useNonPassiveWheelHandler(container, handleWheel);

  const controlsAreVisible = timerState.is === 'paused' || mustShowControls;

  return (
    <div
      ref={setContainer}
      className={clsx('h-screen overflow-hidden', 'text-white', 'flex flex-col items-center justify-center')}
      style={{ '--clock-diameter': `${(clockRadius ?? 100) * 2}px` } as React.CSSProperties}
      onClick={handleBackgroundClicks}
    >
      {/* Clock face */}
      <div className={clsx('w-full h-full', 'breathe-animation', 'transition-opacity')}>
        {scheme.effective && (
          <ClockFace
            ref={setClockFace}
            className={clsx(
              // These are queried by the clock face to theme the canvas
              'stroke-red-500 dark:stroke-red-600', // Tracks
              'text-gray-600 dark:text-gray-200', // Ticks
              'bg-white dark:bg-black', // Background
            )}
            colorScheme={scheme.effective}
            initialTime={timerState.is === 'paused' ? timerState.remainingTime : 0}
            onClockRadiusChange={setClockRadius}
          />
        )}
        <JogDial
          ref={setJogDial}
          aria-label={(() => {
            // Compose ARIA label based on device
            if (isTouchDevice && !hasKeyboard) {
              // Likely a phone/tablet
              return isOrWas === 'paused'
                ? 'Timer control: tap to start, drag to adjust time'
                : 'Timer control: tap to pause, drag to adjust time';
            } else if (hasKeyboard && !isTouchDevice) {
              // Likely desktop with keyboard only
              return isOrWas === 'paused'
                ? 'Timer control: press space or enter to start, arrow keys to adjust time'
                : 'Timer control: press space or enter to pause, arrow keys to adjust time';
            } else if (isTouchDevice && hasKeyboard) {
              // Convertible or hybrid device
              return isOrWas === 'paused'
                ? 'Timer control: tap or press space/enter to start, drag or use arrow keys to adjust time'
                : 'Timer control: tap or press space/enter to pause, drag or use arrow keys to adjust time';
            } else {
              // Fallback
              return isOrWas === 'paused'
                ? 'Timer control: activate to start, adjust time'
                : 'Timer control: activate to pause, adjust time';
            }
          })()}
          title="Timer control"
          className={clsx(
            'absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2',
            'w-(--clock-diameter) h-(--clock-diameter) breathe-animation rounded-full',
            'leading-none font-[Inconsolata,monospace] ',
            'text-gray-600 dark:text-gray-300 dark:text-shadow-lg/30',
            'transition-opacity duration-500',
            timerState.is === 'interacting' || controlsAreVisible ? 'opacity-100' : 'opacity-0',
          )}
          onJogStart={handleJogStart}
          onJogMove={handleJogMove}
          onJogEnd={handleJogEnd}
          onKeyDown={handleJogKey}
        >
          {/* Use a live screen reader element for the time */}
          <span ref={setSrTimeEl} className="sr-only" aria-live="polite" aria-atomic="true"></span>
          {/* Use an element that is hidden from screen readers for the stylized display */}
          <span aria-hidden="true" className="flex items-center justify-center text-[calc(min(10vh,10vw))]">
            <span ref={setTimeEl} />
            <span className="inline-block w-0 flex items-baseline">
              <AnimatedColon isRunning={timerState.is === 'running'} />
            </span>
          </span>
          <span aria-hidden="true" className="block h-0 text-[calc(min(5vh,5vw))]">
            <span
              ref={setEndTimeEl}
              className={clsx(
                'text-gray-500 dark:text-gray-400',
                'transition-opacity duration-500 delay-2000',
                timerState.is === 'interacting' ? 'opacity-100' : 'opacity-0',
              )}
            >
              --
            </span>
          </span>
          <span className="block h-0 text-[calc(min(5vh,5vw))]">
            <span
              className={clsx(
                'text-gray-500 dark:text-gray-400',
                'transition-opacity duration-500',
                timerState.is === 'paused' ? 'opacity-100 delay-2000' : 'opacity-0',
              )}
            >
              <Pause className="inline" size="1em" />
            </span>
          </span>
        </JogDial>
      </div>

      <HelpScreen
        isHelpVisible={isHelpVisible}
        isPaused={timerState.is === 'paused'}
        controlsAreVisible={controlsAreVisible}
        onCloseClicked={() => {
          setIsHelpVisible(false);
          // Focus jog dial after help closes
          setTimeout(() => jogDial?.focus());
        }}
      />

      {/* Toolbar top */}
      <Toolbar isVisible={controlsAreVisible}>
        {shouldShowReset && (
          <ToolbarButton
            aria-label="Reset timer to saved duration"
            title="Reset timer"
            onClick={resetTimer}
          >
            <History size={24} />
          </ToolbarButton>
        )}

        <ToolbarButton
          aria-label={document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}
          title="Fullscreen"
          onClick={toggleFullscreen}
        >
          <Scan size={24} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cycleColorScheme}
          aria-label={`Switch to ${scheme.selected === 'light' ? 'dark' : scheme.selected === 'dark' ? 'system' : 'light'} theme`}
          title="Toggle color scheme"
        >
          <Sun
            size={24}
            className={clsx(
              'transition-opacity duration-200',
              scheme.selected === 'light' ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Moon
            className={clsx(
              'absolute inset-0',
              'transition-opacity duration-200',
              scheme.selected === 'dark' ? 'opacity-100' : 'opacity-0',
            )}
          />
          <SunMoon
            className={clsx(
              'absolute inset-0',
              'transition-opacity duration-200',
              scheme.selected === 'auto' ? 'opacity-100' : 'opacity-0',
            )}
          />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => setIsHelpVisible(true)}
          aria-label={isHelpVisible ? 'Hide instructions' : 'Show instructions'}
          title="Help"
        >
          <HelpCircle size={24} />
        </ToolbarButton>
      </Toolbar>
    </div>
  );
};

export default SpiralTimer;

const zerosAsOs = (text: string) => text.replaceAll('0', 'O');
