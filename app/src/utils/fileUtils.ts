/**
 * Utility functions for file operations
 */

/**
 * Gets the filename without extension from a full path
 * @param filePath - Full file path
 * @returns Filename without extension
 */
export function getFilenameWithoutExtension(filePath: string): string {
  const filename = filePath.split('/').pop() || filePath;
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Gets the file extension from a path
 * @param filePath - Full file path
 * @returns File extension (e.g., ".mp4")
 */
export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.[^/.]+$/);
  return match ? match[0] : '';
}

