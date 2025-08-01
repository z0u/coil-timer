import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { JogDial, JogEvent } from './JogDial';
import { formatDuration, formatTime, Hour, Hours, Minutes, Second, Seconds } from './time-utils';
import { TimerState } from './TimerState';
import { useAnimation } from './useAnimation';
import { useDrawClockFace } from './useDrawClockFace';
import { usePersistentTimerState } from './usePersistentTimerState';
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
  const [timerState, setTimerState] = usePersistentTimerState();

  const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useWakeLock({ enable: timerState.is === 'running' });

  const timerInteractionRef = useRef<TimerInteraction | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const manualControlsOverride = useRef<boolean | null>(null);

  const isOrWas = 'was' in timerState ? timerState.was : timerState.is;

  // Show/hide controls based on timer state
  useEffect(() => {
    manualControlsOverride.current = null; // Reset on state change
    if (timerState.is === 'running') {
      controlsTimeoutRef.current = setTimeout(() => {
        if (manualControlsOverride.current === null) {
          setShowControls(false);
        }
      }, OVERLAY_TIMEOUT);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [timerState.is]);

  const { drawClockFace, clockRadius } = useDrawClockFace({ canvas });

  const runFrame = useCallback(() => {
    let remainingTime: number;
    let endTime: number;

    if (timerState.is === 'interacting') {
      remainingTime = timerInteractionRef.current!.remainingTime;
      endTime = remainingTime + Date.now();
    } else if (timerState.is === 'running') {
      endTime = timerState.endTime;
      remainingTime = timerState.endTime - Date.now();
      if (remainingTime <= 0) {
        setTimerState({ is: 'paused', remainingTime: 0 });
        return; // State change will re-run the effect.
      }
    } else if (timerState.is === 'paused') {
      endTime = timerState.remainingTime + Date.now();
      remainingTime = timerState.remainingTime;
    } else {
      throw new Error(`Unknown state: ${timerState}`);
    }

    drawClockFace(remainingTime);
    if (timeEl) timeEl.textContent = formatDuration(math.roundTo(remainingTime, Minutes));
    if (endTimeEl) endTimeEl.textContent = formatTime(endTime);
  }, [timeEl, endTimeEl, timerState, drawClockFace]);

  useAnimation({ runFrame, fps: FPS[timerState.is] });

  // JogDial interaction handlers
  const handleJogStart = () => {
    if (timerState.is === 'interacting') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;

    timerInteractionRef.current = { remainingTime, hasChanged: false };
    setTimerState({ is: 'interacting', was: timerState.is, remainingTime });
  };

  const handleJogMove = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const deltaTime = (event.deltaAngle / math.TAU) * 1 * Hour;
    const newDuration = math.clamp(timerInteractionRef.current.remainingTime + deltaTime, 0, 24 * Hours);
    timerInteractionRef.current.remainingTime = newDuration;
    timerInteractionRef.current.hasChanged = event.wasDragged; // wasDragged indicates drag threshold was reached
  };

  const handleJogEnd = (event: JogEvent) => {
    if (timerState.is !== 'interacting' || !timerInteractionRef.current) return;

    const { remainingTime } = timerInteractionRef.current;
    let nextState: 'running' | 'paused';
    let newRemainingTime: number;

    if (event.wasDragged) {
      // If dragged, round to the nearest minute and resume previous state
      nextState = timerState.was;
      newRemainingTime = math.roundTo(remainingTime, Minutes);
    } else {
      // If tapped, toggle between running and paused
      nextState = timerState.was === 'running' ? 'paused' : 'running';
      newRemainingTime = remainingTime;
    }

    if (newRemainingTime <= 0) {
      nextState = 'paused';
      newRemainingTime = 0;
    }

    if (nextState === 'running') {
      setTimerState({ is: 'running', endTime: Date.now() + newRemainingTime });
    } else {
      setTimerState({ is: 'paused', remainingTime: newRemainingTime });
    }
  };

  // Click/double-click logic
  const clickTimeoutRef = useRef<number | null>(null);
  const handleBackgroundClick = () => {
    // Delay single-click action to see if double-click occurs
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      const newShowControls = !showControls;
      setShowControls(newShowControls);
      manualControlsOverride.current = newShowControls;

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }

      if (timerState.is === 'running' && newShowControls) {
        controlsTimeoutRef.current = setTimeout(() => {
          // If we haven't manually hidden it again, auto-hide
          if (manualControlsOverride.current) {
            setShowControls(false);
            manualControlsOverride.current = null;
          }
        }, OVERLAY_TIMEOUT);
      }
      clickTimeoutRef.current = null;
    }, 250); // 250ms delay for double-click detection
  };

  const handleBackgroundDoubleClick = () => {
    // Cancel pending single-click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    toggleFullscreen();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  };

  // Wheel gesture handler for adding/subtracting time
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const delta = e.deltaY;
      // 1 minute per notch, invert for natural scroll
      const change = (delta > 0 ? -30 : 30) * Seconds;
      if (timerState.is === 'paused') {
        const newTime = Math.max(0, timerState.remainingTime + change);
        setTimerState({ ...timerState, remainingTime: newTime });
      } else if (timerState.is === 'running') {
        const remaining = timerState.endTime - Date.now();
        const newRemaining = Math.max(0, remaining + change);
        if (newRemaining <= 0) {
          setTimerState({ is: 'paused', remainingTime: 0 });
        } else {
          setTimerState({ is: 'running', endTime: Date.now() + newRemaining });
        }
      } else if (timerState.is === 'interacting') {
        // Do nothing: already dragging
        setTimerState({ ...timerState });
      }
    },
    [timerState],
  );

  // Attach non-passive wheel event listener to prevent scroll
  useEffect(() => {
    if (!container) return;
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      handleWheel(e);
    };
    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      container.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel, container]);

  return (
    <div
      ref={setContainer}
      className={clsx('h-screen overflow-hidden', 'bg-black text-white', 'flex flex-col items-center justify-center')}
      style={{ '--clock-diameter': `${(clockRadius ?? 100) * 2}px` } as React.CSSProperties}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      <canvas ref={setCanvas} className={clsx('w-full h-full', 'breathe-animation')} />

      <JogDial
        aria-label={
          isOrWas === 'paused'
            ? 'Timer control: tap to start, drag to adjust time'
            : 'Timer control: tap to pause, drag to adjust time'
        }
        title="Timer control"
        className={clsx(
          'absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2',
          'w-(--clock-diameter) h-(--clock-diameter) breathe-animation rounded-full',
          'flex-col items-center justify-center',
          'leading-none font-[Inconsolata,monospace] ',
          'text-gray-300 text-shadow-lg/30',
          'transition-opacity duration-500',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
        onJogStart={handleJogStart}
        onJogMove={handleJogMove}
        onJogEnd={handleJogEnd}
      >
        <span className="flex items-center justify-center text-[calc(min(10vh,10vw))]">
          <span ref={setTimeEl} aria-live="polite" aria-atomic="true" />
          <span className="inline-block w-0 flex items-baseline">
            <AnimatedColon isRunning={timerState.is === 'running'} />
          </span>
        </span>
        <span className="block h-0 text-[calc(min(5vh,5vw))]">
          <span
            ref={setEndTimeEl}
            className={clsx(
              'relative',
              'before:absolute before:block before:left-0',
              'before:transform before:-translate-x-[100%] before:px-[1ex]',
              'before:content-["⇥"]',
              'text-gray-400 before:text-gray-600',
              'transition-opacity duration-500 delay-2000',
              // timerState.is === 'interacting' ? 'opacity-100' : 'opacity-0',
            )}
          >
            --
          </span>
        </span>
      </JogDial>

      <button
        aria-label={document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}
        title="Fullscreen"
        className={clsx(
          'absolute top-6 right-6 ',
          'cursor-pointer text-gray-400',
          'transition-opacity duration-500',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
        onClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
      >
        <Scan size={24} />
      </button>
    </div>
  );
};

export default SpiralTimer;
