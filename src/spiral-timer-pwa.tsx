import { useCallback, useEffect, useRef, useState } from 'react';

interface Running {
  is: 'running';
  endTime: number;
}

interface Paused {
  is: 'paused';
  remainingTime: number;
}

interface Interacting {
  is: 'interacting';
  was: 'running' | 'paused';
  timeWasChanged: boolean;
  pointerPos: { x: number; y: number };
  remainingTime: number;
}

const sec_to_ms = (s: number): number => s * 1000;
const min_to_ms = (m: number): number => sec_to_ms(m * 60);

const TAP_DRAG_TOLERANCE = 12; // px
const OVERLAY_TIMEOUT = sec_to_ms(5); // ms

const SpiralTimer = () => {
  const [state, setState] = useState<Running | Paused | Interacting>({
    is: 'paused',
    remainingTime: min_to_ms(10),
  });

  const [displayTime, setDisplayTime] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const intervalRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Screen wake lock acquired');
      }
    } catch (err) {
      console.error('Failed to acquire wake lock:', err);
    }
  }, []);

  // Release wake lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Initialize wake lock and burn-in prevention
  useEffect(() => {
    requestWakeLock();

    // Handle visibility change to re-acquire wake lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock, releaseWakeLock]);

  // Timer logic
  useEffect(() => {
    if (state.is === 'interacting' && state.timeWasChanged) {
      setDisplayTime(ceilMinutes(state.remainingTime));
    } else if (state.is === 'running') {
      intervalRef.current = setInterval(() => {
        setDisplayTime(() => {
          const timeRemaining = state.endTime - Date.now();
          if (timeRemaining <= 0) {
            setState({ is: 'paused', remainingTime: 0 });
            return 0;
          }
          return timeRemaining;
        });
      }, 500);
    } else {
      setDisplayTime(state.remainingTime);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    if (state.is === 'running') {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), OVERLAY_TIMEOUT);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas drawing
  const drawSpiral = useCallback(() => {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const timeToShow = displayTime;

    const hours = timeToShow / (60 * 60 * 1000);
    const baseRadius = Math.min(rect.width, rect.height) * 0.3;
    const radiusSpacing = 25;

    // Apply subtle burn-in prevention scaling
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    ctx.save();

    ctx.strokeStyle = '#ef4444';
    ctx.lineCap = 'round';

    const totalRevolutions = Math.ceil(hours);

    for (let rev = 0; rev < totalRevolutions; rev++) {
      ctx.lineWidth = 8 * (1 - rev / 12) ** 0.25;
      const radius = baseRadius - rev ** 0.93 * radiusSpacing;
      const revolutionStart = rev * 60 * 60 * 1000;
      const revolutionEnd = (rev + 1) * 60 * 60 * 1000;

      let revolutionTime: number;
      if (timeToShow >= revolutionEnd) {
        revolutionTime = min_to_ms(60);
      } else if (timeToShow > revolutionStart) {
        revolutionTime = timeToShow - revolutionStart;
      } else {
        continue;
      }

      const endAngle = (revolutionTime / min_to_ms(60)) * 2 * Math.PI - Math.PI / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }, [canvas, windowSize, displayTime]);

  useEffect(() => {
    drawSpiral();
  }, [drawSpiral]);

  // Touch/mouse handling
  const getAngleFromPoint = (pos: { x: number; y: number }) => {
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
  };

  const pointerDown = (pos: { x: number; y: number }) => {
    if (state.is !== 'interacting') {
      setState({
        is: 'interacting',
        was: state.is,
        timeWasChanged: false,
        pointerPos: pos,
        remainingTime: state.is === 'running' ? state.endTime - Date.now() : state.remainingTime,
      });
    }
  };

  const pointerMove = (pos: { x: number; y: number }) => {
    if (state.is !== 'interacting') return;

    const lastPos = state.pointerPos;
    const dist = Math.sqrt((pos.x - lastPos.x) ** 2 + (pos.y - lastPos.y) ** 2);

    if (dist < TAP_DRAG_TOLERANCE || state.timeWasChanged) {
      const lastAngle = getAngleFromPoint(lastPos);
      const currentAngle = getAngleFromPoint(pos);
      let deltaAngle = currentAngle - lastAngle;

      if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;

      const deltaTime = (deltaAngle / (2 * Math.PI)) * min_to_ms(60);
      const newDuration = Math.max(0, state.remainingTime + deltaTime);

      setState({ ...state, timeWasChanged: true, pointerPos: pos, remainingTime: newDuration });
    }
  };

  const pointerUp = () => {
    if (state.is !== 'interacting') return;

    let nextState: 'running' | 'paused';
    let remainingTime: number;
    if (state.timeWasChanged) {
      nextState = state.was;
      remainingTime = ceilMinutes(state.remainingTime);
    } else if (state.was === 'running') {
      nextState = 'paused';
      remainingTime = state.remainingTime;
    } else {
      nextState = 'running';
      remainingTime = state.remainingTime;
    }

    if (nextState === 'running') {
      setState({ is: 'running', endTime: Date.now() + remainingTime });
    } else {
      setState({ is: 'paused', remainingTime: remainingTime });
    }
  };

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
      <canvas
        ref={setCanvas}
        className="w-full h-full cursor-pointer breathe-animation"
        onMouseDown={(e) => pointerDown({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => pointerMove({ x: e.clientX, y: e.clientY })}
        onMouseUp={pointerUp}
        onMouseLeave={pointerUp}
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          pointerDown({ x: touch.clientX, y: touch.clientY });
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          pointerMove({ x: touch.clientX, y: touch.clientY });
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          pointerUp();
        }}
      />

      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
        }`}
        style={{ zIndex: 10 }}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none">
          <div className="text-2xl font-mono text-gray-300">{formatTime(displayTime)}</div>
        </div>
      </div>
    </div>
  );
};

export default SpiralTimer;

const ceilMinutes = (duration: number, minutes: number = 1): number =>
  Math.ceil(duration / min_to_ms(minutes)) * min_to_ms(minutes);

const roundToMinutes = (duration: number, minutes: number = 1): number =>
  Math.round(duration / min_to_ms(minutes)) * min_to_ms(minutes);
