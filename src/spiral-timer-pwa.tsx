import React, { useState, useEffect, useRef, useCallback } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const SpiralTimer = () => {
  const [duration, setDuration] = useState(min_to_ms(10));
  const [remainingTime, setRemainingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [burnInOffset, setBurnInOffset] = useState(0);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const intervalRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const burnInIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const prevAngleRef = useRef(0);
  const cumulativeDTRef = useRef(0);

  const roundedDuration = ceilMinutes(duration);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("Screen wake lock acquired");
      }
    } catch (err) {
      console.error("Failed to acquire wake lock:", err);
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
      setBurnInOffset((prev) => (prev + 0.003) % 0.02); // Very subtle scale variation
    }, 30000);

    // Handle visibility change to re-acquire wake lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      releaseWakeLock();
      if (burnInIntervalRef.current) clearInterval(burnInIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestWakeLock, releaseWakeLock]);

  // Timer logic
  useEffect(() => {
    if (isRunning && !isPaused && remainingTime > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
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

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Canvas drawing
  const drawSpiral = useCallback(() => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const timeToShow = isDragging
      ? roundedDuration
      : isRunning || isPaused
      ? remainingTime
      : roundedDuration;
    if (timeToShow <= 0) return;

    const hours = timeToShow / (60 * 60 * 1000);
    const baseRadius = Math.min(rect.width, rect.height) * 0.3;
    const radiusSpacing = 25;

    // Apply subtle burn-in prevention scaling
    const scale = 1 + burnInOffset;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    ctx.save();

    ctx.strokeStyle = "#ef4444";
    ctx.lineCap = "round";

    const totalRevolutions = Math.ceil(hours);

    for (let rev = 0; rev < totalRevolutions; rev++) {
      ctx.lineWidth = 8 * (1 - (rev / 12)) ** 0.25;
      const radius = baseRadius - rev ** 0.93 * radiusSpacing;
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

      const endAngle =
        (revolutionTime / (60 * 60 * 1000)) * 2 * Math.PI - Math.PI / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }, [
    canvas,
    windowSize,
    duration,
    roundedDuration,
    remainingTime,
    isRunning,
    isPaused,
    burnInOffset,
  ]);

  useEffect(() => {
    drawSpiral();
  }, [drawSpiral]);

  // Touch/mouse handling
  const getAngleFromPoint = (clientX: number, clientY: number) => {
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
  };

  const dragStart = (clientX: number, clientY: number) => {
    if (isRunning) return;

    setIsDragging(true);
    prevAngleRef.current = getAngleFromPoint(clientX, clientY);
    cumulativeDTRef.current = 0;
  };

  const drag = (clientX: number, clientY: number) => {
    if (!isDragging || isRunning) return;

    const currentAngle = getAngleFromPoint(clientX, clientY);
    let deltaAngle = currentAngle - prevAngleRef.current;

    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;

    const deltaTime = (deltaAngle / (2 * Math.PI)) * 60 * min_to_ms(1);
    const newDuration = Math.max(0, duration + deltaTime);

    setDuration(newDuration);
    prevAngleRef.current = currentAngle;
    cumulativeDTRef.current += Math.abs(deltaTime);
  };

  const dragEnd = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = () => {
    if (cumulativeDTRef.current > min_to_ms(1)) {
      setRemainingTime(roundedDuration);
      return; // Dragged to change duration
    }
    setShowControls(!showControls);
  };

  const startTimer = () => {
    if (roundedDuration > 0) {
      setIsRunning(true);
      setIsPaused(false);
      if (remainingTime === 0) {
        setRemainingTime(roundedDuration);
      }
    }
  };

  const pauseTimer = () => {
    setIsPaused(!isPaused);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRemainingTime(roundedDuration);
  };

  const formatTime = (ms) => {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
      <canvas
        ref={setCanvas}
        className="w-full h-full cursor-pointer breathe-animation"
        onClick={handleCanvasClick}
        onMouseDown={(e) => dragStart(e.clientX, e.clientY)}
        onMouseMove={(e) => drag(e.clientX, e.clientY)}
        onMouseUp={dragEnd}
        onMouseLeave={dragEnd}
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          dragStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const touch = e.touches[0];
          drag(touch.clientX, touch.clientY);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          dragEnd();
        }}
      />

      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out ${
          showControls
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-8"
        }`}
        style={{ zIndex: 10 }}
      >
        {/* Duration display while dragging or setting */}
        {(isDragging || (!isRunning && !isPaused && roundedDuration > 0)) &&
          showControls && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none">
              <div className="text-2xl font-mono text-gray-300">
                {formatTime(roundedDuration)}
              </div>
            </div>
          )}

        {/* Running time display */}
        {(isRunning || isPaused) && showControls && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none">
            <div className="text-2xl font-mono text-gray-300">
              {formatTime(remainingTime)}
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-8 pointer-events-auto flex items-center justify-center ">
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
            onClick={() => setDuration((prev) => prev + min_to_ms(5))}
            className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors text-xl"
          >
            +
          </button>
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

const min_to_ms = (m: number): number => m * 60 * 1000;
