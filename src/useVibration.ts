import { useCallback } from 'react';

export interface VibrationActions {
  vibrate: (pattern?: number | number[]) => void;
  isSupported: boolean;
}

export const useVibration = (): VibrationActions => {
  const isSupported = 'vibrate' in navigator;

  const vibrate = useCallback(
    (pattern: number | number[] = 200) => {
      if (!isSupported) {
        console.log('Not vibrating: Not supported.');
        return;
      }
      try {
        console.log('Vibrating');
        navigator.vibrate(pattern);
      } catch (error) {
        console.warn('Vibration failed:', error);
      }
    },
    [isSupported],
  );

  return {
    vibrate,
    isSupported,
  };
};
