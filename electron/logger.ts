function formatTimestamp(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'P' : 'A';
  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;
  return `${hours}:${minutes}:${seconds}${ampm}`;
}

export function logger(
  src: string,
  action: 'error' | 'disabled' | 'info' | 'default' | 'active' | 'update' | 'success' | 'completed',
  message: string,
  level: 'info' | 'log' | 'error' = 'log'
) {
  // Color codes
  const colors: { [key: string]: string } = {
    error: '\x1b[31m', // red
    disabled: '\x1b[31m', // red
    info: '\x1b[34m', // blue
    default: '\x1b[34m', // blue
    active: '\x1b[33m', // yellow
    update: '\x1b[33m', // yellow
    success: '\x1b[32m', // green
    completed: '\x1b[32m', // green
  };
  const RESET = '\x1b[0m';

  // Pick color, fallback to blue if unknown
  const color = colors[action.toLowerCase()] || colors['default'];

  const timestamp = formatTimestamp();

  // Compose the log message
  const log = `${color}[${src.toUpperCase()}_${timestamp}] ${message}${RESET}`;

  console[level](log);
}
