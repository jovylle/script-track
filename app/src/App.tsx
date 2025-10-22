import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Upload, Play, Pause, Download } from "lucide-react";
import "./App.css";

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  keep: boolean;
}

interface TranscriptionResult {
  segments: TranscriptSegment[];
  duration: number;
}

function App() {
  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/') || file.type.startsWith('audio/'));
    
    if (videoFile) {
      setVideoFile(videoFile.name);
      setVideoPath(URL.createObjectURL(videoFile));
      setVideoDuration(12.5); // Mock duration

      // Try to get actual duration from video element
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
      };
      video.src = URL.createObjectURL(videoFile);
      
      // Store the actual file for transcription
      (window as any).currentVideoFile = videoFile;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (videoElement) {
            if (videoElement.paused) {
              videoElement.play();
              setIsPlaying(true);
            } else {
              videoElement.pause();
              setIsPlaying(false);
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoElement) {
            videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoElement) {
            videoElement.currentTime = Math.min(videoDuration, videoElement.currentTime + 5);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoElement) {
            videoElement.volume = Math.min(1, videoElement.volume + 0.1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoElement) {
            videoElement.volume = Math.max(0, videoElement.volume - 0.1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Jump to first selected segment or first segment
          if (transcript.length > 0) {
            const firstSegment = transcript[0];
            handleSegmentClick(firstSegment);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoElement, videoDuration, transcript]);

  const handleFileSelect = async () => {
    // Use HTML file input directly
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setVideoFile(file.name);
        setVideoPath(URL.createObjectURL(file)); // Create object URL for video playback
        setVideoDuration(12.5); // Mock duration

        // Try to get actual duration from video element
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          setVideoDuration(video.duration);
        };
        video.src = URL.createObjectURL(file);
        
        // Store the actual file for transcription
        (window as any).currentVideoFile = file;
      }
    };
    input.click();
  };

  const handleTranscribe = async () => {
    if (!videoPath) return;
    
    console.log('Starting transcription for:', videoPath);
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setTranscriptionProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);
    
    try {
      let filePath = videoPath;
      
      // If we have a real file, upload it first
      const currentFile = (window as any).currentVideoFile;
      if (currentFile && videoPath.startsWith('blob:')) {
        console.log('Uploading file for real transcription...');
        const fileData = new Uint8Array(await currentFile.arrayBuffer());
        filePath = await invoke<string>('save_uploaded_file', {
          fileData: Array.from(fileData),
          filename: currentFile.name
        });
        console.log('File saved to:', filePath);
      }
      
      const result = await invoke<TranscriptionResult>('transcribe_audio', { 
        filePath: filePath 
      });
      console.log('Transcription result:', result);
      setTranscript(result.segments);
      setVideoDuration(result.duration);
      setTranscriptionProgress(100);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      // Fallback to mock data
      console.log('Using fallback mock data');
      const mockSegments = [
        { id: 1, start: 0.0, end: 3.5, text: "Welcome to script-track", keep: true },
        { id: 2, start: 3.6, end: 6.1, text: "This is a demo transcript", keep: true },
        { id: 3, start: 6.2, end: 9.0, text: "Oops I made a mistake here", keep: false },
        { id: 4, start: 9.1, end: 12.5, text: "Let me continue with the demo", keep: true },
      ];
      console.log('Setting mock segments:', mockSegments);
      setTranscript(mockSegments);
      setTranscriptionProgress(100);
    } finally {
      clearInterval(progressInterval);
      setIsTranscribing(false);
      setTimeout(() => setTranscriptionProgress(0), 1000);
    }
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    setCurrentTime(segment.start);
    if (videoElement) {
      videoElement.currentTime = segment.start;
    }
    console.log(`Jumping to time: ${segment.start}s`);
  };

  const handleSegmentToggle = (id: number) => {
    setTranscript(prev => prev.map(seg => 
      seg.id === id ? { ...seg, keep: !seg.keep } : seg
    ));
  };

  const handleStartEdit = (segment: TranscriptSegment) => {
    setEditingSegment(segment.id);
    setEditText(segment.text);
  };

  const handleSaveEdit = () => {
    if (editingSegment !== null) {
      setTranscript(prev => prev.map(seg => 
        seg.id === editingSegment ? { ...seg, text: editText } : seg
      ));
      setEditingSegment(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSegment(null);
    setEditText('');
  };

  const handleExport = async () => {
    if (!videoPath) return;
    
    setIsExporting(true);
    setExportProgress(0);
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);
    
    try {
      const outputPath = videoPath.replace(/\.[^/.]+$/, '_edited.mp4');
      const result = await invoke<string>('export_video', {
        inputPath: videoPath,
        outputPath: outputPath,
        segments: transcript
      });
      console.log('Export result:', result);
      setExportProgress(100);
      alert('Video exported successfully!');
    } catch (error) {
      console.error('Error exporting video:', error);
      alert('Error exporting video. Check console for details.');
    } finally {
      clearInterval(progressInterval);
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎬 script-track</h1>
        <p>Edit your screen recordings by editing the words you spoke</p>
        <div className="keyboard-shortcuts">
          <span>⌨️ Shortcuts: Space (play/pause) • ←→ (skip 5s) • ↑↓ (volume) • Enter (jump to segment)</span>
        </div>
      </header>

      <main className="app-main">
                {!videoFile ? (
                  <div 
                    className={`import-section ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="import-card" onClick={handleFileSelect}>
                      <Upload size={48} />
                      <h2>Import Video/Audio</h2>
                      <p>Click to select or drag & drop a video/audio file</p>
                      <p className="supported-formats">Supports: MP4, WebM, WAV, MP3</p>
                    </div>
                  </div>
        ) : (
          <div className="workspace">
            <div className="video-panel">
              <div className="video-container">
                {videoPath && videoPath !== videoFile ? (
                  <video
                    ref={setVideoElement}
                    className="video-player"
                    controls
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    src={videoPath}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="video-placeholder">
                    <Play size={64} />
                    <p>Video: {videoFile}</p>
                    <p>Duration: {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(1).padStart(4, '0')}</p>
                  </div>
                )}
              </div>
              
                      <div className="video-controls">
                        <button
                          className="control-btn"
                          onClick={() => {
                            if (videoElement) {
                              if (videoElement.paused) {
                                videoElement.play();
                                setIsPlaying(true);
                              } else {
                                videoElement.pause();
                                setIsPlaying(false);
                              }
                            }
                          }}
                        >
                          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <div className="time-display">
                          {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                        </div>
                      </div>
            </div>

            <div className="transcript-panel">
              <div className="transcript-header">
                <h3>Transcript</h3>
                {transcript.length === 0 && (
                  <button 
                    className="transcribe-btn"
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? "Transcribing..." : "Start Transcription"}
                  </button>
                )}
                {transcript.length > 0 && (
                  <div className="export-section">
                    <button 
                      className="export-btn"
                      onClick={handleExport}
                      disabled={isExporting}
                    >
                      <Download size={16} />
                      {isExporting ? 'Exporting...' : 'Export Video'}
                    </button>
                    {isExporting && (
                      <div className="export-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${exportProgress}%` }}
                          ></div>
                        </div>
                        <p className="progress-text">{Math.round(exportProgress)}%</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="transcript-content">
                {isTranscribing ? (
                  <div className="transcribing">
                    <div className="spinner"></div>
                    <p>Transcribing with Whisper...</p>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${transcriptionProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">{Math.round(transcriptionProgress)}%</p>
                  </div>
                ) : transcript.length > 0 ? (
                  <div className="transcript-segments">
                    {transcript.map((segment) => (
                      <div 
                        key={segment.id}
                        className={`transcript-segment ${!segment.keep ? 'removed' : ''}`}
                        onClick={() => handleSegmentClick(segment)}
                      >
                        <div className="segment-time">
                          {Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(1).padStart(4, '0')}
                        </div>
                        <div className="segment-text">
                          {editingSegment === segment.id ? (
                            <div className="edit-mode">
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="edit-input"
                                autoFocus
                              />
                              <div className="edit-buttons">
                                <button onClick={handleSaveEdit} className="save-btn">✓</button>
                                <button onClick={handleCancelEdit} className="cancel-btn">✕</button>
                              </div>
                            </div>
                          ) : (
                            <span 
                              className="segment-text-content"
                              onDoubleClick={() => handleStartEdit(segment)}
                              title="Double-click to edit"
                            >
                              {segment.text}
                            </span>
                          )}
                        </div>
                        <button 
                          className="segment-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSegmentToggle(segment.id);
                          }}
                          title={segment.keep ? "Remove segment" : "Keep segment"}
                        >
                          {segment.keep ? (
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>✂️</span>
                          ) : (
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-transcript">
                    <p>No transcript yet. Click "Start Transcription" to begin.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
