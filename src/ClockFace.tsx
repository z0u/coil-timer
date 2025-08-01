import * as math from '@thi.ng/math';
import * as v from '@thi.ng/vectors';
import clsx from 'clsx';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Hours } from './time-utils';

// These constants are in normalized device coordinates (fractions of min(vh, vw))
const CLOCK_DIAMETER = 0.8;
const TRACK_SPACING = 0.035;
const TICK_OUTER_DIA = 0.9;

// To prevent screen burn-in, all of these values must be less than the largest scale factor in the `breathe` animation.
// E.g. if the largest scale is 1.05, then these must all be less than 0.05.
// See style.css.
const MAJOR_TICK_LENGTH = 0.028;
const MINOR_TICK_LENGTH = 0.016;
const MAJOR_TICK_WIDTH = 0.024;
const MINOR_TICK_WIDTH = 0.016;
const TRACK_WIDTH = 0.025;

export type ClockFaceHandle = {
  setTime: (time: number) => void;
};

type ClockFaceProps = {
  className?: string;
  colorScheme: string;
  onClockRadiusChange?: (radius: number) => void;
  initialTime: number;
};

type Dimensions = {
  width: number;
  height: number;
  radius: number;
};

export const ClockFace = forwardRef<ClockFaceHandle, ClockFaceProps>(
  ({ className, colorScheme, onClockRadiusChange, initialTime }, ref) => {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const [dimensions, setDimensions] = useState<Dimensions | null>(null);
    const timeToDrawRef = useRef(initialTime);

    const theme = useMemo(() => {
      if (!canvas) return null;

      const style = getComputedStyle(canvas);
      return {
        scheme: colorScheme,
        stroke: style.stroke,
        bg: style.backgroundColor,
        text: style.color,
      };
    }, [canvas, colorScheme, className ?? '']);

    const drawClockFace = useCallback(() => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !dimensions || !theme) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Resize canvas if needed
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      const tracks = getTracks(timeToDrawRef.current, CLOCK_DIAMETER, TRACK_SPACING, Hours);
      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;
      const center: v.Vec2Like = [width / 2, height / 2];

      ctx.save();
      try {
        // Use relative coordinates
        ctx.translate(center[0], center[1]);
        ctx.scale(dimensions.radius, dimensions.radius);
        drawClockTicks(ctx, finalTrack, theme.text);
        drawRevolutions(ctx, tracks, theme.stroke);
      } finally {
        ctx.restore();
      }
    }, [canvas, dimensions, theme]);

    useImperativeHandle(
      ref,
      () => ({
        setTime: (time) => {
          timeToDrawRef.current = time;
          drawClockFace();
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
      drawClockFace();
    }, [drawClockFace]);

    return (
      <>
        {/* <ColorProbe
          onColorChange={(theme) => {
            console.log(theme);
            if (theme) setTheme(theme);
          }}
        /> */}
        <canvas ref={setCanvas} className={clsx('w-full h-full', className)} />
      </>
    );
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

const EPSILON = 0.001 * math.PI;

const getTracks = (
  timeToDraw: number,
  baseRadius: number,
  radiusSpacing: number,
  /** The length of each track, e.g. "one hour" */
  trackLength: number,
) => {
  const totalRevolutions = Math.ceil(Math.max(1, timeToDraw / trackLength));

  const tracks: Track[] = [];
  for (let rev = 0; rev < totalRevolutions; rev++) {
    const thickness = (1 - rev / 24) ** 0.5;
    const radius = baseRadius - rev ** 0.93 * radiusSpacing;
    if (radius <= 0) continue;

    const revolutionStart = rev * 60 * 60 * 1000;
    const revolutionEnd = (rev + 1) * 60 * 60 * 1000;

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

const drawRevolutions = (ctx: CanvasRenderingContext2D, tracks: Track[], trackColor: string) => {
  const finalTrack = tracks[tracks.length - 1];
  if (!finalTrack) return;

  ctx.save();
  try {
    ctx.strokeStyle = trackColor;
    ctx.fillStyle = trackColor;
    ctx.lineCap = 'round';

    // Draw faint tracks as complete circles
    {
      ctx.globalAlpha = 0.4;
      const { thickness, radius, distFromStart } = finalTrack;
      const frac = math.clamp(unmix(0, 1 / 60, -distFromStart), 0, 1);
      ctx.globalAlpha = tracks.length > 1 ? math.mix(0, 0.3, frac) : 0.3;
      ctx.lineWidth = (TRACK_WIDTH * thickness) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, math.TAU);
      ctx.stroke();
    }

    // Draw revolutions
    for (const track of tracks) {
      const { thickness, radius, angle, distFromStart, distFromEnd } = track;
      const dist = Math.abs(distFromStart) < Math.abs(distFromEnd) ? distFromStart : distFromEnd;
      const lineWidth = TRACK_WIDTH * thickness;

      ctx.globalAlpha = math.clamp(1 - dist / 6, 0.5, 1.0);
      ctx.lineWidth = lineWidth * math.clamp(1 - dist / 6, 0.15, 1.0);

      ctx.beginPath();
      if (angle > EPSILON) {
        // Draw the remaining duration of this hour (track) as a thick arc
        ctx.arc(0, 0, radius, -math.HALF_PI, angle - math.HALF_PI);
        ctx.stroke();
      } else {
        // Draw a dot at the top if the track is empty
        ctx.arc(0, -radius, lineWidth / 2, 0, math.TAU);
        ctx.fill();
      }
    }
  } finally {
    ctx.restore();
  }
};

const drawClockTicks = (ctx: CanvasRenderingContext2D, finalTrack: Track, tickColor: string) => {
  ctx.save();
  try {
    ctx.strokeStyle = tickColor;
    ctx.fillStyle = tickColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < 12; i++) {
      const angle = (math.TAU / 12) * i;
      const isMajor = i % 3 === 0;
      const isPrimary = i === 0;

      // Calculate proximity for alpha blending
      let angleDist: number;
      if (finalTrack.rev === 0) {
        // Special case: don't use math.angleDist when the final track is also track 0, i.e. it is the last/only track.
        // This prevents ticks < 0 from showing.
        angleDist = Math.abs(finalTrack.angle - (angle + math.TAU / 24));
      } else {
        // For tracks > 0, treat the difference as cyclic to show ticks on both sides of the start.
        angleDist = math.angleDist(
          finalTrack.angle,
          angle + math.TAU / 24, // Add a bit to brighten future ticks more
        );
      }
      const proximity = math.clamp(1 - angleDist / math.rad(30), 0, 1);

      ctx.save();
      ctx.rotate(angle - math.PI); // Start from top
      ctx.globalAlpha = isPrimary ? 1 : proximity * 0.9;
      if (isPrimary) {
        // Draw a triangle pointing in
        ctx.lineWidth = MAJOR_TICK_WIDTH / 2;
        ctx.beginPath();
        ctx.moveTo(0, TICK_OUTER_DIA - MAJOR_TICK_LENGTH);
        ctx.lineTo(-MAJOR_TICK_WIDTH, TICK_OUTER_DIA);
        ctx.lineTo(MAJOR_TICK_WIDTH, TICK_OUTER_DIA);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
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

const unmix = (a: number, b: number, v: number): number => (v - a) / (b - a);
