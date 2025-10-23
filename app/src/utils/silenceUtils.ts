/**
 * Utility functions for silence detection and management
 */

/**
 * Generates a unique key for a silence region based on start and end times
 * @param start - Start time in seconds
 * @param end - End time in seconds
 * @returns Unique string key for the silence region
 */
export function getSilenceRegionKey(start: number, end: number): string {
  return `${start.toFixed(2)}-${end.toFixed(2)}`;
}

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2.5s" or "1m 30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Formats a timestamp in seconds to MM:SS.S format
 * @param seconds - Timestamp in seconds
 * @returns Formatted timestamp string
 */
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
}

