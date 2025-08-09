import * as math from '@thi.ng/math';
import clsx from 'clsx';
import {
  CircleCheck,
  ClockFading,
  Eraser,
  HelpCircle,
  Moon,
  RotateCw,
  Scan,
  Share2,
  Sun,
  SunMoon,
  TimerReset,
} from 'lucide-react';
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
  Seconds,
} from './time-utils';
import { TimerModelSchema } from './TimerModel';
import { TimerRestorePoint } from './TimerRestorePoint';
import {
  changeMode,
  changeTime,
  clampDuration,
  runningOrPaused,
  TimerState,
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

const DEFAULT_RESTORE_POINT: TimerRestorePoint = Object.freeze({
  minutes: Object.freeze({ duration: 5 * Seconds }),
  hours: Object.freeze({ duration: 10 * Minutes }),
});
const DEFAULT_STATE: TimerState = Object.freeze({
  is: 'paused',
  mode: 'hours',
  remainingTime: DEFAULT_RESTORE_POINT.hours.duration,
});

const SpiralTimer = () => {
  // Device capabilities
  const { isTouchDevice, hasKeyboard } = useDeviceCapabilities();
  const [timerModel, setTimerModel] = useLocalStorage('coil-timer-model', TimerModelSchema, {
    state: DEFAULT_STATE,
    restorePoint: DEFAULT_RESTORE_POINT,
  });
  const timerState = timerModel.state;
  const restorePoint = timerModel.restorePoint;
  const scheme = useColorScheme();

  const [srTimeEl, setSrTimeEl] = useState<HTMLElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [precision, setPrecision] = useState<string>('');
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [jogDial, setJogDial] = useState<HTMLButtonElement | null>(null);
  const [clockFace, setClockFace] = useState<ClockFaceHandle | null>(null);
  const [wasModeRecentlyChanged, setWasModeRecentlyChanged] = useTemporaryState(false, 2 * Seconds);
  const [wasRecentlySaved, setWasRecentlySaved] = useTemporaryState(false, 2 * Seconds);
  const [mustShowControls, setMustShowControls] = useTemporaryState(false, 5 * Seconds);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [clockRadius, setClockRadius] = useState<number | null>(null);

  useWakeLock({ enable: timerState.is === 'running' });

  const timerInteractionRef = useRef<TimerInteraction | null>(null);
  const isOrWas = 'was' in timerState ? timerState.was : timerState.is;

  const hasMounted = useRef(false);
  useEffect(() => {
    if (hasMounted.current) {
      setWasRecentlySaved(true);
    } else {
      hasMounted.current = true;
    }
  }, [restorePoint, setWasRecentlySaved]);

  useEffect(() => {
    setWasModeRecentlyChanged(true);
  }, [timerState.mode, setWasModeRecentlyChanged]);

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
        setTimerModel({ ...timerModel, state: toFinished(timerState) });
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'finished') {
      // Handle victory animation
      const deltaTime = 16.67; // Assume ~60 FPS, so ~16.67ms per frame

      const animationComplete = clockFace?.stepVictory(deltaTime) ?? false;
      remainingTime = 0;
      endTime = null;

      if (animationComplete) {
        setTimerModel({ ...timerModel, state: toPaused(timerState) });
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'paused') {
      endTime = timerState.remainingTime + Date.now();
      remainingTime = timerState.remainingTime;
    } else {
      throw new Error(`Unknown state: ${timerState}`);
    }

    clockFace?.draw(remainingTime);

    const roundedDuration = math.roundTo(remainingTime, timerState.mode === 'hours' ? Minutes : Seconds);

    if (timerState.mode === 'hours') {
      setPrecision(roundedDuration >= 1 * Hour ? 'h:min' : 'min');
    } else {
      setPrecision(roundedDuration >= 1 * Minute ? "min'sec" : 'sec');
    }

    if (srTimeEl && endTime != null) {
      if (timerState.mode === 'hours') {
        srTimeEl.textContent = `${formatDurationSr(roundedDuration)} (${formatTimeSr(endTime)})`;
      } else {
        srTimeEl.textContent = `${formatDurationMinutesSr(roundedDuration)} (${formatTimeSr(endTime)})`;
      }
    }

    if (timeEl) {
      if (timerState.mode === 'hours') {
        timeEl.textContent = zerosAsOs(formatDuration(roundedDuration));
      } else {
        timeEl.textContent = zerosAsOs(formatDurationMinutes(roundedDuration));
      }
    }

    if (endTimeEl && endTime != null) {
      endTimeEl.textContent = zerosAsOs(formatTime(endTime));
    }
  }, [timerState, clockFace, srTimeEl, timeEl, endTimeEl, timerModel, setTimerModel]);

  const fpsMap = timerState.mode === 'hours' ? FPS : MINUTES_MODE_FPS;
  useAnimation({ runFrame, fps: fpsMap[timerState.is] });

  // JogDial interaction handlers
  const handleJogStart = () => {
    if (timerState.is === 'interacting' || timerState.is === 'finished') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;

    timerInteractionRef.current = { remainingTime, hasChanged: false };
    setTimerModel({ ...timerModel, state: toInteracting(timerState) });
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
      const nextRestorePoint: TimerRestorePoint =
        timerState.was === 'paused' && remainingTime > 0
          ? { ...restorePoint, [timerState.mode]: { duration: newRemainingTime } }
          : restorePoint;
      const nextState = runningOrPaused(timerState.was, timerState.mode, newRemainingTime);
      setTimerModel({ ...timerModel, state: nextState, restorePoint: nextRestorePoint });
    } else {
      // If tapped, toggle between running and paused
      if (timerState.was === 'paused' && remainingTime === 0) {
        // Click happened after timer had finished
        setTimerModel({
          ...timerModel,
          state: runningOrPaused('paused', timerState.mode, restorePoint[timerState.mode].duration),
        });
      } else {
        const nextState = timerState.was === 'running' ? 'paused' : 'running';
        setTimerModel({ ...timerModel, state: runningOrPaused(nextState, timerState.mode, remainingTime) });
      }
    }
  };

  const restoreFromLastSetDuration = () => {
    if (timerState.is !== 'paused') return;
    setTimerModel({
      ...timerModel,
      state: runningOrPaused('paused', timerState.mode, restorePoint[timerState.mode].duration),
    });
  };

  const resetToDefault = () => {
    if (timerState.is !== 'paused') return;
    const mode = timerState.mode;
    const nextRestorePoint = { ...restorePoint, [mode]: DEFAULT_RESTORE_POINT[mode] };
    const nextState = runningOrPaused('paused', mode, DEFAULT_RESTORE_POINT[mode].duration);
    setTimerModel({ ...timerModel, restorePoint: nextRestorePoint, state: nextState });
  };

  const handleJogKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (timerState.is === 'interacting' || timerState.is === 'finished') {
      // Prevent simultaneous interaction
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      // Toggle between running and paused
      if (timerState.is === 'paused' && timerState.remainingTime === 0) {
        // Activated after timer had finished
        restoreFromLastSetDuration();
      } else {
        setTimerModel({ ...timerModel, state: togglePaused(timerState) });
      }

      return;
    }

    if (event.key === 'Escape') {
      restoreFromLastSetDuration();
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
      const nextRestorePoint =
        nextState.is === 'paused'
          ? { ...restorePoint, [timerState.mode]: { duration: nextState.remainingTime } }
          : restorePoint;
      setTimerModel({ ...timerModel, state: nextState, restorePoint: nextRestorePoint });
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
    if (timerState.is !== 'paused') return;
    const nextMode = timerState.mode === 'hours' ? 'minutes' : 'hours';
    const fallbackDuration = restorePoint[nextMode].duration;
    setTimerModel({ ...timerModel, state: changeMode(timerState, nextMode, fallbackDuration) });
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
      setTimerModel({ ...timerModel, state: changeTime(timerState.mode, timerState, delta > 0 ? -change : change) });
    },
    [setTimerModel, timerModel, timerState],
  );
  useNonPassiveWheelHandler(container, handleWheel);

  const handleShare = navigator.share
    ? () => {
        navigator.share({
          title: document.title,
          text: 'Distraction-free visual timer',
          url: window.location.href,
        });
      }
    : null;

  const controlsAreVisible = timerState.is === 'paused' || mustShowControls;
  const hint = timerState.is === 'interacting' ? 'end-time' : wasModeRecentlyChanged ? 'precision' : null;

  const resetBehavior =
    timerState.is !== 'paused'
      ? null
      : timerState.remainingTime !== restorePoint[timerState.mode].duration
        ? 'restore'
        : restorePoint[timerState.mode].duration !== DEFAULT_RESTORE_POINT[timerState.mode].duration
          ? 'reset-to-default'
          : null;

  return (
    <div
      ref={setContainer}
      className={clsx('h-screen overflow-hidden', 'text-white', 'flex flex-col items-center justify-center')}
      style={{ '--clock-diameter': `${(clockRadius ?? 100) * 2}px` } as React.CSSProperties}
      onClick={handleBackgroundClicks}
    >
      {/* Clock face */}
      <div className={clsx('w-[100vw] h-[100vh] relative', 'breathe-animation', 'transition-opacity')}>
        {scheme.effective && (
          <ClockFace
            ref={setClockFace}
            className={clsx(
              // These are queried by the clock face to theme the canvas
              'stroke-red-400 dark:stroke-red-500', // Tracks
              'decoration-gray-700 dark:decoration-white', // Track markers
              'text-gray-600 dark:text-gray-200', // Clock tick marks
              'fill-red-100 dark:fill-red-900', // Clock face background (when stopped)
              'bg-white dark:bg-black', // Background
              // 'transform',
              // timerState.is === 'interacting' && 'scale-[99.7%]',
            )}
            colorScheme={scheme.effective}
            initialTime={timerState.is === 'paused' ? timerState.remainingTime : 0}
            onClockRadiusChange={setClockRadius}
            mode={timerState.mode}
            isRunning={isOrWas === 'running'}
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
                'transition-opacity duration-500',
                hint === 'end-time' ? 'opacity-100 delay-2000' : 'opacity-0',
              )}
            >
              --
            </span>
          </span>
          <span className="block h-0 text-[calc(min(5vh,5vw))]">
            <span
              className={clsx(
                'font-sans font-light',
                'text-gray-500 dark:text-gray-400',
                'transition-opacity duration-500',
                hint === 'precision' ? 'opacity-100' : 'opacity-0 delay-2000',
              )}
            >
              {precision}
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

      <Toolbar ariaLabel="Timer controls" isVisible={controlsAreVisible && !isHelpVisible}>
        <ToolbarButton
          onClick={toggleTimerMode}
          aria-label={`Switch to ${timerState.mode === 'hours' ? 'minutes' : 'hours'} mode`}
          title={`Switch to ${timerState.mode === 'hours' ? 'minutes' : 'hours'} mode`}
          disabled={isOrWas !== 'paused'}
        >
          {timerState.mode === 'hours' ? <ClockFading size={24} /> : <TimerReset size={24} />}
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            if (resetBehavior === 'reset-to-default') resetToDefault();
            else if (resetBehavior === 'restore') restoreFromLastSetDuration();
            jogDial?.focus();
          }}
          aria-label={
            resetBehavior === 'reset-to-default' ? 'Reset to default duration' : 'Restore from last set duration'
          }
          title={resetBehavior === 'reset-to-default' ? 'Reset' : 'Restore last'}
          disabled={resetBehavior == null}
          highlight={wasRecentlySaved}
          className="relative"
        >
          {resetBehavior === 'reset-to-default' ? (
            <>
              <Eraser size={24} />
            </>
          ) : (
            <>
              <RotateCw className="transform -rotate-45" size={24} />
            </>
          )}
          <CircleCheck
            className={clsx(
              'absolute -top-1 -right-1',
              'text-blue-600 dark:text-blue-300 fill-white dark:fill-black',
              'transition-all duration-200',
              wasRecentlySaved ? 'opacity-100' : 'opacity-0',
            )}
            size={16}
            strokeWidth={(2 * 24) / 16}
          />
        </ToolbarButton>
      </Toolbar>

      <Toolbar ariaLabel="Visual controls" isVisible={controlsAreVisible && !isHelpVisible} position="bottom-right">
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

      <Toolbar ariaLabel="Help etc." isVisible={controlsAreVisible && !isHelpVisible} position="bottom-left">
        <ToolbarButton
          onClick={() => setIsHelpVisible(true)}
          aria-label={isHelpVisible ? 'Hide instructions' : 'Show instructions'}
          title="Help"
        >
          <HelpCircle size={24} />
        </ToolbarButton>

        {handleShare && (
          <ToolbarButton onClick={handleShare} aria-label="Share this app" title="Share">
            <Share2 size={24} />
          </ToolbarButton>
        )}
      </Toolbar>
    </div>
  );
};

export default SpiralTimer;

const zerosAsOs = (text: string) => text.replaceAll('0', 'O');
