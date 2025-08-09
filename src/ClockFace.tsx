import * as math from '@thi.ng/math';
import * as v from '@thi.ng/vectors';
import clsx from 'clsx';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Hours, Minutes, Second } from './time-utils';
import { TimerMode } from './TimerState';

// These constants are in normalized device coordinates (fractions of min(vh, vw))
const CLOCK_DIAMETER = 0.8;
const TRACK_SPACING = 0.035;
const TICK_OUTER_DIA = 0.9;

// To prevent screen burn-in, all of these values must be less than the largest scale factor in the `breathe` animation.
// E.g. if the largest scale is 1.05, then these must all be less than 0.05.
// See style.css.
const PRIMARY_TICK_LENGTH = 0.028;
const PRIMARY_TICK_WIDTH = 0.032;
const PRIMARY_TICK_LENGTH_FINISHED = 0.049;
const PRIMARY_TICK_WIDTH_FINISHED = 0.016;
const MAJOR_TICK_LENGTH = 0.028;
const MAJOR_TICK_WIDTH = 0.024;
const MINOR_TICK_LENGTH = 0.016;
const MINOR_TICK_WIDTH = 0.016;
const TRACK_WIDTH = 0.025;

const VICTORY_LAP_DURATION = 1 * Second;

export type ClockFaceHandle = {
  draw: (time: number) => void;
  stepVictory: (dt: number) => boolean; // Returns true if animation is complete
};

type ClockFaceProps = {
  className?: string;
  colorScheme: 'light' | 'dark';
  onClockRadiusChange?: (radius: number) => void;
  initialTime: number;
  mode: TimerMode;
  isRunning: boolean;
};

type Dimensions = {
  width: number;
  height: number;
  radius: number;
};

function ease(t: number, clamp = true): number {
  if (clamp) t = math.clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const ClockFace = forwardRef<ClockFaceHandle, ClockFaceProps>(
  ({ className, colorScheme, onClockRadiusChange, initialTime, mode, isRunning }, ref) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const [dimensions, setDimensions] = useState<Dimensions | null>(null);
    const victoryAnimation = useRef<number>(0);
    const theme = useCanvasTheme(canvas, colorScheme);

    const drawClockFace = useCallback(
      (timeToDraw: number) => {
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !dimensions || !theme) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Resize canvas if needed
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        const trackLength = mode === 'hours' ? Hours : Minutes;
        const tracks = getTracks(timeToDraw, CLOCK_DIAMETER, TRACK_SPACING, trackLength);
        const finalTrack = tracks[tracks.length - 1];
        if (!finalTrack) return;
        const center: v.Vec2Like = [width / 2, height / 2];

        ctx.save();
        try {
          // Use relative coordinates
          ctx.translate(center[0], center[1]);
          ctx.scale(dimensions.radius, dimensions.radius);
          if (tracks.length > 1 || finalTrack.angle > 0) {
            drawRevolutions(ctx, tracks, theme, isRunning);
          } else {
            drawFullTrackCircle(ctx, finalTrack, theme, false);
          }

          let isFinishing = false;
          if (victoryAnimation.current) {
            isFinishing = drawVictoryAnimation(ctx, finalTrack, victoryAnimation.current, theme);
          }

          let primaryTickStyle: 'pause' | 'triangle' | 'exclamation';
          const isAnyTimeRemaining = finalTrack.rev > 0 || finalTrack.angle > 0;
          if (!isAnyTimeRemaining || isFinishing) primaryTickStyle = 'exclamation';
          else if (isRunning) primaryTickStyle = 'triangle';
          // else primaryTickStyle = 'pause';
          else primaryTickStyle = 'triangle';

          drawClockTicks({ ctx, finalTrack, theme, mode, primaryTickStyle });
        } finally {
          ctx.restore();
        }
      },
      [canvas, dimensions, theme, mode, isRunning],
    );

    useImperativeHandle(
      ref,
      () => ({
        draw: drawClockFace,
        stepVictory: (dt: number) => {
          const t = victoryAnimation.current + dt;
          if (t >= VICTORY_LAP_DURATION) {
            victoryAnimation.current = 0;
            return true;
          } else {
            victoryAnimation.current = t;
            return false;
          }
        },
      }),
      [drawClockFace],
    );

    useEffect(() => {
      if (!canvas) return;

      const resizeObserver = new ResizeObserver(() => {
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const newDimensions = { width, height, radius: Math.min(width, height) / 2 };
        setDimensions(newDimensions);
        onClockRadiusChange?.(newDimensions.radius * TICK_OUTER_DIA);
      });

      resizeObserver.observe(canvas);
      return () => resizeObserver.disconnect();
    }, [canvas, onClockRadiusChange]);

    useEffect(() => {
      drawClockFace(initialTime);
    }, [drawClockFace, initialTime]);

    // Redraw when victory animation is active (polling or external trigger should call drawClockFace)
    // No-op effect here; animation should be advanced and drawn by external timer/raf

    return <canvas ref={setCanvas} className={clsx('w-full h-full', className)} />;
  },
);

