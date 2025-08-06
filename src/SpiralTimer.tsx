import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { ClockFading, HelpCircle, Moon, Pause, RotateCw, Scan, Sun, SunMoon, TimerReset } from 'lucide-react';
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { ClockFace, ClockFaceHandle } from './ClockFace';
import { HelpScreen } from './HelpScreen';
import { JogDial, JogEvent } from './JogDial';
import {
  formatDuration,
  formatDurationMinutes,
  formatDurationMinutesSr,
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
import { TimerRestorePointSchema } from './TimerRestorePoint';
import {
  changeMode,
  changeTime,
  clampDuration,
  runningOrPaused,
  TimerState,
  TimerStateSchema,
  toFinished,
  togglePaused,
  toInteracting,
  toPaused,
} from './TimerState';
import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';
import { useAnimation } from './useAnimation';
import { useColorScheme } from './useColorScheme';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { useLocalStorage } from './useLocalStorage';
import { useMultiClick } from './useMultiClick';
import { useNonPassiveWheelHandler } from './useNonPassiveWheelHandler';
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
  paused: 1 / 30,
  finished: 60,
};

const MINUTES_MODE_FPS = {
  ...FPS,
  running: 6, // mimic high-resolution stopwatches
};

const SpiralTimer = () => {
  // Device capabilities
  const { isTouchDevice, hasKeyboard } = useDeviceCapabilities();
  const [timerState, setTimerState] = useLocalStorage('coil-timer-state', TimerStateSchema, {
    is: 'paused',
    mode: 'hours',
    remainingTime: 10 * Minutes,
  });
  const [restorePoint, setRestorePoint] = useLocalStorage('coil-timer-restore-point', TimerRestorePointSchema, {
    minutes: { duration: 5 * Seconds },
    hours: { duration: 10 * Minutes },
  });
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

  const clampTime = useCallback(
    (time: number) => {
      const maxTime = timerState.mode === 'hours' ? 24 * Hours : 20 * Minutes;
      return math.clamp(time, 0, maxTime);
    },
    [timerState.mode],
  );

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
        setTimerState(toFinished(timerState));
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'finished') {
      // Handle victory animation
      const deltaTime = 16.67; // Assume ~60 FPS, so ~16.67ms per frame

      const animationComplete = clockFace?.stepVictory(deltaTime) ?? false;
      remainingTime = 0;
      endTime = null;

      if (animationComplete) {
        setTimerState(toPaused(timerState));
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'paused') {
      endTime = timerState.remainingTime + Date.now();
      remainingTime = timerState.remainingTime;
    } else {
      throw new Error(`Unknown state: ${timerState}`);
    }

    clockFace?.draw(remainingTime);

    if (srTimeEl && endTime != null) {
      if (timerState.mode === 'hours') {
        srTimeEl.textContent = `${formatDurationSr(math.roundTo(remainingTime, Minutes))} (${formatTimeSr(endTime)})`;
      } else {
        srTimeEl.textContent = `${formatDurationMinutesSr(math.roundTo(remainingTime, Seconds))} (${formatTimeSr(endTime)})`;
      }
    }

    if (timeEl) {
      if (timerState.mode === 'hours') {
        timeEl.textContent = zerosAsOs(formatDuration(math.roundTo(remainingTime, Minutes)));
      } else {
        timeEl.textContent = zerosAsOs(formatDurationMinutes(math.roundTo(remainingTime, Seconds)));
      }
    }

    if (endTimeEl && endTime != null) {
      endTimeEl.textContent = zerosAsOs(formatTime(endTime));
    }
  }, [timerState, clockFace, srTimeEl, timeEl, endTimeEl, setTimerState]);

  const fpsMap = timerState.mode === 'hours' ? FPS : MINUTES_MODE_FPS;
  useAnimation({ runFrame, fps: fpsMap[timerState.is] });

  // JogDial interaction handlers
  const handleJogStart = () => {
    if (timerState.is === 'interacting' || timerState.is === 'finished') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;

    timerInteractionRef.current = { remainingTime, hasChanged: false };
    setTimerState(toInteracting(timerState));
  };

  const handleJogMove = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const timePerRevolution = timerState.mode === 'hours' ? 1 * Hour : 1 * Minute;
    const deltaTime = (event.deltaAngle / math.TAU) * timePerRevolution;
    const newDuration = clampTime(timerInteractionRef.current.remainingTime + deltaTime);
    timerInteractionRef.current.remainingTime = newDuration;
    timerInteractionRef.current.hasChanged = event.wasDragged; // wasDragged indicates drag threshold was reached
  };

  const handleJogEnd = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const { remainingTime } = timerInteractionRef.current;

    if (event.wasDragged) {
      // If dragged, round to the nearest minute/second and resume previous state
      const newRemainingTime = clampDuration(timerState.mode, remainingTime);
      if (timerState.was === 'paused' && remainingTime > 0) {
        setRestorePoint({
          ...restorePoint,
          [timerState.mode]: { duration: newRemainingTime },
        });
      }
      setTimerState(runningOrPaused(timerState.was, timerState.mode, newRemainingTime));
    } else {
      // If tapped, toggle between running and paused
      if (timerState.was === 'paused' && remainingTime === 0) {
        // Click happened after timer had finished
        setTimerState(runningOrPaused('paused', timerState.mode, restorePoint[timerState.mode].duration));
      } else {
        const nextState = timerState.was === 'running' ? 'paused' : 'running';
        setTimerState(runningOrPaused(nextState, timerState.mode, remainingTime));
      }
    }
  };

  const restoreFromLastSetDuration = () => {
    setTimerState(runningOrPaused('paused', timerState.mode, restorePoint[timerState.mode].duration));
  };

  const handleJogKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (timerState.is === 'interacting' || timerState.is === 'finished') {
      // Prevent simultaneous interaction
      return;
    }

    const stepSize =
      timerState.mode === 'hours'
        ? {
            small: 1 * Minute,
            medium: 5 * Minutes,
            large: 1 * Hour,
          }
        : {
            small: 5 * Seconds,
            medium: 30 * Seconds,
            large: 5 * Minutes,
          };

    if (event.key === 'Enter' || event.key === ' ') {
      setTimerState(togglePaused(timerState));
      return;
    }

    let nextState: TimerState | null = null;
    switch (event.key) {
      case 'ArrowUp':
        nextState = changeTime(timerState.mode, timerState, event.shiftKey ? stepSize.large : stepSize.medium);
        break;
      case 'ArrowDown':
        nextState = changeTime(timerState.mode, timerState, event.shiftKey ? -stepSize.large : -stepSize.medium);
        break;
      case 'ArrowRight':
        nextState = changeTime(timerState.mode, timerState, event.shiftKey ? stepSize.medium : stepSize.small);
        break;
      case 'ArrowLeft':
        nextState = changeTime(timerState.mode, timerState, event.shiftKey ? -stepSize.medium : -stepSize.small);
        break;
    }
    if (nextState) {
      if (nextState.is === 'paused') {
        setRestorePoint({
          ...restorePoint,
          [timerState.mode]: { duration: nextState.remainingTime },
        });
      }
      setTimerState(nextState);
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

  const toggleTimerMode = () => {
    const nextMode = timerState.mode === 'hours' ? 'minutes' : 'hours';
    const fallbackDuration = restorePoint[nextMode].duration;
    setTimerState(changeMode(timerState, nextMode, fallbackDuration));
  };

  // Wheel gesture handler for adding/subtracting time
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (timerState.is === 'finished' || timerState.is === 'interacting') return;
      const delta = e.deltaY;
      const change =
        timerState.mode === 'hours'
          ? e.shiftKey
            ? 5 * Minutes
            : 30 * Seconds
          : e.shiftKey
            ? 30 * Seconds
            : 5 * Seconds;
      setTimerState(changeTime(timerState.mode, timerState, delta > 0 ? -change : change));
    },
    [setTimerState, timerState],
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
              'stroke-red-500 dark:stroke-red-500', // Tracks
              'text-gray-600 dark:text-gray-200', // Ticks
              'bg-white dark:bg-black', // Background
              'transform',
              timerState.is === 'interacting' && 'scale-[99.7%]',
            )}
            colorScheme={scheme.effective}
            initialTime={timerState.is === 'paused' ? timerState.remainingTime : 0}
            onClockRadiusChange={setClockRadius}
            mode={timerState.mode}
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
            'active:scale-98',
            'w-(--clock-diameter) h-(--clock-diameter) rounded-full',
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
              {timerState.is === 'paused' &&
                (timerState.remainingTime === 0 ? (
                  <>
                    <RotateCw className="inline transform -rotate-90" size="1em" />
                    <span className="sr-only">Stopped - click to restart</span>
                  </>
                ) : (
                  <>
                    <Pause className="inline" size="1em" />
                    <span className="sr-only">Paused - click to start</span>
                  </>
                ))}
            </span>
          </span>
        </JogDial>
      </div>

      <HelpScreen
        isHelpVisible={isHelpVisible}
        bgAction={timerState.is === 'running' ? 'controls' : null}
        jogDialAction={
          timerState.is === 'interacting'
            ? null
            : timerState.is === 'running'
              ? 'pause'
              : timerState.is === 'paused'
                ? timerState.remainingTime > 0
                  ? 'resume'
                  : 'reset'
                : null
        }
        onCloseClicked={() => {
          setIsHelpVisible(false);
          // Focus jog dial after help closes
          setTimeout(() => jogDial?.focus());
        }}
      />

      <Toolbar ariaLabel="Timer controls" isVisible={controlsAreVisible}>
        <ToolbarButton
          onClick={toggleTimerMode}
          aria-label={`Switch to ${timerState.mode === 'hours' ? 'minutes' : 'hours'} mode`}
          title={`Switch to ${timerState.mode === 'hours' ? 'minutes' : 'hours'} mode`}
          disabled={timerState.is !== 'paused'}
        >
          {timerState.mode === 'hours' ? <ClockFading size={24} /> : <TimerReset size={24} />}
        </ToolbarButton>

        <ToolbarButton
          onClick={restoreFromLastSetDuration}
          aria-label="Restore from last set duration"
          title="Reset"
          disabled={timerState.is !== 'paused'}
        >
          <RotateCw className="transform -rotate-45" size={24} />
        </ToolbarButton>
      </Toolbar>

      <Toolbar ariaLabel="Visual controls" isVisible={controlsAreVisible} position="bottom-right">
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
      </Toolbar>

      <Toolbar ariaLabel="Help etc." isVisible={controlsAreVisible} position="bottom-left">
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
