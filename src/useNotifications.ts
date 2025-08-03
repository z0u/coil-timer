import { useCallback, useEffect, useState } from 'react';

export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
}

export interface NotificationActions {
  requestPermission: () => Promise<boolean>;
  toggleEnabled: () => void;
  showNotification: (title: string, body: string) => void;
}

const NOTIFICATION_PREFERENCE_KEY = 'coil-timer-notifications-enabled';

export const useNotifications = (): NotificationPermissionState & NotificationActions => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;

  // Load stored preference on mount
  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
      const stored = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
      setIsEnabled(stored === 'true');
    }
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setIsEnabled(true);
        localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, 'true');
        return true;
      } else {
        setIsEnabled(false);
        localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, 'false');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const toggleEnabled = useCallback(() => {
    if (!isSupported) return;

    if (permission === 'granted') {
      const newEnabled = !isEnabled;
      setIsEnabled(newEnabled);
      localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, newEnabled.toString());
    } else if (permission === 'default') {
      // Request permission when user tries to enable
      requestPermission();
    }
  }, [isSupported, permission, isEnabled, requestPermission]);

  const showNotification = useCallback((title: string, body: string) => {
    if (!isSupported || !isEnabled || permission !== 'granted') {
      return;
    }

    // Try to use service worker for background notifications
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        data: { title, body }
      });
    } else {
      // Fallback to regular notification API
      new Notification(title, {
        body,
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: 'coil-timer-notification'
      });
    }
  }, [isSupported, isEnabled, permission]);

  return {
    permission,
    isSupported,
    isEnabled,
    requestPermission,
    toggleEnabled,
    showNotification
  };
};