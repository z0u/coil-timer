import clsx from 'clsx';
import { Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedColon } from './AnimatedColon';
import { min_to_ms, sec_to_ms } from './time-utils';
import { usePersistentTimerState } from './use-persistent-timer-state';
import { useVisibility } from './use-visibility';
import { useWakeLock } from './use-wake-lock';
import { useWindowSize } from './use-window-size';

// Interaction state (using useRef to avoid re-renders on every move)
interface Interaction {
  timeWasChanged: boolean;
  pointerPos: { x: number; y: number };
  remainingTime: number;
}

const CLOCK_DIAMETER = 0.8; // min(vh, vw)
const TRACK_SPACING = 0.035; // min(vh, vw)
const TRACK_WIDTH = 0.015; // min(vh, vw)

const TICK_OUTER_DIA = 0.9;
const MAJOR_TICK_LENGTH = 0.014;
const MAJOR_TICK_WIDTH = 0.012;
const MINOR_TICK_LENGTH = 0.008;
const MINOR_TICK_WIDTH = 0.008;

const TAP_DRAG_TOLERANCE = 12; // px
const OVERLAY_TIMEOUT = sec_to_ms(5); // ms
const RUNNING_FPS = 1;
const MAX_FPS = 30;

const SpiralTimer = () => {
  const [timerState, setTimerState] = usePersistentTimerState();

  const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const windowSize = useWindowSize();
  const visible = useVisibility();
  useWakeLock({ enable: timerState.is === 'running' });

  const animationFrameRef = useRef<number>(0);
  const interactionRef = useRef<Interaction | null>(null);
  const lastInteractionTimeRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<number | null>(null);
  const manualControlsOverride = useRef<boolean | null>(null);

  const diameter = Math.min(windowSize.width, windowSize.height) * CLOCK_DIAMETER;
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

  // Canvas drawing logic
  const drawSpiral = useCallback(
    (timeToDraw: number) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Resize canvas if needed
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      const hours = timeToDraw / (60 * 60 * 1000);
      const screenDiameter = Math.min(width, height);
      const baseRadius = (screenDiameter * CLOCK_DIAMETER) / 2;
      const trackSpacing = screenDiameter * TRACK_SPACING;
      const totalRevolutions = Math.max(1, Math.ceil(hours));
      const tracks = getTracks(totalRevolutions, baseRadius, trackSpacing, timeToDraw);

      const centerX = width / 2;
      const centerY = height / 2;

      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;

      // Draw clock ticks
      if (tracks.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        const tickOuterRadius = (TICK_OUTER_DIA * screenDiameter) / 2;
        const majorTickLength = MAJOR_TICK_LENGTH * screenDiameter;
        const majorTickWidth = MAJOR_TICK_WIDTH * screenDiameter;
        const minorTickLength = MINOR_TICK_LENGTH * screenDiameter;
        const minorTickWidth = MINOR_TICK_WIDTH * screenDiameter;

        for (let i = 0; i < 12; i++) {
          const angle = i * (Math.PI / 6) - Math.PI / 2; // Start from top
          const isMajor = i % 3 === 0;
          const tickLength = isMajor ? majorTickLength : minorTickLength;
          const startRadius = tickOuterRadius - tickLength;

          const startX = centerX + startRadius * Math.cos(angle);
          const startY = centerY + startRadius * Math.sin(angle);
          const endX = centerX + tickOuterRadius * Math.cos(angle);
          const endY = centerY + tickOuterRadius * Math.sin(angle);

          let angleDiff = Math.abs(finalTrack.endAngle - angle);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          const degreesDiff = (angleDiff * 180) / Math.PI;
          const proximity = Math.max(0, 0.9 * (1 - degreesDiff / 35));

          ctx.globalAlpha = proximity;
          ctx.lineWidth = isMajor ? majorTickWidth : minorTickWidth;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineCap = 'round';

      // Draw faint tracks as complete circles
      ctx.globalAlpha = 0.2;
      {
        const { thickness, radius } = finalTrack;
        ctx.lineWidth = (TRACK_WIDTH * screenDiameter * thickness) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw revolutions
      ctx.globalAlpha = 1.0;
      for (const { thickness, radius, endAngle } of tracks) {
        ctx.lineWidth = TRACK_WIDTH * screenDiameter * thickness;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
        ctx.stroke();
      }

      ctx.restore();
    },
    [canvas],
  );

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
          drawSpiral(timerState.remainingTime);
          if (timeEl) timeEl.textContent = formatTime(timerState.remainingTime);
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        }
        return;
      }

      // Throttle condition: running, but not interacting or in the grace period.
      const fps = timerState.is === 'interacting' || highFrameRateOverride ? MAX_FPS : RUNNING_FPS;

      const frameInterval = 1000 / fps;
      if (t - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return; // Skip this frame.
      }
      lastFrameTime = t;

      let newDisplayTime: number;

      if (timerState.is === 'interacting') {
        newDisplayTime = interactionRef.current!.remainingTime;
      } else if (timerState.is === 'running') {
        const remaining = timerState.endTime - Date.now();
        if (remaining <= 0) {
          setTimerState({ is: 'paused', remainingTime: 0 });
          return; // State change will re-run the effect.
        }
        newDisplayTime = remaining;
      } else {
        // Paused, but still in the high-frame-rate grace period.
        newDisplayTime = timerState.remainingTime;
      }

      drawSpiral(newDisplayTime);
      if (timeEl) {
        timeEl.textContent = formatTime(newDisplayTime);
      }

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
  }, [timeEl, timerState, drawSpiral, windowSize, visible]);

  // Touch/mouse handling
  const getAngleFromPoint = (pos: { x: number; y: number }) => {
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
  };

  const pointerDown = (pos: { x: number; y: number }) => {
    if (timerState.is === 'interacting') return;
    const remainingTime = timerState.is === 'running' ? timerState.endTime - Date.now() : timerState.remainingTime;

    interactionRef.current = {
      timeWasChanged: false,
      pointerPos: pos,
      remainingTime,
    };
    setTimerState({ is: 'interacting', was: timerState.is, remainingTime });
  };

  const pointerMove = (pos: { x: number; y: number }) => {
    if (timerState.is !== 'interacting') return;
    const interaction = interactionRef.current!;

    const lastPos = interaction.pointerPos;
    const dist = Math.sqrt((pos.x - lastPos.x) ** 2 + (pos.y - lastPos.y) ** 2);

    if (!interaction.timeWasChanged && dist > TAP_DRAG_TOLERANCE) {
      interaction.timeWasChanged = true;
    }

    if (interaction.timeWasChanged) {
      const lastAngle = getAngleFromPoint(lastPos);
      const currentAngle = getAngleFromPoint(pos);
      let deltaAngle = currentAngle - lastAngle;

      if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;

      const deltaTime = (deltaAngle / (2 * Math.PI)) * min_to_ms(60);
      const newDuration = Math.max(0, interaction.remainingTime + deltaTime);

      interaction.remainingTime = newDuration;
      interaction.pointerPos = pos;
    }
  };

  const pointerUp = () => {
    if (timerState.is !== 'interacting') return;
    const interaction = interactionRef.current!;
    lastInteractionTimeRef.current = Date.now();

    let nextState: 'running' | 'paused';
    let newRemainingTime: number;

    if (interaction.timeWasChanged) {
      nextState = timerState.was;
      newRemainingTime = ceilMinutes(interaction.remainingTime);
    } else {
      // Tap gesture: toggle play/pause
      nextState = timerState.was === 'running' ? 'paused' : 'running';
      newRemainingTime = interaction.remainingTime;
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

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes}`;
  };

  // Wheel gesture handler for adding/subtracting time
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const delta = e.deltaY;
      // 1 minute per notch, invert for natural scroll
      const change = delta > 0 ? min_to_ms(-0.5) : min_to_ms(0.5);
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
      style={{ '--clock-diameter': `${diameter}px` } as React.CSSProperties}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      <canvas ref={setCanvas} className={clsx('w-full h-full', 'breathe-animation')} />

      <button
        aria-label={
          isOrWas === 'paused'
            ? 'Timer control: tap to start, drag to adjust time'
            : 'Timer control: tap to pause, drag to adjust time'
        }
        title="Timer control"
        className={clsx(
          'absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2',
          'block w-(--clock-diameter) h-(--clock-diameter) breathe-animation rounded-full',
          'cursor-pointer',
          'touch-none', // Prevent reload on drag on mobile
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
          pointerDown({ x: e.clientX, y: e.clientY });
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          pointerMove({ x: e.clientX, y: e.clientY });
        }}
        onLostPointerCapture={(e) => {
          e.stopPropagation();
          pointerUp();
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }}
        onClick={(e) => e.stopPropagation()}
      ></button>

      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ease-in-out z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute top-6 right-6 pointer-events-auto">
          <button
            aria-label={document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen"
            className="cursor-pointer text-gray-400"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
          >
            <Scan size={24} />
          </button>
        </div>

        <div className="absolute top-[50vh] left-[50vw] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[calc(min(10vh,10vw))] text-gray-300 text-shadow-lg/30 flex items-baseline leading-none font-[Inconsolata,monospace]">
          <span ref={setTimeEl} aria-live="polite" aria-atomic="true" />
          <span className="inline-block w-0 flex items-baseline">
            <AnimatedColon isRunning={timerState.is === 'running'} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpiralTimer;

const ceilMinutes = (duration: number, minutes: number = 1): number =>
  Math.ceil(duration / min_to_ms(minutes)) * min_to_ms(minutes);

type Track = {
  rev: number;
  thickness: number;
  radius: number;
  endAngle: number;
};

const getTracks = (totalRevolutions: number, baseRadius: number, radiusSpacing: number, timeToDraw: number) => {
  const tracks: Track[] = [];
  for (let rev = 0; rev < totalRevolutions; rev++) {
    const thickness = (1 - rev / 12) ** 0.8;
    const radius = baseRadius - rev ** 0.93 * radiusSpacing;
    if (radius <= 0) continue;

    const revolutionStart = rev * 60 * 60 * 1000;
    const revolutionEnd = (rev + 1) * 60 * 60 * 1000;

    let revolutionTime: number;
    if (timeToDraw >= revolutionEnd) {
      revolutionTime = min_to_ms(60);
    } else if (timeToDraw > revolutionStart) {
      revolutionTime = timeToDraw - revolutionStart;
    } else {
      continue;
    }

    const endAngle = (revolutionTime / min_to_ms(60)) * 2 * Math.PI - Math.PI / 2;

    tracks.push({ rev, thickness, radius, endAngle });
  }
  return tracks;
};
