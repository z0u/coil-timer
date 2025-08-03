import React from 'react';
import { createRoot } from 'react-dom/client';
import SpiralTimer from './SpiralTimer';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Request persistent storage for better reliability
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage
        .persist()
        .then((isPersistent) => {
          console.log(`Persistent storage granted: ${isPersistent}`);

          // Also log storage estimate for debugging
          if ('estimate' in navigator.storage) {
            navigator.storage.estimate().then((estimate) => {
              console.log('Storage estimate:', estimate);
            });
          }
        })
        .catch((error) => {
          console.warn('Failed to request persistent storage:', error);
        });
    }

    // Use relative path to work with Vite's base configuration
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

const root = createRoot(document.getElementById('root')!);
root.render(<SpiralTimer />);
