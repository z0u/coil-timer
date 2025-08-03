import React from 'react';
import { createRoot } from 'react-dom/client';
import SpiralTimer from './SpiralTimer';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
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