type Track = {
  rev: number;
  thickness: number;
  radius: number;
  angle: number;
  distFromStart: number; // negative for current track
  distFromEnd: number; // negative for current track
};

const getTracks = (
  timeToDraw: number,
  baseRadius: number,
  radiusSpacing: number,
  /** The length of each track, e.g. "one hour" or "one minute" */
  trackLength: number,
) => {
  const totalRevolutions = Math.ceil(Math.max(1, timeToDraw / trackLength));
  const isMinuteMode = trackLength === Minutes;
  const maxRevolutions = isMinuteMode ? 20 : 24; // 20 minutes or 24 hours

  const tracks: Track[] = [];
  for (let rev = 0; rev < Math.min(totalRevolutions, maxRevolutions); rev++) {
    const thickness = isMinuteMode
      ? (1 - rev / 20) ** 0.5 // Scale for 20 minutes
      : (1 - rev / 24) ** 0.5; // Scale for 24 hours
    const radius = baseRadius - rev ** 0.93 * radiusSpacing;
    if (radius <= 0) continue;

    const revolutionStart = rev * trackLength;
    const revolutionEnd = (rev + 1) * trackLength;

    let revolutionTime: number;
    if (timeToDraw >= revolutionEnd) {
      // Future track (full circle)
      revolutionTime = trackLength;
    } else if (timeToDraw > revolutionStart) {
      // Current track (partial circle)
      revolutionTime = timeToDraw - revolutionStart;
    } else {
      // Completed track (empty circle)
      revolutionTime = 0;
    }

    const angle = (revolutionTime / trackLength) * math.TAU;

    const distFromStart = (revolutionStart - timeToDraw) / trackLength;
    const distFromEnd = (timeToDraw - revolutionEnd) / trackLength;

    tracks.push({ rev, thickness, radius, angle, distFromStart, distFromEnd });
  }
  return tracks;
};

const drawRevolutions = (ctx: CanvasRenderingContext2D, tracks: Track[], theme: ClockTheme, isRunning: boolean) => {
  const finalTrack = tracks[tracks.length - 1];
  if (!finalTrack) return;

  ctx.save();
  try {
    ctx.strokeStyle = theme.stroke;
    ctx.fillStyle = theme.stroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw revolutions
    for (const track of tracks) {
      if (track.angle < 0.001) continue;

      const variant = isRunning ? 'go' : 'stop';

      if (track === finalTrack) {
        // Mask out part of the previous track to avoid collision with the marker (see below)
        drawTrackMarker(ctx, { theme, track: finalTrack, variant, phase: 'backdrop-1' });
      }

      if (track === finalTrack) {
        // Draw a faint complete circle for the final track
        drawFullTrackCircle(ctx, finalTrack, theme, false);
      }

      // if (track === finalTrack) {
      //   // Shadow effects
      //   drawTrackMarker(ctx, { theme, track: finalTrack, variant, phase: 'backdrop-2' });
      // }

      // Draw the remaining duration of this hour (track) as a thick arc
      drawTrackArc(ctx, track, theme, isRunning);

      if (track === finalTrack) {
        // Indicate timer state
        drawTrackMarker(ctx, { theme, track: finalTrack, variant, phase: 'foreground' });
      }
    }
  } finally {
    ctx.restore();
  }
};

const drawFullTrackCircle = (ctx: CanvasRenderingContext2D, track: Track, theme: ClockTheme, filled: boolean) => {
  const { thickness, radius } = track;
  ctx.lineWidth = (TRACK_WIDTH * thickness) / 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, math.TAU);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.fill;
  ctx.stroke();

  if (filled) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.fill;
    ctx.fill();
  }
};

