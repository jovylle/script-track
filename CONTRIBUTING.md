# Contributing to script-track

Thank you for your interest in contributing to script-track! This document provides guidelines and information for contributors.

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/script-track.git`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Commit your changes: `git commit -m 'Add some amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📋 Development Setup

### Prerequisites
- Node.js (v16 or higher)
- Rust (for Tauri)
- FFmpeg (system dependency)
- Python (for Whisper)

### Installation
```bash
# Clone the repository
git clone https://github.com/script-track/script-track.git
cd script-track

# Install dependencies
npm install

# Set up development environment
npm run setup
```

## 🏗️ Project Structure

```
script-track/
├── app/           # Tauri + React UI
├── core/          # FFmpeg logic
├── engine/        # Whisper integration
├── data/          # Transcripts & metadata
├── docs/          # Documentation
└── samples/       # Sample files
```

## 🧪 Testing

Before submitting a PR, please ensure:

- [ ] All tests pass: `npm test`
- [ ] Code is linted: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Manual testing with sample files

## 📝 Code Style

- Use TypeScript for type safety
- Follow React best practices
- Use meaningful commit messages
- Add comments for complex logic
- Write tests for new features

## 🐛 Bug Reports

When reporting bugs, please include:

- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Log files if available

## 💡 Feature Requests

For feature requests, please:

- Check existing issues first
- Use the feature request template
- Provide clear use cases
- Consider implementation complexity

## 📄 Pull Request Process

1. Ensure your PR addresses an open issue
2. Keep PRs focused and atomic
3. Update documentation as needed
4. Add tests for new functionality
5. Request review from maintainers

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `mvp` - MVP-related features
- `ui` - User interface improvements
- `whisper` - Whisper integration
- `ffmpeg` - FFmpeg functionality

## 📞 Getting Help

- 📖 Check the [documentation](docs/)
- 🐛 [Open an issue](https://github.com/script-track/script-track/issues)
- 💬 [Join discussions](https://github.com/script-track/script-track/discussions)

## 📜 License

By contributing to script-track, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to script-track! 🎉
