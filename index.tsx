import React from 'react';
import { createRoot } from 'react-dom/client';
import SpiralTimer from './src/spiral-timer-pwa';

const root = createRoot(document.getElementById('root')!);
root.render(<SpiralTimer />);
