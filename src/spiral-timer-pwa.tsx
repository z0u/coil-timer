import { Pause, Play, Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWakeLock } from './use-wake-lock';
import { useWindowSize } from './use-window-size';

// State definitions
interface Running {
  is: 'running';
  endTime: number;
}

interface Paused {
  is: 'paused';
  remainingTime: number;
}

interface Interacting {
  is: 'interacting';
  was: 'running' | 'paused';
  remainingTime: number;
}

type TimerState = Running | Paused | Interacting;

// Interaction state (using useRef to avoid re-renders on every move)
interface Interaction {
  timeWasChanged: boolean;
  pointerPos: { x: number; y: number };
  remainingTime: number;
}

const sec_to_ms = (s: number): number => s * 1000;
const min_to_ms = (m: number): number => sec_to_ms(m * 60);

const TAP_DRAG_TOLERANCE = 12; // px
const OVERLAY_TIMEOUT = sec_to_ms(5); // ms
const RUNNING_FPS = 1;
const MAX_FPS = 30;

const SpiralTimer = () => {
  const [timerState, setTimerState] = useState<TimerState>({
    is: 'paused',
    remainingTime: min_to_ms(10),
  });

  const [showControls, setShowControls] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [timeEl, setTimeEl] = useState<HTMLElement | null>(null);

  const windowSize = useWindowSize();
  useWakeLock({ enable: timerState.is === 'running' });

  const animationFrameRef = useRef<number>(0);
  const interactionRef = useRef<Interaction | null>(null);
  const lastInteractionTimeRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Show/hide controls based on timer state
  useEffect(() => {
    if (timerState.is === 'running') {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), OVERLAY_TIMEOUT);
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
      const baseRadius = Math.min(width, height) * 0.3;
      const radiusSpacing = 25;
      const totalRevolutions = Math.max(1, Math.ceil(hours));
      const tracks = getTracks(totalRevolutions, baseRadius, radiusSpacing, timeToDraw);

      const centerX = width / 2;
      const centerY = height / 2;

      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;

      // Draw clock ticks
      if (tracks.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#a1a1aa'; // zinc-400
        ctx.lineCap = 'round';
        const tickOuterRadius = tracks[0].radius + 40;
        const majorTickLength = 20;
        const minorTickLength = 10;

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
          const proximity = Math.max(0, 0.5 * (1 - degreesDiff / 30));

          ctx.globalAlpha = proximity;
          ctx.lineWidth = isMajor ? 8 : 6;
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
        ctx.lineWidth = 4 * thickness;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw revolutions
      ctx.globalAlpha = 1.0;
      for (const { thickness, radius, endAngle } of tracks) {
        ctx.lineWidth = 8 * thickness;
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
  }, [timeEl, timerState, drawSpiral, windowSize]);

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

    interactionRef.current = null;
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
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden breathe-animation">
      <canvas
        ref={setCanvas}
        className="w-full h-full cursor-pointer"
        onMouseDown={(e) => pointerDown({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => pointerMove({ x: e.clientX, y: e.clientY })}
        onMouseUp={pointerUp}
        onMouseLeave={pointerUp}
        onTouchStart={(e) => {
          e.preventDefault();
          pointerDown({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          pointerMove({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          pointerUp();
        }}
      />

      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ease-in-out z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute top-6 right-6 pointer-events-auto">
          <button
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
          >
            <Scan size={24} />
          </button>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div ref={setTimeEl} className="text-2xl font-mono text-gray-300" />
        </div>

        <div
          className={`absolute bottom-10 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-opacity duration-500 ease-in-out ${timerState.is === 'paused' ? 'opacity-100' : 'opacity-0'}`}
        >
          <Pause size={24} />
        </div>
        <div
          className={`absolute bottom-10 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-opacity duration-500 ease-in-out ${timerState.is === 'running' || (timerState.is === 'interacting' && timerState.was === 'running') ? 'opacity-100' : 'opacity-0'}`}
        >
          <Play color="currentColor" size={24} />
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
    const thickness = (1 - rev / 12) ** 0.25;
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
