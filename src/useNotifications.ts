import { useCallback, useMemo, useState } from 'react';
import z from 'zod';
import { useLocalStorage } from './useLocalStorage';

export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
  isEffectivelyEnabled: boolean;
}

export interface NotificationActions {
  toggleEnabled: () => void;
  scheduleNotification: (id: string, title: string, body: string, delay?: number) => void;
  cancelNotification: (id: string) => void;
}

const NOTIFICATION_PREFERENCE_KEY = 'coil-timer-notifications-enabled';

export const useNotifications = (): NotificationPermissionState & NotificationActions => {
  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const [isEnabled, setIsEnabled] = useLocalStorage(NOTIFICATION_PREFERENCE_KEY, z.boolean(), false);

  const isEffectivelyEnabled = isSupported && permission === 'granted' && isEnabled;

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.error('Notifications are not supported on this platform');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const toggleEnabled = useCallback(async () => {
    if (!isSupported) return;

    if (isEffectivelyEnabled) {
      // Don't need permission to disable
      setIsEnabled(false);
      return;
    }

    let _permission = permission;
    if (_permission === 'default') {
      _permission = await requestPermission();
    }

    if (_permission === 'granted') {
      setIsEnabled(true);

      // Show immediate notification to test
      _scheduleNotification('notifications-enabled', 'All set!', 'Notifications are enabled.', 0);

      // On mobile, show a warning about reliability
      if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => {
          _scheduleNotification(
            'mobile-warning',
            'Mobile Notice',
            'Background notifications may not work reliably on mobile. Keep the app open or return to it before timers expire.',
            3000,
          );
        }, 1000);
      }
    }
  }, [isSupported, isEffectivelyEnabled, permission, setIsEnabled, requestPermission]);

  const scheduleNotification = useCallback(
    (id: string, title: string, body: string, delay?: number) => {
      if (!isEffectivelyEnabled) {
        console.log(`Not scheduling notification ${title}: notifications are disabled.`);
        return;
      }
      _scheduleNotification(id, title, body, delay ?? 0);
    },
    [isEffectivelyEnabled],
  );

  const cancelNotification = useCallback(
    (id: string) => {
      if (!isSupported) {
        return;
      }
      _cancelNotification(id);
    },
    [isSupported],
  );

  return useMemo(
    () => ({
      permission,
      isSupported,
      isEnabled,
      isEffectivelyEnabled,
      toggleEnabled,
      scheduleNotification,
      cancelNotification,
    }),
    [cancelNotification, isEffectivelyEnabled, isEnabled, isSupported, permission, scheduleNotification, toggleEnabled],
  );
};

const _scheduleNotification = (id: string, title: string, body: string, delay: number) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      data: { id, title, body, delay },
    });
  }
};

const _cancelNotification = (id: string) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CANCEL_NOTIFICATION',
      data: { id },
    });
  }
};
