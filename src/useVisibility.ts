import { useEffect, useState } from 'react';

/**
 * Hook to track the visibility state of the document.
 *
 * State updates when the visibility changes, such as when the user switches
 * tabs or minimizes the browser.
 *
 * @returns {boolean} - True if the document is visible, false otherwise.
 */
export const useVisibility = () => {
  const [visible, setVisible] = useState(document.visibilityState === 'visible');

  useEffect(() => {
    const handleVisibilityChange = () => setVisible(document.visibilityState === 'visible');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setVisible]);

  return visible;
};
