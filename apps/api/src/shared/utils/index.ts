import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique request ID for tracing.
 */
export function generateRequestId(): string {
  return `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Mask sensitive fields for safe logging.
 */
export function maskSensitive(value: string, visibleChars = 6): string {
  if (value.length <= visibleChars) return '***';
  return value.slice(0, visibleChars) + '***';
}
