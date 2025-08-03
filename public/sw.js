// Service Worker for Coil Timer
// Handles background notifications

const CACHE_NAME = 'coil-timer-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();

  // Focus or open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open the app
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle background message from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, icon } = data;
    
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'coil-timer-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'focus',
          title: 'Open Timer'
        }
      ]
    });
  }
});