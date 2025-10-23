# Script-Track Architecture

## Overview
Script-Track is a desktop application built with Tauri (Rust + React) for editing screen recordings by manipulating transcribed words. Users can remove silence, edit individual words, and export clean videos.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **Audio Processing**: FFmpeg
- **Speech Recognition**: Whisper CLI
- **UI Framework**: Custom CSS with dark theme

## Project Structure

```
app/src/
├── components/          # React components (planned)
├── hooks/              # Custom React hooks (planned)
├── utils/              # Utility functions
│   ├── transcriptUtils.ts
│   ├── silenceUtils.ts
│   └── fileUtils.ts
├── types/              # TypeScript interfaces
│   └── index.ts
├── App.tsx             # Main application component
├── App.css             # Global styles
└── main.tsx            # React entry point

app/src-tauri/src/
├── lib.rs              # Rust backend logic
└── main.rs             # Tauri entry point
```

## Data Flow

### 1. Video Upload & Transcription
```
User drops video → Tauri saves to temp_uploads/ → Whisper CLI transcribes → 
JSON parsed → Word segments created → React state updated
```

### 2. Silence Detection
```
User clicks "Detect Silence" → FFmpeg analyzes audio → Silence regions detected → 
Smart splitting algorithm → Word segments trimmed → Silence segments added → 
UI updated with new segments
```

### 3. Word Editing
```
User clicks word → Action panel appears → User edits/removes → 
State updated → Export includes changes
```

### 4. Video Export
```
User clicks "Export Video" → FFmpeg processes video → Segments filtered by keep:true → 
Video exported → File location opened
```

## Core Components (Planned)

### VideoPlayer Component
- **Props**: `videoFile`, `currentTime`, `onTimeUpdate`, `onPlay`, `onPause`
- **Features**: Custom timeline, playback controls, progress tracking
- **State**: Play/pause, current time, duration

### Transcript Component
- **Props**: `transcript`, `selectedWordId`, `onWordClick`, `onWordEdit`
- **Features**: Word display, editing interface, action panels
- **State**: Selected word, editing mode, action panel visibility

### SilenceControls Component
- **Props**: `noiseThreshold`, `minSilenceDuration`, `onDetectSilence`
- **Features**: Settings sliders, preset buttons, bulk actions
- **State**: Settings values, detection status

### ExportPanel Component
- **Props**: `isExporting`, `exportedFilePath`, `onExport`
- **Features**: Export button, progress indicator, file location
- **State**: Export status, progress, file path

## Custom Hooks (Planned)

### useVideoPlayer
- Manages video playback state
- Handles time updates and seeking
- Controls play/pause functionality

### useTranscript
- Manages transcript state and history
- Handles word editing and selection
- Provides undo/redo functionality

### useSilenceDetection
- Manages silence detection settings
- Handles FFmpeg analysis
- Processes silence regions

## State Management

### Global State (App.tsx)
- `videoFile`: Blob URL for video player
- `videoPath`: Actual file path for backend
- `transcript`: Array of transcript segments
- `selectedWordId`: Currently selected word
- `noiseThreshold`: Silence detection sensitivity
- `minSilenceDuration`: Minimum silence duration
- `isExporting`: Export status
- `exportedFilePath`: Path to exported file

### Local State (Components)
- Component-specific UI state
- Form inputs and temporary values
- Modal and panel visibility

## Backend Architecture

### Tauri Commands (lib.rs)
- `transcribe_video`: Runs Whisper CLI and parses JSON
- `detect_audio_silence`: Uses FFmpeg to find silence regions
- `export_video`: Processes video with segment filtering
- `analyze_audio_levels`: Gets detailed audio analysis
- `play_audio_segment`: Plays specific audio segments
- `play_test_tone`: Generates test tones for calibration
- `open_file_location`: Opens file explorer

### Data Structures
```rust
struct TranscriptSegment {
    id: u32,
    start: f64,
    end: f64,
    text: String,
    keep: bool,
}

struct SilenceRegion {
    start: f64,
    end: f64,
    duration: f64,
}
```

## Key Algorithms

### Smart Segment Splitting
1. **Input**: Word segments + Silence regions
2. **Process**: Split overlapping word segments at silence boundaries
3. **Filter**: Remove split segments shorter than minimum duration
4. **Output**: Non-overlapping segments (words + silence)

### Silence Detection
1. **FFmpeg Analysis**: Use `silencedetect` filter
2. **Padding**: Add 0.1s buffer before/after silence
3. **Integration**: Split word segments at silence boundaries
4. **Visualization**: Mark split segments with yellow styling

## Performance Considerations

### Frontend
- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large transcripts (future)

### Backend
- **Async Processing**: Non-blocking FFmpeg operations
- **Temp Files**: Cleanup after processing
- **Error Handling**: Graceful failure recovery

## Security & Privacy

### File Handling
- **Local Processing**: All operations happen locally
- **Temp Storage**: Files stored in temp_uploads/ directory
- **Cleanup**: Temporary files removed after processing

### Data Privacy
- **No Network**: No data sent to external services
- **Local Whisper**: Uses local Whisper installation
- **User Control**: User owns all data and files

## Future Enhancements

### Planned Features
- **Component Extraction**: Modular React architecture
- **Custom Hooks**: Reusable state logic
- **Advanced Editing**: Word-level timestamps
- **Batch Processing**: Multiple video support
- **Preset Management**: Save/load settings

### Technical Improvements
- **Error Boundaries**: Better error handling
- **Loading States**: Improved UX during processing
- **Keyboard Shortcuts**: Power user features
- **Accessibility**: Screen reader support

## Development Guidelines

### Code Organization
- **Single Responsibility**: Each component has one purpose
- **Props Interface**: Clear component contracts
- **Type Safety**: Full TypeScript coverage
- **Documentation**: JSDoc for all functions

### Testing Strategy
- **Unit Tests**: Component and utility testing
- **Integration Tests**: End-to-end workflows
- **Performance Tests**: Large file handling
- **User Testing**: Real-world usage scenarios