import { useEffect } from 'react';
import { Second } from './time-utils';
import { useVisibility } from './useVisibility';

interface UseAnimationProps {
  fps: number;
  runFrame: () => void;
}

export const useAnimation = ({ runFrame, fps }: UseAnimationProps) => {
  const visible = useVisibility();

  // Main animation loop
  useEffect(() => {
    let lastFrameTime = -Infinity;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const scheduleNext = (fps: number) => {
      if (fps >= 10) {
        // High FPS: use requestAnimationFrame
        rafId = requestAnimationFrame(loop);
      } else {
        // Low FPS: use setTimeout
        timeoutId = window.setTimeout(() => loop(performance.now()), (1 * Second) / fps);
      }
    };

    const loop = (t: number) => {
      const frameInterval = (1 * Second) / fps;
      if (t - lastFrameTime < frameInterval) {
        scheduleNext(fps);
        return;
      }
      lastFrameTime = t;

      runFrame();
      scheduleNext(fps);
    };

    // Start the animation loop.
    loop(performance.now());

    // Cleanup function.
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, [runFrame, fps, visible]);
};
