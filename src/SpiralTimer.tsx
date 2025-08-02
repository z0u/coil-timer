import * as math from '@thi.ng/math';
import clsx from 'clsx';
import { Ellipsis, GitMerge, HelpCircle, Scan, X } from 'lucide-react';
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { ClockFace, ClockFaceHandle } from './ClockFace';
import { HelpScreen } from './HelpScreen';
import { JogDial, JogEvent } from './JogDial';
import { formatDuration, formatTime, Hour, Hours, Milliseconds, Minute, Minutes, Second, Seconds } from './time-utils';
import { TimerState } from './TimerState';
import { ToggleButton } from './ToggleButton';
import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';
import { useAnimation } from './useAnimation';
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

  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [endTimeEl, setEndTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [jogDial, setJogDial] = useState<HTMLButtonElement | null>(null);
  const [clockFace, setClockFace] = useState<ClockFaceHandle | null>(null);
  const [isActive, setIsActive] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [mustShowControls, setMustShowControls] = useTemporaryState(false, OVERLAY_TIMEOUT);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
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
        setTimerState({ is: 'running', endTime: Date.now() + newRemainingTime });
      } else {
        setTimerState({ is: 'paused', remainingTime: newRemainingTime });
      }
    },
    [setTimerState],
  );

  const toggleRunningOrPaused = useCallback(() => {
    if (timerState.is === 'interacting') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;
    const nextState = timerState.is === 'running' ? 'paused' : 'running';
    setRunningOrPaused(nextState, remainingTime);
  }, [timerState, setRunningOrPaused]);

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

    if (clockFace) clockFace.setTime(remainingTime);
    if (timeEl) timeEl.textContent = formatDuration(math.roundTo(remainingTime, Minutes));
    if (endTimeEl) endTimeEl.textContent = formatTime(endTime);
  }, [timeEl, endTimeEl, timerState, setTimerState]);

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

      setRunningOrPaused(timerState.is, newRemainingTime);
    },
    [timerState, setTimerState, setRunningOrPaused],
  );

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
      setRunningOrPaused(timerState.was, newRemainingTime);
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

    setIsActive(true);
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
      const change = e.shiftKey ? 5 * Minutes : 30 * Seconds;
      addTime(delta > 0 ? -change : change);
    },
    [addTime, setIsActive],
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
        <ClockFace
          ref={setClockFace}
          initialTime={timerState.is === 'paused' ? timerState.remainingTime : 0}
          onClockRadiusChange={setClockRadius}
        />
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
            'text-gray-300 text-shadow-lg/30',
            'transition-opacity duration-500',
            controlsAreVisible ? 'opacity-100' : 'opacity-0',
          )}
          onJogStart={handleJogStart}
          onJogMove={handleJogMove}
          onJogEnd={handleJogEnd}
          onKeyDown={handleJogKey}
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
      <Toolbar
        isVisible={controlsAreVisible}
        isOpen={isMenuVisible}
        onToggle={() => setIsMenuVisible((visible) => !visible)}
        trigger={
          <ToggleButton
            isToggled={isMenuVisible}
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
          onClick={toggleFullscreen}
        >
          <Scan size={24} />
        </ToolbarButton>

        <ToolbarButton href="https://github.com/z0u/coil-timer" aria-label="Source code on GitHub" title="Source code">
          <GitMerge size={24} />
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
