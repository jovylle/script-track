import type { TranscriptSegment } from '../types';

/**
 * Merges speech and silence segments and sorts them by start time
 * @param speechSegments - Array of speech segments
 * @param silenceSegments - Array of silence segments
 * @returns Combined and sorted array of all segments
 */
export function mergeTranscriptWithSilence(
  speechSegments: TranscriptSegment[],
  silenceSegments: TranscriptSegment[]
): TranscriptSegment[] {
  const allSegments = [...speechSegments, ...silenceSegments];
  return sortSegmentsByTime(allSegments);
}

/**
 * Sorts transcript segments by start time
 * @param segments - Array of transcript segments
 * @returns Sorted array of segments
 */
export function sortSegmentsByTime(segments: TranscriptSegment[]): TranscriptSegment[] {
  return [...segments].sort((a, b) => a.start - b.start);
}

/**
 * Finds the segment that is active at a given time
 * @param segments - Array of transcript segments
 * @param time - Time in seconds
 * @returns The active segment or null if none found
 */
export function getSegmentAtTime(segments: TranscriptSegment[], time: number): TranscriptSegment | null {
  return segments.find(seg => time >= seg.start && time <= seg.end) || null;
}

/**
 * Filters segments to only include those marked as 'keep'
 * @param segments - Array of transcript segments
 * @returns Array of segments to keep
 */
export function getSegmentsToKeep(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => s.keep);
}

/**
 * Filters out silence segments to get only speech
 * @param segments - Array of transcript segments
 * @returns Array of speech segments only
 */
export function getSpeechSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.filter(s => !s.isSilence);
}

