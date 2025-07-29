import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

const SpiralTimer = () => {
  const [duration, setDuration] = useState(0); // in milliseconds
  const [remainingTime, setRemainingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [burnInOffset, setBurnInOffset] = useState(0);
  
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const burnInIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const startAngleRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);
  const hasDraggedRef = useRef(false);

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
    
    // Subtle burn-in prevention animation (scale changes every 30 seconds)
    burnInIntervalRef.current = setInterval(() => {
      setBurnInOffset(prev => (prev + 0.003) % 0.02); // Very subtle scale variation
    }, 30000);

    // Handle visibility change to re-acquire wake lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      if (burnInIntervalRef.current) clearInterval(burnInIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock, releaseWakeLock]);

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused && remainingTime > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1000) {
            setIsRunning(false);
            setIsPaused(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, remainingTime]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (showControls && !isDragging) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 15000);
    }
  }, [showControls, isDragging]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Canvas drawing
  const drawSpiral = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    centerRef.current = { x: centerX, y: centerY };

    ctx.clearRect(0, 0, rect.width, rect.height);

    const timeToShow = isRunning || isPaused ? remainingTime : duration;
    if (timeToShow <= 0) return;

    const hours = timeToShow / (60 * 60 * 1000);
    const baseRadius = Math.min(rect.width, rect.height) * 0.3;
    const radiusSpacing = 25;
    
    // Apply subtle burn-in prevention scaling
    const scale = 1 + burnInOffset;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    const totalRevolutions = Math.ceil(hours);
    
    for (let rev = 0; rev < totalRevolutions; rev++) {
      const radius = baseRadius + (rev * radiusSpacing);
      const revolutionStart = rev * 60 * 60 * 1000;
      const revolutionEnd = (rev + 1) * 60 * 60 * 1000;
      
      let revolutionTime;
      if (timeToShow >= revolutionEnd) {
        revolutionTime = 60 * 60 * 1000; // Full hour
      } else if (timeToShow > revolutionStart) {
        revolutionTime = timeToShow - revolutionStart;
      } else {
        continue;
      }

      const endAngle = (revolutionTime / (60 * 60 * 1000)) * 2 * Math.PI - Math.PI / 2;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }, [duration, remainingTime, isRunning, isPaused, burnInOffset]);

  useEffect(() => {
    drawSpiral();
  }, [drawSpiral]);

  // Touch/mouse handling
  const getAngleFromPoint = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
  };

  const handleStart = (clientX, clientY) => {
    dragStartTime.current = Date.now();
    hasDraggedRef.current = false;
    
    if (!isRunning) {
      setIsDragging(true);
      setShowControls(true);
      startAngleRef.current = getAngleFromPoint(clientX, clientY);
    }
  };

  const handleMove = (clientX, clientY) => {
    if (!isDragging || isRunning) return;

    hasDraggedRef.current = true;
    const currentAngle = getAngleFromPoint(clientX, clientY);
    let deltaAngle = currentAngle - startAngleRef.current;
    
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;

    const deltaTime = (deltaAngle / (2 * Math.PI)) * 60 * 60 * 1000;
    const newDuration = Math.max(0, duration + deltaTime);
    
    setDuration(newDuration);
    setRemainingTime(newDuration);
    startAngleRef.current = currentAngle;
  };

  const handleEnd = () => {
    const wasTap = !hasDraggedRef.current && (Date.now() - dragStartTime.current) < 300;
    
    setIsDragging(false);
    
    // Handle tap to show/hide controls
    if (wasTap) {
      setShowControls(!showControls);
    }
  };

  const handleCanvasClick = (e) => {
    // This is now handled in handleEnd to avoid conflicts
  };

  const startTimer = () => {
    if (duration > 0) {
      setIsRunning(true);
      setIsPaused(false);
      if (remainingTime === 0) {
        setRemainingTime(duration);
      }
    }
  };

  const pauseTimer = () => {
    setIsPaused(!isPaused);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRemainingTime(duration);
  };

  const formatTime = (ms) => {
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
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleCanvasClick}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          handleStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          handleMove(touch.clientX, touch.clientY);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleEnd();
        }}
      />
      
      {showControls && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Duration display while dragging or setting */}
          {(isDragging || (!isRunning && !isPaused && duration > 0)) && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none">
              <div className="text-2xl font-mono text-gray-300">
                T- {formatTime(duration)}
              </div>
            </div>
          )}
          
          {/* Running time display */}
          {(isRunning || isPaused) && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none">
              <div className="text-2xl font-mono text-gray-300">
                T- {formatTime(remainingTime)}
              </div>
            </div>
          )}
          
          {/* Control buttons */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-8 pointer-events-auto">
            <button
              onClick={resetTimer}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
            >
              <RotateCcw size={20} />
            </button>
            
            <button
              onClick={isRunning ? pauseTimer : startTimer}
              disabled={duration === 0}
              className="w-16 h-16 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-full flex items-center justify-center transition-colors"
            >
              {isRunning && !isPaused ? <Pause size={24} /> : <Play size={24} />}
            </button>
            
            <button
              onClick={() => setDuration(prev => prev + 5 * 60 * 1000)}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors text-xl"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiralTimer;