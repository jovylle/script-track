/**
 * Core TypeScript type definitions for script-track application
 */

/**
 * Represents a single segment of the transcript
 * Can be either a spoken word or a silence region
 */
export interface TranscriptSegment {
  /** Unique identifier for the segment */
  id: number | string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Text content (word or silence description) */
  text: string;
  /** Whether this segment should be kept in the export */
  keep: boolean;
  /** Whether this segment represents silence (vs speech) */
  is_silence?: boolean;
  /** Whether this segment was split due to silence detection */
  isSplit?: boolean;
  /** Type of segment: word, gap, or silence */
  segment_type?: "word" | "gap" | "silence";
}

/**
 * Represents a detected silence region from FFmpeg analysis
 */
export interface SilenceRegion {
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Duration in seconds */
  duration: number;
}

/**
 * Result from transcription process
 */
export interface TranscriptionResult {
  /** Array of transcript segments */
  segments: TranscriptSegment[];
  /** Total duration of the video in seconds */
  duration: number;
}

/**
 * Video player state
 */
export interface VideoPlayerState {
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total video duration in seconds */
  videoDuration: number;
}

/**
 * Silence detection settings
 */
export interface SilenceSettings {
  /** Noise level threshold in dB (-50 to -10) */
  noiseThreshold: number;
  /** Minimum silence duration in seconds */
  minSilenceDuration: number;
}

/**
 * Audio level data point for visualization
 */
export interface AudioLevel {
  /** Timestamp in seconds */
  timestamp: number;
  /** Volume level in dB */
  volume_db: number;
}

