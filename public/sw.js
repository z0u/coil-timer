// Service Worker for Coil Timer
// Handles background notifications

const CACHE_NAME = 'coil-timer-v1';
const DB_NAME = 'coil-timer-db';
const DB_VERSION = 1;
const TIMERS_STORE = 'timers';

// Initialize IndexedDB for persistent timer storage
let db = null;

async function initDB() {
  // Request persistent storage first
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      const isPersistent = await navigator.storage.persist();
      console.log(`Persistent storage granted: ${isPersistent}`);

      // Also log storage estimate for debugging
      if ('estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log('Storage estimate:', estimate);
      }
    } catch (error) {
      console.warn('Failed to request persistent storage:', error);
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(TIMERS_STORE)) {
        db.createObjectStore(TIMERS_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Helper functions for IndexedDB
async function storeTimer(id, title, body, triggerTime) {
  if (!db) await initDB();
  const transaction = db.transaction([TIMERS_STORE], 'readwrite');
  const store = transaction.objectStore(TIMERS_STORE);
  await store.put({ id, title, body, triggerTime });
}

async function removeTimer(id) {
  if (!db) await initDB();
  const transaction = db.transaction([TIMERS_STORE], 'readwrite');
  const store = transaction.objectStore(TIMERS_STORE);
  await store.delete(id);
}

async function getAllTimers() {
  if (!db) await initDB();
  const transaction = db.transaction([TIMERS_STORE], 'readonly');
  const store = transaction.objectStore(TIMERS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(initDB());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(Promise.all([self.clients.claim(), initDB()]));

  // Register for periodic background sync if available
  if ('serviceWorker' in navigator && 'periodicSync' in self.registration) {
    console.log('Registering periodic background sync');
    self.registration.periodicSync
      .register('check-timers', {
        minInterval: 60 * 1000, // Check every minute minimum
      })
      .catch((err) => console.log('Periodic sync registration failed:', err));
  }
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
    }),
  );
});

// Handle background message from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  console.log(`message ${type}`);

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, icon } = data;
    console.log(`showing notification: ${title} / ${body}`);

    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'coil-timer-notification',
      requireInteraction: true,
      // Add mobile-specific options
      silent: false,
      vibrate: [200, 100, 200],
      // Add data to help with click handling
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 'immediate-notification',
      },
      actions: [
        {
          action: 'focus',
          title: 'Open Timer',
        },
      ],
    });
  } else if (type === 'SCHEDULE_NOTIFICATION') {
    const { id, title, body, delay } = data;
    console.log(`scheduling notification: ${title} / ${body} @ ${delay}`);

    // Store timer data persistently for background sync
    const triggerTime = Date.now() + delay;
    storeTimer(id, title, body, triggerTime)
      .then(() => {
        console.log(`Stored persistent timer ${id} for ${new Date(triggerTime)}`);
      })
      .catch((err) => console.error('Failed to store timer:', err));

    // Try to use the Notification Scheduling API if available (future Chrome feature)
    if ('showTrigger' in self.registration && 'TimestampTrigger' in self) {
      console.log(`Using Notification Scheduling API for ${triggerTime}`);

      self.registration
        .showNotification(title, {
          body,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: `coil-timer-notification-${id}`,
          requireInteraction: true,
          showTrigger: new TimestampTrigger(triggerTime),
          actions: [
            {
              action: 'focus',
              title: 'Open Timer',
            },
          ],
        })
        .catch((err) => {
          console.error('Failed to schedule notification:', err);
          // Fallback to setTimeout (unreliable but better than nothing)
          scheduleWithTimeout(id, title, body, delay);
        });
    } else {
      // Fallback to setTimeout (unreliable on mobile)
      scheduleWithTimeout(id, title, body, delay);
    }
  } else if (type === 'CANCEL_NOTIFICATION') {
    const { id } = data;
    console.log(`cancelling notification: ${id}`);

    // Remove from persistent storage
    removeTimer(id).catch((err) => console.error('Failed to remove timer:', err));
  }
});

// Helper function for setTimeout fallback (unreliable but better than nothing)
function scheduleWithTimeout(id, title, body, delay) {
  setTimeout(() => {
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: `coil-timer-notification-${id}`,
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: id,
      },
      actions: [
        {
          action: 'focus',
          title: 'Open Timer',
        },
      ],
    });
    // Clean up from persistent storage after firing
    removeTimer(id).catch((err) => console.error('Failed to remove timer after firing:', err));
  }, delay);
}

// Handle periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);

  if (event.tag === 'check-timers') {
    event.waitUntil(checkScheduledTimers());
  }
});

// Check if any timers should fire
async function checkScheduledTimers() {
  try {
    const timers = await getAllTimers();
    const now = Date.now();
    console.log(`Checking ${timers.length} scheduled timers at:`, new Date(now));

    for (const timer of timers) {
      if (now >= timer.triggerTime) {
        console.log(`Timer ${timer.id} should fire now`);

        await self.registration.showNotification(timer.title, {
          body: timer.body,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: `coil-timer-notification-${timer.id}`,
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200],
          data: {
            dateOfArrival: Date.now(),
            primaryKey: timer.id,
          },
          actions: [
            {
              action: 'focus',
              title: 'Open Timer',
            },
          ],
        });

        // Remove fired timer from storage
        await removeTimer(timer.id);
      }
    }
  } catch (error) {
    console.error('Error checking scheduled timers:', error);
  }
}
