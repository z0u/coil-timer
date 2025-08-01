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
const MAJOR_TICK_LENGTH = 0.014;
const MINOR_TICK_LENGTH = 0.008;
const TRACK_WIDTH = 0.015;
const MAJOR_TICK_WIDTH = 0.012;
const MINOR_TICK_WIDTH = 0.008;

type UseDrawClockFaceProps = {
  canvas: HTMLCanvasElement | null;
};

type ClockDimensions = {
  screenRadius: number;
  outerRadius: number;
  innerRadius: number;
};

export const useDrawClockFace = ({ canvas }: UseDrawClockFaceProps) => {
  const [dimensions, setDimensions] = useState<ClockDimensions | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      setDimensions(getDimensions(canvas));
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [canvas]);

  const drawClockFace = useCallback(
    (timeToDraw: number) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !dimensions) return;

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
      const trackSpacing = dimensions.screenRadius * 2 * TRACK_SPACING;
      const totalRevolutions = Math.max(1, Math.ceil(hours));
      const tracks = getTracks(totalRevolutions, dimensions.innerRadius, trackSpacing, timeToDraw);
      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;
      const center: v.Vec2Like = [width / 2, height / 2];

      ctx.save();
      try {
        // Use relative coordinates
        ctx.translate(center[0], center[1]);

        // Draw clock ticks
        ctx.save();
        try {
          ctx.strokeStyle = 'white';
          ctx.fillStyle = 'white';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const tickOuterRadius = dimensions.outerRadius;
          const majorTickLength = MAJOR_TICK_LENGTH * dimensions.screenRadius * 2;
          const majorTickWidth = MAJOR_TICK_WIDTH * dimensions.screenRadius * 2;
          const minorTickLength = MINOR_TICK_LENGTH * dimensions.screenRadius * 2;
          const minorTickWidth = MINOR_TICK_WIDTH * dimensions.screenRadius * 2;

          for (let i = 0; i < 12; i++) {
            const angle = (math.TAU / 12) * i;
            const isMajor = i % 3 === 0;
            const isPrimary = i === 0;
            const tickLength = isMajor ? majorTickLength : minorTickLength;
            const startRadius = tickOuterRadius - tickLength;

            // Calculate proximity for alpha blending
            const angleDist = math.angleDist(finalTrack.angle, angle);
            const proximity = math.clamp(1 - angleDist / math.rad(35), 0, 1);

            ctx.save();
            // ctx.translate(center[0], center[1]);
            ctx.rotate(angle - math.PI); // Start from top
            ctx.globalAlpha = isPrimary ? 1 : proximity * 0.9;
            if (isPrimary) {
              // Draw a triangle pointing in
              ctx.lineWidth = majorTickWidth / 2;
              ctx.beginPath();
              ctx.moveTo(0, startRadius);
              ctx.lineTo(-majorTickWidth, tickOuterRadius);
              ctx.lineTo(majorTickWidth, tickOuterRadius);
              ctx.closePath();
              ctx.stroke();
              ctx.fill();
            } else {
              // Draw a radial line
              ctx.lineWidth = isMajor ? majorTickWidth : minorTickWidth;
              ctx.beginPath();
              ctx.moveTo(0, startRadius);
              ctx.lineTo(0, tickOuterRadius);
              ctx.stroke();
            }
            ctx.restore();
          }
        } finally {
          ctx.restore();
        }

        ctx.save();
        try {
          ctx.strokeStyle = '#ef4444';
          ctx.fillStyle = '#ef4444';
          ctx.lineCap = 'round';

          // Draw faint tracks as complete circles
          ctx.globalAlpha = 0.4;
          {
            const { thickness, radius } = finalTrack;
            ctx.lineWidth = TRACK_WIDTH * dimensions.screenRadius * thickness;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, math.TAU);
            ctx.stroke();
          }

          // Draw revolutions
          ctx.globalAlpha = 1.0;
          for (const { thickness, radius, angle } of tracks) {
            const lineWidth = TRACK_WIDTH * dimensions.screenRadius * 2 * thickness;
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
      } finally {
        ctx.restore();
      }
    },
    [canvas, dimensions],
  );

  return { drawClockFace, dimensions };
};

const getDimensions = (canvas: HTMLCanvasElement) => {
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  const screenDiameter = Math.min(width, height);
  return {
    screenRadius: screenDiameter / 2,
    outerRadius: (screenDiameter * TICK_OUTER_DIA) / 2,
    innerRadius: (screenDiameter * CLOCK_DIAMETER) / 2,
  };
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
    const thickness = (1 - rev / 12) ** 0.8;
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
