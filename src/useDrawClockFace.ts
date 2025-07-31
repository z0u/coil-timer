import { useCallback, useEffect, useState } from 'react';
import { minToMs } from './time-utils';

// These constants are in normalized device coordinates (fractions of min(vh, vw))
const CLOCK_DIAMETER = 0.8;
const TRACK_SPACING = 0.035;
const TRACK_WIDTH = 0.015;

const TICK_OUTER_DIA = 0.9;
const MAJOR_TICK_LENGTH = 0.014;
const MAJOR_TICK_WIDTH = 0.012;
const MINOR_TICK_LENGTH = 0.008;
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
      // const screenDiameter = Math.min(width, height);
      const trackSpacing = dimensions.screenRadius * 2 * TRACK_SPACING;
      const totalRevolutions = Math.max(1, Math.ceil(hours));
      const tracks = getTracks(totalRevolutions, dimensions.innerRadius, trackSpacing, timeToDraw);

      const centerX = width / 2;
      const centerY = height / 2;

      const finalTrack = tracks[tracks.length - 1];
      if (!finalTrack) return;

      // Draw clock ticks
      if (tracks.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        const tickOuterRadius = dimensions.outerRadius;
        const majorTickLength = MAJOR_TICK_LENGTH * dimensions.screenRadius * 2;
        const majorTickWidth = MAJOR_TICK_WIDTH * dimensions.screenRadius * 2;
        const minorTickLength = MINOR_TICK_LENGTH * dimensions.screenRadius * 2;
        const minorTickWidth = MINOR_TICK_WIDTH * dimensions.screenRadius * 2;

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
        ctx.lineWidth = TRACK_WIDTH * dimensions.screenRadius * thickness;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw revolutions
      ctx.globalAlpha = 1.0;
      for (const { thickness, radius, endAngle } of tracks) {
        ctx.lineWidth = TRACK_WIDTH * dimensions.screenRadius * 2 * thickness;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
        ctx.stroke();
      }

      ctx.restore();
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
      revolutionTime = minToMs(60);
    } else if (timeToDraw > revolutionStart) {
      revolutionTime = timeToDraw - revolutionStart;
    } else {
      continue;
    }

    const endAngle = (revolutionTime / minToMs(60)) * 2 * Math.PI - Math.PI / 2;

    tracks.push({ rev, thickness, radius, endAngle });
  }
  return tracks;
};
