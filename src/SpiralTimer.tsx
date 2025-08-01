import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { JogDial, JogEvent } from './JogDial';
import { formatDuration, formatTime, Hour, Hours, Milliseconds, Minutes, Second, Seconds } from './time-utils';
import { TimerState } from './TimerState';
import { useAnimation } from './useAnimation';
import { useDrawClockFace } from './useDrawClockFace';
import { useMultiClick } from './useMultiClick';
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
  const [timerState, setTimerState] = usePersistentTimerState();

  // const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [mustShowControls, setMustShowControls] = useTemporaryState(false, OVERLAY_TIMEOUT);

  useWakeLock({ enable: timerState.is === 'running' });

  const timerInteractionRef = useRef<TimerInteraction | null>(null);

  const isOrWas = 'was' in timerState ? timerState.was : timerState.is;

  useEffect(() => {
    setMustShowControls(true);
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

  const handleBackgroundClicks = useMultiClick({
    indeterminate: () => setIsActive(true),
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

  // Wheel gesture handler for adding/subtracting time
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      setIsActive(true);
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

  const controlsAreVisible = timerState.is === 'paused' || mustShowControls;

  return (
    <div
      ref={setContainer}
      className={clsx(
        'h-screen overflow-hidden',
        'text-white',
        'flex flex-col items-center justify-center',
        'transition-opacity',
        timerState.is === 'paused' && !isActive ? 'opacity-30 delay-5000 duration-2000' : 'opacity-100 duration-300',
      )}
      style={{ '--clock-diameter': `${(clockRadius ?? 100) * 2}px` } as React.CSSProperties}
      onClick={handleBackgroundClicks}
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
          controlsAreVisible ? 'opacity-100' : 'opacity-0',
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
              'text-gray-400 before:text-gray-600',
              'transition-opacity duration-500 delay-2000',
              timerState.is === 'interacting' ? 'opacity-100' : 'opacity-0',
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
          controlsAreVisible ? 'opacity-100' : 'opacity-0',
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
