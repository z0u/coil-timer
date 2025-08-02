import { useEffect } from 'react';

export type TailwindColorKeys = 'track' | 'tick' | 'bg';
export type TailwindColors = Record<TailwindColorKeys, string>;

const colorIds: Record<TailwindColorKeys, string> = {
  track: 'tw-color-track',
  tick: 'tw-color-tick',
  bg: 'tw-color-bg',
};

function getTailwindColor(id: string): string {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element with id ${id} not found`);
  const style = getComputedStyle(el);
  return style.backgroundColor;
}

function getAllTailwindColors(): TailwindColors {
  return {
    track: getTailwindColor(colorIds.track),
    tick: getTailwindColor(colorIds.tick),
    bg: getTailwindColor(colorIds.bg),
  };
}

export const TailwindColorProbe = ({ onColorsChange }: { onColorsChange: (colors: TailwindColors) => void }) => {
  useEffect(() => {
    function updateColors() {
      try {
        onColorsChange(getAllTailwindColors());
      } catch {
        // ignore if probe elements not found
      }
    }
    updateColors();
    // Listen for dark mode changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', updateColors);
    return () => mql.removeEventListener('change', updateColors);
  }, [onColorsChange]);

  return (
    <div style={{ display: 'none' }}>
      <div id="tw-color-track" className="bg-red-500 dark:bg-red-400"></div>
      <div id="tw-color-tick" className="bg-white dark:bg-gray-200"></div>
      <div id="tw-color-bg" className="bg-black dark:bg-gray-900"></div>
    </div>
  );
};
