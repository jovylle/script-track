# 🎬 script-track

> *Edit your screen recordings by editing the words you spoke.*
<img width="885" height="768" alt="image" src="https://github.com/user-attachments/assets/3f5fca20-315f-492e-9628-cb020d7a7f4f" />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Local-first](https://img.shields.io/badge/Privacy-Local--first-green.svg)](https://github.com/script-track/script-track)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-blue.svg)](https://github.com/script-track/script-track)


<img width="1164" height="718" alt="image" src="https://github.com/user-attachments/assets/4e1a1cfd-2869-4e0a-9530-84bc5f449bc8" />

<img width="1072" height="716" alt="image" src="https://github.com/user-attachments/assets/df12acb7-cd5b-4aad-a4ab-af19b3abe2e5" />

A **local-first**, **open-source** alternative to Descript, focused on letting creators and developers trim or rewrite videos using the transcript instead of a full video timeline.

## ✨ Features

- 🎥 **Import** video/audio files (MP4, WebM, WAV)
- 🎤 **Auto-transcribe** with Whisper/WhisperX
- 📝 **Edit by text** - click sentences to jump, delete lines to cut
- 🔒 **100% local** - no cloud uploads, complete privacy
- ⚡ **Fast** - built with Tauri for native performance
- 🆓 **Free** - zero subscriptions, open source

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/script-track/script-track.git
cd script-track

# Install dependencies
npm install

# Run the development server
npm run dev
```

## 🧩 Architecture

| Layer  | Tool                   | Purpose                          |
| ------ | ---------------------- | -------------------------------- |
| UI     | **Tauri + React**      | Cross-platform desktop interface |
| Engine | **Whisper / WhisperX** | Local transcription + timestamps |
| Core   | **FFmpeg**             | Trim and merge cuts              |
| Data   | **JSON / SRT**         | Store text ↔ time mapping        |

## 📁 Project Structure

```
script-track/
├── app/           # Tauri + React UI
├── core/          # FFmpeg logic
├── engine/        # Whisper integration
├── data/          # Transcripts & metadata
├── docs/          # Documentation
├── samples/       # Sample files
└── PROJECT_SUMMARY.md  # Detailed project summary
```

## 🗓 Roadmap

### Phase 1 (MVP)
- [x] Project setup and documentation
- [ ] Video/audio import
- [ ] Whisper transcription integration
- [ ] Transcript UI with timestamps
- [ ] Click-to-jump playback
- [ ] Delete lines → export via FFmpeg

### Phase 2 (Enhanced)
- [ ] Silence detection
- [ ] Waveform visualization
- [ ] SRT subtitle export
- [ ] Word-level alignment (WhisperX)
- [ ] Speaker labels

### Phase 3 (Advanced)
- [ ] Text-based rewrite
- [ ] Voice re-sync
- [ ] Plugin API
- [ ] Web version

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Whisper](https://github.com/openai/whisper) for speech recognition
- [Tauri](https://tauri.app/) for the desktop framework
- [FFmpeg](https://ffmpeg.org/) for video processing
- [Descript](https://www.descript.com/) for inspiration

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Report Issues](https://github.com/script-track/script-track/issues)
- 💬 [Discussions](https://github.com/script-track/script-track/discussions)

---

**Tagline:** "Edit by text. 100% local. Zero subscriptions."
