# Data Layer

This directory contains data storage and management for transcripts and metadata.

## File Types

- `*.json` - Transcript data with timestamps
- `*.srt` - Subtitle files
- `*.vtt` - WebVTT subtitle files
- `metadata/` - Video metadata and project files

## Data Format

```json
[
  {
    "id": 1,
    "start": 0.0,
    "end": 3.5,
    "text": "Welcome to script-track",
    "keep": true,
    "speaker": "speaker_1"
  }
]
```
