# Script-Track Architecture

## Overview

Script-Track is a desktop application built with Tauri + React that allows users to edit screen recordings by editing the transcript. The app transcribes video/audio using Whisper, detects silence regions, and allows users to cut segments by removing words or silence.

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Transcription**: Whisper CLI (OpenAI)
- **Video Processing**: FFmpeg
- **Styling**: CSS (component-based)

## Directory Structure

```
app/
├── src/
│   ├── components/          # React components
│   │   ├── VideoPlayer.tsx  # Video playback with custom controls
│   │   ├── Transcript.tsx   # Transcript display and editing
│   │   ├── SilenceControls.tsx # Silence detection settings
│   │   └── ExportPanel.tsx  # Export controls and progress
│   ├── hooks/              # Custom React hooks
│   │   ├── useVideoPlayer.ts    # Video playback state management
│   │   ├── useTranscript.ts     # Transcript state and editing
│   │   └── useSilenceDetection.ts # Silence detection logic
│   ├── utils/              # Utility functions
│   │   ├── transcriptUtils.ts   # Transcript manipulation
│   │   ├── silenceUtils.ts      # Silence detection helpers
│   │   └── fileUtils.ts         # File handling utilities
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # All interfaces and types
│   ├── App.tsx            # Main application component
│   ├── App.css            # Global styles
│   └── main.tsx           # Application entry point
├── src-tauri/             # Rust backend
│   └── src/
│       └── lib.rs         # Tauri commands and backend logic
└── ARCHITECTURE.md        # This file

## Data Flow

### 1. Video Upload
```
User drops/selects video
  ↓
Frontend creates blob URL (for player)
  ↓
Backend saves file to temp_uploads/
  ↓
Frontend stores both blob URL and actual file path
```

### 2. Transcription
```
User clicks Transcribe
  ↓
Frontend calls transcribe_audio command
  ↓
Backend runs Whisper CLI on video file
  ↓
Whisper generates word-level JSON
  ↓
Backend parses JSON and returns segments
  ↓
Frontend displays segments in transcript
```

### 3. Silence Detection
```
User clicks Detect (Audio-Based)
  ↓
Frontend calls detect_audio_silence command
  ↓
Backend runs FFmpeg with silencedetect filter
  ↓
Backend parses FFmpeg output for silence regions
  ↓
Frontend creates silence segments (keep: true by default)
  ↓
Frontend merges speech + silence and displays
```

### 4. Editing
```
User clicks word/silence segment
  ↓
Action panel appears
  ↓
User can:
  - Exclude/Include segment (toggle keep flag)
  - Edit text (speech segments only)
  - Use bulk actions (Exclude All / Include All)
```

### 5. Export
```
User clicks Export
  ↓
Frontend filters segments (keep: true)
  ↓
Frontend calls export_video command
  ↓
Backend creates FFmpeg filter_complex
  ↓
Backend trims and concatenates segments
  ↓
Backend saves edited video
  ↓
Frontend shows success + file location button
```

## Component Hierarchy

```
App
├── VideoPlayer
│   ├── Video element
│   ├── Custom timeline (progress bar + scrubber)
│   └── Play/pause controls
├── Transcript
│   ├── Inline word display
│   ├── Word hover tooltips
│   ├── Word action panels (cut/edit)
│   └── Segment highlighting (active/selected/removed)
├── SilenceControls
│   ├── Noise level slider
│   ├── Min duration slider
│   ├── Detect button
│   └── Bulk action buttons (Exclude All / Include All)
└── ExportPanel
    ├── Export button
    ├── Progress bar
    └── Open file location button
```

## Custom Hooks

### useVideoPlayer
Manages video playback state and controls
- **State**: videoElement, isPlaying, currentTime, videoDuration
- **Functions**: play(), pause(), seek(), handleTimeUpdate()
- **Effects**: Keyboard shortcuts (Space, Arrow keys)

### useTranscript
Manages transcript state and editing operations
- **State**: transcript, transcriptHistory, historyIndex, editingSegment
- **Functions**: toggleSegment(), startEdit(), saveEdit(), undo(), redo()
- **Effects**: Saves to history on changes

### useSilenceDetection
Manages silence detection settings and operations
- **State**: noiseThreshold, minSilenceDuration, hasSilenceDetection
- **Functions**: detectSilence(), excludeAllSilence(), includeAllSilence()
- **Integration**: Calls Tauri backend commands

## State Management

### Global State (in App.tsx)
- File upload state (videoFile, videoPath, isUploading)
- Transcription state (isTranscribing, transcriptionProgress)
- Export state (isExporting, exportProgress, exportedFilePath)
- Selected word state (selectedWordId)

### Hook-Managed State
- Video playback (useVideoPlayer)
- Transcript data (useTranscript)
- Silence settings (useSilenceDetection)

## Tauri Commands (Backend)

### `save_uploaded_file(fileData, filename)`
- Saves uploaded file to temp_uploads directory
- Returns absolute file path

### `transcribe_audio(filePath)`
- Runs Whisper CLI on video file
- Returns TranscriptionResult with word-level segments

### `detect_audio_silence(filePath, noiseThreshold, minDuration)`
- Runs FFmpeg silencedetect filter
- Parses output and returns SilenceRegion[]

### `export_video(inputPath, outputPath, segments)`
- Filters segments for keep: true
- Creates FFmpeg filter_complex
- Exports edited video

### `get_video_duration(filePath)`
- Returns video duration in seconds

### `open_file_location(filePath)`
- Opens file location in system file manager (Finder/Explorer)

### `log_to_terminal(message)`
- Logs message to terminal (for debugging)

## Key Interfaces

### TranscriptSegment
```typescript
{
  id: number | string;
  start: number;        // seconds
  end: number;          // seconds
  text: string;
  keep: boolean;        // include in export
  isSilence?: boolean;  // silence vs speech
}
```

### SilenceRegion
```typescript
{
  start: number;    // seconds
  end: number;      // seconds
  duration: number; // seconds
}
```

## Design Decisions

### Why Silence Defaults to Included (keep: true)
Initially, silence was excluded by default (keep: false), which created UX confusion. Users expected to see silence in the export by default, then manually exclude unwanted parts. Changed to keep: true for intuitive behavior.

### Why Remove Gap-Based Fallback
The gap-based detection method (analyzing gaps between words) was less accurate and confusing. FFmpeg's audio-based detection is superior, so we simplified to only use that method.

### Why Custom Video Controls
Built-in browser video controls don't provide the level of control needed for precise editing. Custom timeline allows:
- Click-to-seek
- Visual progress indication
- Integration with transcript playback
- Keyboard shortcuts

### Why Component Extraction
Original App.tsx was 1350+ lines, making it hard to maintain. Extracted components:
- Improve code readability
- Enable independent testing
- Allow component reuse
- Separate concerns clearly

## Future Improvements

1. **Performance**: Virtualize transcript for large videos (thousands of words)
2. **Storage**: Implement project save/load functionality
3. **Export Options**: Add quality settings, codec selection
4. **Batch Processing**: Support multiple videos at once
5. **Waveform Display**: Visual audio waveform in timeline
6. **Undo/Redo UI**: Visible undo/redo buttons
7. **Keyboard Shortcuts**: More editing shortcuts
8. **Export Presets**: Save common export configurations

