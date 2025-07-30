import { useCallback, useEffect, useRef } from 'react';

type WakeLockParams = {
  enable: boolean;
};

export const useWakeLock = ({ enable }: WakeLockParams) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.log('Screen wake lock acquired');
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
    }
  }, []);

  // Release wake lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      console.log('Screen wake lock released');
      wakeLockRef.current = null;
    }
  }, []);

  // Initialize wake lock and handle visibility changes
  useEffect(() => {
    if (!enable) return;

    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock, releaseWakeLock, enable]);
};
