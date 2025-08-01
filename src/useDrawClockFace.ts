import * as math from '@thi.ng/math';
import * as v from '@thi.ng/vectors';
import { useCallback, useEffect, useState } from 'react';
import { Hour } from './time-utils';

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

type UseDrawClockFaceProps = {
  canvas: HTMLCanvasElement | null;
};

export const useDrawClockFace = ({ canvas }: UseDrawClockFaceProps) => {
  const [screenRadius, setScreenRadius] = useState<number>(1);

  useEffect(() => {
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      setScreenRadius(Math.min(width, height) / 2);
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [canvas]);

  const drawClockFace = useCallback(
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
      const totalRevolutions = Math.max(1, Math.ceil(hours));
      const tracks = getTracks(totalRevolutions, CLOCK_DIAMETER, TRACK_SPACING, timeToDraw);
      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;
      const center: v.Vec2Like = [width / 2, height / 2];

      ctx.save();
      try {
        // Use relative coordinates
        ctx.translate(center[0], center[1]);
        ctx.scale(screenRadius, screenRadius);
        drawClockTicks(ctx, finalTrack);
        drawRevolutions(ctx, finalTrack, tracks);
      } finally {
        ctx.restore();
      }
    },
    [canvas, screenRadius],
  );

  return { drawClockFace, clockRadius: screenRadius * TICK_OUTER_DIA };
};

type Track = {
  rev: number;
  thickness: number;
  radius: number;
  angle: number;
};

const EPSILON = 0.001 * math.PI;

const getTracks = (totalRevolutions: number, baseRadius: number, radiusSpacing: number, timeToDraw: number) => {
  const tracks: Track[] = [];
  for (let rev = 0; rev < totalRevolutions; rev++) {
    const thickness = (1 - rev / 24) ** 0.8;
    const radius = baseRadius - rev ** 0.93 * radiusSpacing;
    if (radius <= 0) continue;

    const revolutionStart = rev * 60 * 60 * 1000;
    const revolutionEnd = (rev + 1) * 60 * 60 * 1000;

    let revolutionTime: number;
    if (timeToDraw >= revolutionEnd) {
      revolutionTime = 1 * Hour;
    } else if (timeToDraw > revolutionStart) {
      revolutionTime = timeToDraw - revolutionStart;
    } else {
      revolutionTime = 0;
    }

    const angle = (revolutionTime / Hour) * math.TAU;

    tracks.push({ rev, thickness, radius, angle });
  }
  return tracks;
};

const drawRevolutions = (ctx: CanvasRenderingContext2D, finalTrack: Track, tracks: Track[]) => {
  ctx.save();
  try {
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.lineCap = 'round';

    // Draw faint tracks as complete circles
    ctx.globalAlpha = 0.4;
    {
      const { thickness, radius } = finalTrack;
      ctx.lineWidth = (TRACK_WIDTH * thickness) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, math.TAU);
      ctx.stroke();
    }

    // Draw revolutions
    ctx.globalAlpha = 1.0;
    for (const { thickness, radius, angle } of tracks) {
      const lineWidth = TRACK_WIDTH * thickness;
      ctx.lineWidth = lineWidth;
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

const drawClockTicks = (ctx: CanvasRenderingContext2D, finalTrack: Track) => {
  ctx.save();
  try {
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < 12; i++) {
      const angle = (math.TAU / 12) * i;
      const isMajor = i % 3 === 0;
      const isPrimary = i === 0;

      // Calculate proximity for alpha blending
      const angleDist = math.angleDist(finalTrack.angle, angle);
      const proximity = math.clamp(1 - angleDist / math.rad(35), 0, 1);

      ctx.save();
      // ctx.translate(center[0], center[1]);
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
