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

export const formatDurationSr = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    // e.g. "1 hour 05 minutes" in user's locale
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(hours, 'hours');
  }
  // e.g. "5 minutes" in user's locale
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(minutes, 'minute');
};

export const formatTimeSr = (timestamp: number) => {
  // e.g. "4:05 PM" in user's locale
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

export const formatDurationMinutes = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
  }
  return `${seconds}"`;
};

export const formatDurationMinutesSr = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes} minutes ${seconds} seconds`;
  }
  return `${seconds} seconds`;
};
