import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { Ellipsis, GitMerge, HelpCircle, Scan, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { JogDial, JogEvent } from './JogDial';
import { ToggleButton } from './ToggleButton';
import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';
import { formatDuration, formatTime, Hour, Hours, Milliseconds, Minutes, Second, Seconds } from './time-utils';
import { TimerState } from './TimerState';
import { useAnimation } from './useAnimation';
import { useDrawClockFace } from './useDrawClockFace';
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
  const [timerState, setTimerState] = usePersistentTimerState();

  // const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [mustShowControls, setMustShowControls] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);

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
      e.preventDefault();
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
  useNonPassiveWheelHandler(container, handleWheel);

  const controlsAreVisible = timerState.is === 'paused' || mustShowControls;
  const isDimmed = !isHelpVisible && timerState.is === 'paused' && !isActive;

  return (
    <div
      ref={setContainer}
      className={clsx('h-screen overflow-hidden', 'text-white', 'flex flex-col items-center justify-center')}
      style={{ '--clock-diameter': `${(clockRadius ?? 100) * 2}px` } as React.CSSProperties}
      onClick={handleBackgroundClicks}
    >
      {/* Clock face */}
      <div
        className={clsx(
          'w-full h-full',
          'breathe-animation',
          'transition-opacity',
          isDimmed ? 'opacity-30 delay-5000 duration-2000' : 'opacity-100 duration-1000',
        )}
      >
        <canvas ref={setCanvas} className={clsx('w-full h-full')} />
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
      </div>

      <div
        className={clsx(
          'absolute inset-0',
          'text-white text-shadow-lg/30',
          'transition-all duration-500',
          isHelpVisible ? 'opacity-100 backdrop-blur-xs' : 'opacity-0 backdrop-blur-[0]',
          'pointer-events-none',
        )}
      >
        {/* Help for clock face */}
        <div
          className={clsx(
            'absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2',
            'w-(--clock-diameter) h-(--clock-diameter) breathe-animation rounded-full',
            'flex flex-col items-center justify-center',
            'text-white text-shadow-lg/30',
          )}
        >
          <div>
            <h2 className="text-lg text-gray-300 mb-2">Clock face</h2>
            <ul>
              <li>
                <strong>Tap:</strong> resume
              </li>
              <li>
                <strong>Hold:</strong> show end time
              </li>
              <li>
                <strong>Swipe:</strong> set time
              </li>
            </ul>
          </div>
        </div>
        {/* Help for background */}
        <div className={clsx('absolute top-6 left-6', 'text-white text-shadow-lg/30')}>
          <h2 className="text-lg text-gray-300 mb-2">Background</h2>
          <ul>
            <li>
              <strong>Tap:</strong> show/hide controls
            </li>
            <li>
              <strong>Tap-tap:</strong> enter fullscreen
            </li>
            <li>
              <strong>Scroll:</strong> set time
            </li>
          </ul>
          <p className="text-sm mt-2">Full-screen mode hides the phone status bar.</p>
        </div>
      </div>

      {/* Toolbar top */}
      <Toolbar
        isVisible={controlsAreVisible}
        isOpen={isMenuVisible}
        onToggle={() => setIsMenuVisible((visible) => !visible)}
        trigger={
          <ToggleButton
            isToggled={isMenuVisible}
            isVisible={!isHelpVisible}
            onToggle={() => setIsMenuVisible((visible) => !visible)}
            aria-label={isMenuVisible ? 'Hide menu' : 'Show menu'}
            title="Menu"
            defaultIcon={<Ellipsis size={24} />}
            toggledIcon={<X size={24} />}
          />
        }
      >
        <ToolbarButton
          aria-label={document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}
          title="Fullscreen"
          isVisible={isHelpVisible ? false : null}
          onClick={toggleFullscreen}
        >
          <Scan size={24} />
        </ToolbarButton>

        <ToolbarButton
          href="https://github.com/z0u/coil-timer"
          aria-label="Source code on GitHub"
          title="Source code"
          isVisible={isHelpVisible ? false : null}
        >
          <GitMerge size={24} />
        </ToolbarButton>

        <ToggleButton
          isToggled={isHelpVisible}
          onToggle={() => setIsHelpVisible((value) => !value)}
          aria-label={isHelpVisible ? 'Hide instructions' : 'Show instructions'}
          title="Help"
          defaultIcon={<HelpCircle size={24} />}
          toggledIcon={<X size={24} />}
        />
      </Toolbar>
    </div>
  );
};

export default SpiralTimer;
