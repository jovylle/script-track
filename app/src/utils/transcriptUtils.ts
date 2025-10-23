import type { TranscriptSegment, SilenceRegion } from '../types';

/**
 * Splits word segments at silence boundaries to avoid overlaps
 * @param wordSegments - Original word segments from Whisper
 * @param silenceRegions - Detected silence regions from FFmpeg
 * @param minSegmentDuration - Minimum duration for split segments (default: 0.3s)
 * @returns Non-overlapping segments (words + silence)
 */
export function splitSegmentsAtSilence(
  wordSegments: TranscriptSegment[],
  silenceRegions: SilenceRegion[],
  minSegmentDuration: number = 0.3
): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  
  for (const word of wordSegments) {
    let remainingSegments = [word];
    
    // For each silence region, split any overlapping segments
    for (const silence of silenceRegions) {
      const newSegments: TranscriptSegment[] = [];
      
      for (const seg of remainingSegments) {
        const splits = splitSegmentBySilence(seg, silence, minSegmentDuration);
        newSegments.push(...splits);
      }
      
      remainingSegments = newSegments;
    }
    
    result.push(...remainingSegments);
  }
  
  // Add silence segments
  const silenceSegments = silenceRegions.map((region, i) => ({
    id: `silence-${i}-${Date.now()}`,
    start: region.start,
    end: region.end,
    text: `[Silence: ${region.duration.toFixed(1)}s]`,
    keep: true,
    isSilence: true
  }));
  
  result.push(...silenceSegments);
  
  // Sort by start time and return
  return result.sort((a, b) => a.start - b.start);
}

/**
 * Splits a single segment by a silence region
 * Returns array of segments (before silence, after silence, or unchanged)
 */
function splitSegmentBySilence(
  segment: TranscriptSegment,
  silence: SilenceRegion,
  minSegmentDuration: number
): TranscriptSegment[] {
  // No overlap - return original segment
  if (segment.end <= silence.start || segment.start >= silence.end) {
    return [segment];
  }
  
  const result: TranscriptSegment[] = [];
  
  // Part before silence
  if (segment.start < silence.start) {
    const beforeDuration = silence.start - segment.start;
    // Only keep if it's long enough to contain meaningful speech
    if (beforeDuration >= minSegmentDuration) {
      result.push({
        ...segment,
        id: `${segment.id}-before`,
        end: silence.start,
        text: segment.text,
        isSplit: true // Mark as split segment
      });
    }
  }
  
  // Part after silence
  if (segment.end > silence.end) {
    const afterDuration = segment.end - silence.end;
    // Only keep if it's long enough to contain meaningful speech
    if (afterDuration >= minSegmentDuration) {
      result.push({
        ...segment,
        id: `${segment.id}-after`,
        start: silence.end,
        text: segment.text,
        isSplit: true // Mark as split segment
      });
    }
  }
  
  // If segment is completely inside silence, discard it
  // (it will be replaced by the silence segment)
  
  return result;
}

/**
 * Merges speech and silence segments and sorts them by start time
 * @deprecated Use splitSegmentsAtSilence instead to avoid overlaps
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

