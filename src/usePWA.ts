import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWA() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);

      // Check for updates every 10 minutes
      if (r) {
        setInterval(
          () => {
            r.update();
          },
          10 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
    onOfflineReady() {
      console.log('SW offline ready');
      setOfflineReady(true);
    },
    onNeedRefresh() {
      console.log('SW need refresh');
      setNeedRefresh(true);
      setUpdateAvailable(true);
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
    setNeedRefresh(false);
  };

  const dismissOfflineReady = () => {
    setOfflineReady(false);
  };

  return {
    updateAvailable,
    offlineReady,
    needRefresh,
    handleUpdate,
    dismissUpdate,
    dismissOfflineReady,
  };
}
