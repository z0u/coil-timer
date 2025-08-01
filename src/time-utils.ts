export const Millisecond = 1;
export const Milliseconds = 1;
export const Second = 1000 * Milliseconds;
export const Seconds = 1000 * Milliseconds;
export const Minute = 60 * Seconds;
export const Minutes = 60 * Seconds;
export const Hour = 60 * Minutes;
export const Hours = 60 * Minutes;

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  return `${minutes}`;
};

export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
