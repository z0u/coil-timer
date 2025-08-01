import { useEffect } from 'react';

export const useNonPassiveWheelHandler = (element: HTMLElement | null, handler: (event: WheelEvent) => void) => {
  // Attach non-passive wheel event listener to prevent scroll
  useEffect(() => {
    if (!element) return;
    const wheelHandler = (e: WheelEvent) => {
      handler(e);
    };
    element.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheelHandler);
    };
  }, [handler, element]);
};
