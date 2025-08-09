import { useCallback, useEffect, useRef } from 'react';

type WakeLockParams = {
  enable: boolean;
};

export const useWakeLock = ({ enable }: WakeLockParams) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enableRef = useRef(enable);

  // Keep enable ref current
  useEffect(() => {
    enableRef.current = enable;
  }, [enable]);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    if (!enableRef.current) return;
    if (wakeLockRef.current && !wakeLockRef.current.released) return; // Already have active wake lock
    
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.debug('Screen wake lock acquired');
      
      // Listen for wake lock release to clear our reference
      wakeLockRef.current.addEventListener('release', () => {
        console.debug('Screen wake lock released');
        wakeLockRef.current = null;
      });
    } catch (e) {
      console.warn(`Failed to acquire wake lock: ${e}`);
    }
  }, []);

  // Release wake lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      console.debug('Screen wake lock released');
      wakeLockRef.current = null;
    }
  }, []);

  // Handle visibility changes (always active when component is mounted)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enableRef.current) {
        // When page becomes visible and timer should be running, ensure wake lock is active
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock]);

  // Handle enable/disable wake lock
  useEffect(() => {
    if (enable) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [enable, requestWakeLock, releaseWakeLock]);
};
