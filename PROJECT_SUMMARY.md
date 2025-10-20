# 🎬 script-track - Project Summary

> *Edit your screen recordings by editing the words you spoke.*

## 🧭 Vision

A **local-first**, **open-source** alternative to **Descript**, focused on letting creators and developers trim or rewrite videos using the transcript instead of a full video timeline.
Built for privacy, speed, and open contribution.

**Tagline:** "Edit by text. 100% local. Zero subscriptions."

## 🧠 Problem

Video editing is still manual and slow.
Descript solved it with AI + text editing, but it's **expensive** and **closed-source**.
Developers, educators, and content creators need a **private**, **offline**, and **hackable** tool to:

* see spoken words on the timeline,
* cut mistakes fast,
* and export clean results — without cloud uploads.

## 🚀 MVP Scope (Week 1)

**Goal:** A working proof of concept that connects text to video.

1. Import video/audio (MP4, WebM, WAV).
2. Auto-transcribe with Whisper / WhisperX.
3. Display transcript with timestamps.
4. Click a sentence → jump playback.
5. Delete lines → export new cut via FFmpeg.

**Stretch goals:**

* Basic silence detection
* Simple waveform view
* Auto-subtitle export (.srt)

## 🧩 Architecture (Phase 1)

| Layer  | Tool                   | Purpose                          |
| ------ | ---------------------- | -------------------------------- |
| UI     | **Tauri + React**      | Cross-platform desktop interface |
| Engine | **Whisper / WhisperX** | Local transcription + timestamps |
| Core   | **FFmpeg**             | Trim and merge cuts              |
| Data   | **JSON / SRT**         | Store text ↔ time mapping        |

**Data example:**

```json
[
  { "id": 1, "start": 0.0, "end": 3.5, "text": "Welcome to script-track", "keep": true },
  { "id": 2, "start": 3.6, "end": 6.1, "text": "Oops I made a mistake", "keep": false }
]
```

## 🧰 Folder layout

```
script-track/
 ├─ app/        # Tauri + React UI
 ├─ core/       # FFmpeg logic
 ├─ engine/     # Whisper integration
 ├─ data/       # Transcripts & metadata
 ├─ docs/
 └─ samples/
```

## 🗓 Roadmap (Phase 1 → Phase 2)

| Phase    | Goal                                                    |
| -------- | ------------------------------------------------------- |
| Week 1   | MVP: import, transcribe, delete text → export new video |
| Week 2–3 | Add silence detection, timeline UI                      |
| Month 2  | Word-level alignment (WhisperX) + speaker labels        |
| Month 3  | Text-based rewrite, voice-re-sync                       |
| Month 4  | Optional web version (React + MediaRecorder API)        |

## 🧱 Immediate next steps

1. Create GitHub repo **`script-track`** (MIT license).
2. Add README with problem → solution → roadmap.
3. Create initial issues:

   * [ ] MVP Checklist
   * [ ] Transcript UI
   * [ ] Whisper integration
   * [ ] FFmpeg cut/export
   * [ ] App packaging
4. Push starter scaffolding (`npx create-tauri-app` or `create-react-app` + `tauri` plugin).
5. Add Whisper + FFmpeg bindings later.

## 🧩 Long-term potential

* Become the **open Descript** of the developer world.
* Offer **plugin API** for silence detection, filler-word removal, or voice cloning.
* Attract contributors from AI + video editing communities.

## 🚀 Getting Started

Once you move into **VS Code or Cursor**, just tell your Copilot:

> "Create a new Tauri + React app for script-track.
> Goal: import a video, transcribe with Whisper, display transcript, and allow deleting lines to export via FFmpeg."

---

*This summary was created for future AI conversations and project reference.*
