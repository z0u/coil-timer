import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { JogDial, JogEvent } from './JogDial';
import { Hour, Hours, Minutes, Second, Seconds } from './time-utils';
import { useDrawClockFace } from './useDrawClockFace';
import { usePersistentTimerState } from './usePersistentTimerState';
import { useVisibility } from './useVisibility';
import { useWakeLock } from './useWakeLock';

// Interaction state for timer duration adjustments
interface TimerInteraction {
  remainingTime: number;
  hasChanged: boolean;
}

const OVERLAY_TIMEOUT = 5 * Second;
const RUNNING_FPS = 1;
const MAX_FPS = 30;

const SpiralTimer = () => {
  const [timerState, setTimerState] = usePersistentTimerState();

  const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const visible = useVisibility();
  useWakeLock({ enable: timerState.is === 'running' });

  const animationFrameRef = useRef<number>(0);
  const timerInteractionRef = useRef<TimerInteraction | null>(null);
  const lastInteractionTimeRef = useRef<number>(0);
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

  // Main animation loop
  useEffect(() => {
    let lastFrameTime = 0;
    const animate = (t: number) => {
      const now = Date.now();
      const timeSinceLastInteraction = now - lastInteractionTimeRef.current;
      const highFrameRateOverride = timeSinceLastInteraction < 5000;

      // Stop condition: paused and the 5s grace period is over.
      if (timerState.is === 'paused' && !highFrameRateOverride) {
        // Ensure we only perform the final draw once and then stop.
        if (animationFrameRef.current) {
          drawClockFace(timerState.remainingTime);
          if (timeEl) timeEl.textContent = formatDuration(timerState.remainingTime);
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        }
        return;
      }

      // Throttle condition: running, but not interacting or in the grace period.
      const fps = timerState.is === 'interacting' || highFrameRateOverride ? MAX_FPS : RUNNING_FPS;

      const frameInterval = (1 * Second) / fps;
      if (t - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return; // Skip this frame.
      }
      lastFrameTime = t;

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
      } else {
        // Paused, but still in the high-frame-rate grace period.
        endTime = timerState.remainingTime + Date.now();
        remainingTime = timerState.remainingTime;
      }

      drawClockFace(remainingTime);
      if (timeEl) timeEl.textContent = formatDuration(math.roundTo(remainingTime, Minutes));
      if (endTimeEl) endTimeEl.textContent = formatTime(endTime);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop.
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup function.
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };
  }, [timeEl, endTimeEl, timerState, drawClockFace, visible]);

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
    lastInteractionTimeRef.current = Date.now();

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

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
      }
      lastInteractionTimeRef.current = Date.now();
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
