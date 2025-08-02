import { useEffect, useState } from 'react';

/**
 * useDeviceCapabilities
 *
 * Returns an object with booleans:
 * - isMobile: true if user agent matches common mobile devices
 * - isTouchDevice: true if touch events are supported
 * - hasKeyboard: true if a physical keyboard is likely present (detected by keydown)
 */
export const useDeviceCapabilities = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [hasKeyboard, setHasKeyboard] = useState(false);

  useEffect(() => {
    // User agent check for mobile
    const mobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    setIsMobile(mobile);

    // Touch support check
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touch);

    // Keyboard detection: set to true on first keydown
    const handleKeyDown = () => setHasKeyboard(true);
    window.addEventListener('keydown', handleKeyDown, { once: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return { isMobile, isTouchDevice, hasKeyboard };
};