const drawTrackArc = (ctx: CanvasRenderingContext2D, track: Track, theme: ClockTheme, isRunning: boolean) => {
  const { thickness, radius, angle, distFromStart, distFromEnd } = track;
  const dist = Math.abs(distFromStart) < Math.abs(distFromEnd) ? distFromStart : distFromEnd;
  const baseLineWidth = TRACK_WIDTH * thickness * (isRunning ? 1 : 0.9);
  const lineWidth = baseLineWidth * math.clamp(1 - dist / 6, 0.15, 1.0);

  ctx.beginPath();
  ctx.arc(0, 0, radius, -math.HALF_PI, angle - math.HALF_PI);

  // ctx.strokeStyle = theme.bg;
  // ctx.globalAlpha = 0.2;
  // ctx.lineWidth = lineWidth * 1.6;
  // ctx.stroke();

  ctx.strokeStyle = theme.stroke;
  ctx.globalAlpha = math.clamp(1 - dist / 6, 0.5, 1.0);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

const drawTrackMarker = (
  ctx: CanvasRenderingContext2D,
  {
    theme,
    track,
    variant: shape,
    phase,
  }: {
    theme: ClockTheme;
    track: Track;
    variant: 'stop' | 'go';
    phase: 'foreground' | 'backdrop-1' | 'backdrop-2';
  },
) => {
  ctx.save();
  try {
    const { angle, thickness, radius } = track;

    const lineWidth = TRACK_WIDTH * thickness;

    ctx.rotate(angle - math.HALF_PI); // Rotate to the end of the arc
    ctx.translate(radius, 0); // Move to the end of the arc

    const markerScale = 0.9;

    if (shape === 'stop') {
      // Square

      const w = lineWidth * markerScale;
      ctx.beginPath();
      ctx.rect(-w / 2, -w / 2, w, w);

      if (phase === 'backdrop-1') {
        // Mask
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = w * 2;
        ctx.stroke();
      }

      if (phase === 'backdrop-2') {
        // Shadow
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = w * 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
      }

      if (phase === 'foreground') {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = theme.bg;
        ctx.fill();

        ctx.strokeStyle = theme.decoration;
        ctx.lineWidth = w;
        ctx.stroke();
      }
    }

    if (shape === 'go') {
      // Circle

      if (phase === 'backdrop-1') {
        ctx.beginPath();
        ctx.arc(0, 0, lineWidth * 1.4 * markerScale, 0, math.TAU);
        ctx.globalAlpha = 1;
        ctx.fillStyle = theme.bg;
        ctx.fill();
      }

      if (phase === 'backdrop-2') {
        ctx.beginPath();
        ctx.arc(0, 0, lineWidth * 1.3 * markerScale, 0, math.TAU);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.bg;
        ctx.fill();
      }

      if (phase === 'foreground') {
        ctx.beginPath();
        ctx.arc(0, 0, lineWidth * 1 * markerScale, 0, math.TAU);
        ctx.globalAlpha = 1;
        ctx.fillStyle = theme.stroke;
        ctx.fill();
      }
    }
  } finally {
    ctx.restore();
  }
};

const drawClockTicks = ({
  ctx,
  finalTrack,
  theme,
  mode,
  primaryTickStyle,
}: {
  ctx: CanvasRenderingContext2D;
  finalTrack: Track;
  theme: ClockTheme;
  mode: TimerMode;
  primaryTickStyle: 'pause' | 'triangle' | 'exclamation';
}) => {
  ctx.save();
  try {
    ctx.strokeStyle = theme.text;
    ctx.fillStyle = theme.text;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const tickCount = mode === 'hours' ? 12 : 60; // 12 ticks for hours, 60 for minutes
    const angleStep = math.TAU / tickCount;

    for (let i = 0; i < tickCount; i++) {
      const angle = angleStep * i;

      let isMajor: boolean;
      let isPrimary: boolean;
      let proximal: number;

      if (mode === 'hours') {
        // For hours mode: major every 3 ticks (quarters), primary at 0 (top)
        isMajor = i % 3 === 0;
        isPrimary = i === 0;
        proximal = math.rad(30);
      } else {
        // For minutes mode: major every 5 ticks (every 5 minutes), primary at 0 (top)
        isMajor = i % 5 === 0;
        isPrimary = i === 0;
        proximal = math.rad(12);
      }

      // Calculate proximity for alpha blending
      // Add a bit to the angle to emphasize future ticks
      // Using the unwrapped distance prevents ticks < 0 from showing;
      // Using the wrapped distance allows ticks on both sides of 0 to show.
      const unwrappedAngleDist = Math.abs(finalTrack.angle - (angle + proximal / 2));
      const wrappedAngleDist = math.angleDist(finalTrack.angle, angle + proximal / 2);
      const angleDist =
        finalTrack.rev > 0
          ? wrappedAngleDist
          : math.mix(unwrappedAngleDist, wrappedAngleDist, finalTrack.angle / math.TAU);
      const proximity = math.clamp(1 - angleDist / proximal, 0, 1);

      ctx.save();
      ctx.rotate(angle - math.PI); // Start from top
      ctx.globalAlpha = isPrimary ? 1 : proximity * 0.9;
      if (isPrimary) {
        if (primaryTickStyle === 'pause') {
          // Draw a pause icon
          ctx.lineWidth = MAJOR_TICK_WIDTH / 2;
          ctx.beginPath();
          const length = PRIMARY_TICK_LENGTH;
          const width = PRIMARY_TICK_WIDTH_FINISHED;
          const barWidth = width / 6;
          const x0 = -width / 2;
          for (const side of [-1, 1]) {
            ctx.moveTo(side * x0, TICK_OUTER_DIA - length);
            ctx.lineTo(side * x0, TICK_OUTER_DIA);
            ctx.lineTo(side * (x0 - barWidth), TICK_OUTER_DIA);
            ctx.lineTo(side * (x0 - barWidth), TICK_OUTER_DIA - length);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
          }
        } else if (primaryTickStyle === 'exclamation') {
          // Draw an exclamation mark !
          ctx.lineWidth = MAJOR_TICK_WIDTH / 2;
          ctx.beginPath();
          ctx.moveTo(0, TICK_OUTER_DIA - PRIMARY_TICK_LENGTH_FINISHED);
          ctx.lineTo(-PRIMARY_TICK_WIDTH_FINISHED / 2, TICK_OUTER_DIA);
          ctx.lineTo(PRIMARY_TICK_WIDTH_FINISHED / 2, TICK_OUTER_DIA);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.arc(0, CLOCK_DIAMETER, PRIMARY_TICK_WIDTH_FINISHED, 0, math.TAU);
          ctx.fill();
        } else {
          // Draw a triangle pointing in
          ctx.lineWidth = MAJOR_TICK_WIDTH / 2;
          ctx.beginPath();
          ctx.moveTo(0, TICK_OUTER_DIA - PRIMARY_TICK_LENGTH);
          ctx.lineTo(-PRIMARY_TICK_WIDTH / 2, TICK_OUTER_DIA);
          ctx.lineTo(PRIMARY_TICK_WIDTH / 2, TICK_OUTER_DIA);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        }
      } else {
        // Draw a radial line
        const length = isMajor ? MAJOR_TICK_LENGTH : MINOR_TICK_LENGTH;
        ctx.lineWidth = isMajor ? MAJOR_TICK_WIDTH : MINOR_TICK_WIDTH;
        ctx.beginPath();
        ctx.moveTo(0, TICK_OUTER_DIA - length);
        ctx.lineTo(0, TICK_OUTER_DIA);
        ctx.stroke();
      }
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
};

const drawVictoryAnimation = (
  ctx: CanvasRenderingContext2D,
  finalTrack: Track,
  frameTime: number,
  theme: ClockTheme,
) => {
  const animationProgress = frameTime / VICTORY_LAP_DURATION; // Convert to 0-1 range
  const radius = finalTrack.radius;

  // Calculate head and tail positions using ease function
  const tailDelay = 0.3;
  const headProgress = ease(animationProgress / (1 - tailDelay));

  const tailProgress = ease(animationProgress / (1 - tailDelay) - tailDelay);

  // Convert to angles (negative for CCW from top)
  const headAngle = -headProgress * math.TAU;
  const tailAngle = -tailProgress * math.TAU;

  ctx.save();
  try {
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = TRACK_WIDTH;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1.0;

    // Draw the victory arc from tail to head
    if (headAngle < tailAngle) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, -math.HALF_PI + tailAngle, -math.HALF_PI + headAngle, true);
      ctx.stroke();
    }
  } finally {
    ctx.restore();
  }
  return headProgress < 1;
};

type ClockTheme = {
  scheme: 'light' | 'dark';
  stroke: string;
  decoration: string;
  fill: string;
  bg: string;
  text: string;
};

const useCanvasTheme = (canvas: HTMLCanvasElement | null, colorScheme: 'light' | 'dark') => {
  const [theme, setTheme] = useState<ClockTheme | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const updateTheme = () => {
      const style = getComputedStyle(canvas);
      setTheme({
        scheme: colorScheme,
        stroke: style.stroke,
        decoration: style.textDecorationColor,
        fill: style.fill,
        bg: style.backgroundColor,
        text: style.color,
      });
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(canvas, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => observer.disconnect();
  }, [canvas, colorScheme]);

  return theme;
};
