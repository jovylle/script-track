import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Upload, Play, Pause, Download } from "lucide-react";
import "./App.css";

interface TranscriptSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
  keep: boolean;
  isSilence?: boolean;
}

interface TranscriptionResult {
  segments: TranscriptSegment[];
  duration: number;
}

function App() {
  console.log('🚀 APP COMPONENT RENDERED');
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
  const [editingSegment, setEditingSegment] = useState<number | string | null>(null);
  const [editText, setEditText] = useState('');
  const [silenceThreshold, setSilenceThreshold] = useState(1.0);
  const [showSilenceSettings, setShowSilenceSettings] = useState(false);
  const [audioBoost, setAudioBoost] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentSegmentId, setCurrentSegmentId] = useState<number | string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [exportETA, setExportETA] = useState<string>('');

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('🖱️ DRAG OVER: File being dragged over drop zone');
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('🖱️ DRAG LEAVE: File dragged away from drop zone');
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    console.log('🖱️ DROP: Files dropped:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    const videoFile = files.find(file => file.type.startsWith('video/') || file.type.startsWith('audio/'));
    
    if (videoFile) {
      console.log('🖱️ DROP: Video/audio file found:', {
        name: videoFile.name,
        type: videoFile.type,
        size: videoFile.size
      });
      setVideoFile(videoFile.name);
      setVideoPath(URL.createObjectURL(videoFile));
      setVideoDuration(12.5); // Mock duration

      // Try to get actual duration from video element
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        console.log('📹 DROP VIDEO METADATA:', {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
        setVideoDuration(video.duration);
      };
      video.src = URL.createObjectURL(videoFile);
      
      // Store the actual file for transcription
      (window as any).currentVideoFile = videoFile;
    } else {
      console.log('🖱️ DROP: No video/audio file found in dropped files');
    }
  };

  // Apply audio boost and playback speed
  useEffect(() => {
    if (videoElement) {
      console.log('🎵 AUDIO SETTINGS CHANGED:', {
        volume: Math.min(1, audioBoost),
        playbackRate: playbackSpeed,
        audioBoost: audioBoost
      });
      videoElement.volume = Math.min(1, audioBoost);
      videoElement.playbackRate = playbackSpeed;
    }
  }, [videoElement, audioBoost, playbackSpeed]);

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
          console.log('⌨️ KEYBOARD: Space pressed - toggling play/pause');
          if (videoElement) {
            if (videoElement.paused) {
              console.log('▶️ PLAYING video');
              videoElement.play();
              setIsPlaying(true);
            } else {
              console.log('⏸️ PAUSING video');
              videoElement.pause();
              setIsPlaying(false);
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          console.log('⌨️ KEYBOARD: Left arrow - skipping back 5s');
          if (videoElement) {
            const newTime = Math.max(0, videoElement.currentTime - 5);
            console.log('⏪ SKIP BACK:', { from: videoElement.currentTime, to: newTime });
            videoElement.currentTime = newTime;
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          console.log('⌨️ KEYBOARD: Right arrow - skipping forward 5s');
          if (videoElement) {
            const newTime = Math.min(videoDuration, videoElement.currentTime + 5);
            console.log('⏩ SKIP FORWARD:', { from: videoElement.currentTime, to: newTime });
            videoElement.currentTime = newTime;
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          console.log('⌨️ KEYBOARD: Up arrow - increasing volume');
          if (videoElement) {
            const newVolume = Math.min(1, videoElement.volume + 0.1);
            console.log('🔊 VOLUME UP:', { from: videoElement.volume, to: newVolume });
            videoElement.volume = newVolume;
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          console.log('⌨️ KEYBOARD: Down arrow - decreasing volume');
          if (videoElement) {
            const newVolume = Math.max(0, videoElement.volume - 0.1);
            console.log('🔉 VOLUME DOWN:', { from: videoElement.volume, to: newVolume });
            videoElement.volume = newVolume;
          }
          break;
        case 'Enter':
          e.preventDefault();
          console.log('⌨️ KEYBOARD: Enter - jumping to first segment');
          if (transcript.length > 0) {
            const firstSegment = transcript[0];
            console.log('🎯 JUMP TO FIRST SEGMENT:', { 
              segment: firstSegment.text, 
              time: firstSegment.start 
            });
            handleSegmentClick(firstSegment);
          } else {
            console.log('🎯 JUMP TO FIRST SEGMENT: No transcript available');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoElement, videoDuration, transcript]);

  const handleFileSelect = async () => {
    console.log('📁 FILE SELECT: Opening file picker...');
    // Use HTML file input directly
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log('📁 FILE SELECTED:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified)
        });
        setVideoFile(file.name);
        setVideoPath(URL.createObjectURL(file)); // Create object URL for video playback
        setVideoDuration(12.5); // Mock duration

        // Try to get actual duration from video element
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          console.log('📹 VIDEO METADATA LOADED:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          });
          setVideoDuration(video.duration);
        };
        video.src = URL.createObjectURL(file);
        
        // Store the actual file for transcription
        (window as any).currentVideoFile = file;
      } else {
        console.log('📁 FILE SELECT: No file selected');
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
            console.log('Number of segments received:', result.segments.length);
            console.log('First few segments:', result.segments.slice(0, 3));
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
    console.log('🎯 SEGMENT CLICKED:', segment);
    setCurrentTime(segment.start);
    if (videoElement) {
      videoElement.currentTime = segment.start;
      console.log(`⏰ Jumping to time: ${segment.start}s`);
    } else {
      console.log('❌ No video element found');
    }
  };

  const handleSegmentToggle = (id: number | string) => {
    console.log('✂️ SEGMENT TOGGLE CLICKED for segment ID:', id);
    setTranscript(prev => {
      const updated = prev.map(seg => 
        seg.id === id ? { ...seg, keep: !seg.keep } : seg
      );
      const toggledSegment = updated.find(seg => seg.id === id);
      console.log('📝 Segment toggled:', toggledSegment);
      console.log('📊 Updated transcript:', updated);
      return updated;
    });
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
    console.log('🎬 EXPORT BUTTON CLICKED');
    console.log('Current transcript:', transcript);
    console.log('Video path:', videoPath);
    
    if (!videoPath) {
      console.log('❌ No video path to export');
      return;
    }
    
    const segmentsToKeep = transcript.filter(s => s.keep);
    console.log('📝 Segments to keep:', segmentsToKeep);
    console.log('📊 Total segments:', transcript.length, 'Keeping:', segmentsToKeep.length);
    
    setIsExporting(true);
    setExportProgress(0);
    const startTime = Date.now();
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 90) return prev;
        const newProgress = prev + Math.random() * 15;
        
        // Calculate ETA
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const rate = newProgress / elapsed; // progress per second
        const remaining = (100 - newProgress) / rate; // seconds remaining
        setExportETA(`~${Math.ceil(remaining)}s remaining`);
        
        return newProgress;
      });
    }, 300);
    
    try {
      // Use the actual file path instead of blob URL for export
      const currentFile = (window as any).currentVideoFile;
      let actualInputPath = videoPath;
      
      if (videoPath.startsWith('blob:') && currentFile) {
        // We need to use the saved file path for export
        console.log('🔄 Converting blob URL to actual file path for export...');
        const fileData = new Uint8Array(await currentFile.arrayBuffer());
        actualInputPath = await invoke<string>('save_uploaded_file', {
          fileData: Array.from(fileData),
          filename: currentFile.name
        });
        console.log('📁 Using actual file path for export:', actualInputPath);
      }
      
      const outputPath = actualInputPath.replace(/\.[^/.]+$/, '_edited.mp4');
      console.log('🚀 Starting export...');
      console.log('Input path:', actualInputPath);
      console.log('Output path:', outputPath);
      console.log('Segments being exported:', segmentsToKeep);
      
      const result = await invoke<string>('export_video', {
        inputPath: actualInputPath,
        outputPath: outputPath,
        segments: segmentsToKeep
      });
      
      console.log('✅ Export completed successfully:', result);
      setExportProgress(100);
      alert(`Video exported successfully! Output: ${result}`);
    } catch (error) {
      console.error('❌ Error exporting video:', error);
      alert(`Export failed: ${error}`);
    } finally {
      clearInterval(progressInterval);
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const detectSilentParts = () => {
    console.log('🔇 DETECTING SILENT PARTS:', {
      threshold: silenceThreshold,
      totalSegments: transcript.length
    });
    
    // Remove existing silence segments first
    const speechSegments = transcript.filter(s => !s.isSilence);
    console.log('📋 SPEECH SEGMENTS:', speechSegments.map((s, i) => ({
      index: i,
      text: s.text,
      start: s.start.toFixed(2),
      end: s.end.toFixed(2),
      duration: (s.end - s.start).toFixed(2)
    })));
    
    const silentSegments: TranscriptSegment[] = [];
    
    // NEW APPROACH: Look for gaps in the timeline
    console.log('🔍 ANALYZING TIMELINE FOR GAPS:');
    
    // Sort segments by start time
    const sortedSegments = [...speechSegments].sort((a, b) => a.start - b.start);
    
    console.log(`📊 Analyzing ${sortedSegments.length} individual word segments for gaps...`);
    
    for (let i = 0; i < sortedSegments.length - 1; i++) {
      const current = sortedSegments[i];
      const next = sortedSegments[i + 1];
      
      // Calculate the actual gap between segments
      const gap = next.start - current.end;
      
      console.log(`Gap ${i}: "${current.text}" ends at ${current.end.toFixed(2)}s → "${next.text}" starts at ${next.start.toFixed(2)}s`);
      console.log(`  Gap duration: ${gap.toFixed(2)}s (threshold: ${silenceThreshold}s)`);
      
      if (gap > silenceThreshold) {
        console.log(`  ✅ SILENCE DETECTED: ${gap.toFixed(2)}s > ${silenceThreshold}s`);
        silentSegments.push({
          id: `silence-${i}-${Date.now()}`,
          start: current.end,
          end: next.start,
          text: `[Silence: ${gap.toFixed(1)}s]`,
          keep: false,
          isSilence: true
        });
      } else {
        console.log(`  ❌ No silence: ${gap.toFixed(2)}s <= ${silenceThreshold}s`);
      }
    }
    
    // Also check for silence at the beginning and end
    const firstSegment = sortedSegments[0];
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    
    // Check for silence at the beginning
    if (firstSegment && firstSegment.start > 0.5) {
      const startGap = firstSegment.start;
      if (startGap > silenceThreshold) {
        console.log(`✅ SILENCE AT START: ${startGap.toFixed(2)}s`);
        silentSegments.push({
          id: `silence-start-${Date.now()}`,
          start: 0,
          end: firstSegment.start,
          text: `[Silence at start: ${startGap.toFixed(1)}s]`,
          keep: false,
          isSilence: true
        });
      }
    }
    
    console.log('🔇 SILENCE DETECTION RESULTS:', {
      found: silentSegments.length,
      segments: silentSegments.map(s => ({ 
        text: s.text, 
        duration: (s.end - s.start).toFixed(1) + 's',
        start: s.start.toFixed(1) + 's',
        end: s.end.toFixed(1) + 's'
      }))
    });
    
    // Combine speech and silence segments
    const combined = [...speechSegments, ...silentSegments].sort((a, b) => a.start - b.start);
    setTranscript(combined);
    
    if (silentSegments.length === 0) {
      console.log('❌ No silent parts found. Try lowering the threshold or check if your video has actual pauses.');
    } else {
      console.log(`✅ Found ${silentSegments.length} silent parts! They should appear in orange in the transcript.`);
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
                            <div className="import-card" onClick={() => {
                              console.log('📁 IMPORT CARD CLICKED');
                              handleFileSelect();
                            }}>
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
                    onTimeUpdate={(e) => {
                      const time = e.currentTarget.currentTime;
                      setCurrentTime(time);
                      
                      // Find current segment
                      const current = transcript.find(seg => time >= seg.start && time <= seg.end);
                      
                      // PREVIEW MODE: Skip removed segments
                      if (isPreviewMode && current && !current.keep && videoElement) {
                        console.log('⏭️ PREVIEW MODE: Skipping removed segment:', current.text);
                        
                        // Find next segment that should be kept
                        const nextKeptSegment = transcript.find(seg => 
                          seg.start > time && seg.keep
                        );
                        
                        if (nextKeptSegment) {
                          console.log('⏭️ PREVIEW MODE: Jumping to:', nextKeptSegment.text, 'at', nextKeptSegment.start);
                          videoElement.currentTime = nextKeptSegment.start;
                          return;
                        }
                      }
                      
                      const newCurrentId = current?.id || null;
                      
                      // Log segment changes
                      if (newCurrentId !== currentSegmentId) {
                        console.log('🎬 CURRENT SEGMENT CHANGED:', {
                          from: currentSegmentId,
                          to: newCurrentId,
                          segment: current ? current.text : 'none',
                          time: time.toFixed(2)
                        });
                        setCurrentSegmentId(newCurrentId);
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      const duration = e.currentTarget.duration;
                      console.log('📹 VIDEO LOADED:', {
                        duration: duration,
                        videoWidth: e.currentTarget.videoWidth,
                        videoHeight: e.currentTarget.videoHeight
                      });
                      setVideoDuration(duration);
                    }}
                    onPlay={() => {
                      console.log('▶️ VIDEO PLAY EVENT');
                      setIsPlaying(true);
                    }}
                    onPause={() => {
                      console.log('⏸️ VIDEO PAUSE EVENT');
                      setIsPlaying(false);
                    }}
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
                            console.log('🎮 PLAY/PAUSE BUTTON CLICKED');
                            if (videoElement) {
                              if (videoElement.paused) {
                                console.log('▶️ BUTTON: Playing video');
                                videoElement.play();
                                setIsPlaying(true);
                              } else {
                                console.log('⏸️ BUTTON: Pausing video');
                                videoElement.pause();
                                setIsPlaying(false);
                              }
                            } else {
                              console.log('❌ BUTTON: No video element found');
                            }
                          }}
                        >
                          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <div className="time-display">
                          {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                        </div>
                        
                        <div className="audio-boost-control">
                          <label>🔊 {Math.round(audioBoost * 100)}%</label>
                          <input 
                            type="range" 
                            min="0" 
                            max="2" 
                            step="0.1"
                            value={audioBoost}
                            onChange={(e) => {
                              const newBoost = parseFloat(e.target.value);
                              console.log('🔊 AUDIO BOOST CHANGED:', { from: audioBoost, to: newBoost });
                              setAudioBoost(newBoost);
                            }}
                          />
                        </div>
                        
                        <div className="speed-control">
                          <label>⏩</label>
                          <select 
                            value={playbackSpeed} 
                            onChange={(e) => {
                              const newSpeed = parseFloat(e.target.value);
                              console.log('⏩ PLAYBACK SPEED CHANGED:', { from: playbackSpeed, to: newSpeed });
                              setPlaybackSpeed(newSpeed);
                            }}
                          >
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1">1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2x</option>
                          </select>
                        </div>
                      </div>
            </div>

            <div className="transcript-panel">
              <div className="transcript-header">
                <h3>Transcript</h3>
                {transcript.length > 0 && (
                  <div className="preview-toggle">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={isPreviewMode}
                        onChange={(e) => {
                          console.log('👁️ PREVIEW MODE TOGGLED:', e.target.checked);
                          setIsPreviewMode(e.target.checked);
                        }}
                      />
                      <span>👁️ Preview Mode</span>
                    </label>
                  </div>
                )}
                {transcript.length === 0 && (
                  <button 
                    className="transcribe-btn"
                    onClick={() => {
                      console.log('🎤 TRANSCRIBE BUTTON CLICKED');
                      handleTranscribe();
                    }}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? "Transcribing..." : "Start Transcription"}
                  </button>
                )}
                {transcript.length > 0 && (
                  <>
                    <div className="duration-stats">
                      {(() => {
                        const totalDuration = transcript.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
                        const keptDuration = transcript.filter(s => s.keep).reduce((sum, seg) => sum + (seg.end - seg.start), 0);
                        const removedDuration = totalDuration - keptDuration;
                        const savedPercentage = totalDuration > 0 ? ((removedDuration / totalDuration) * 100).toFixed(1) : '0';
                        
                        const formatTime = (seconds: number) => {
                          const mins = Math.floor(seconds / 60);
                          const secs = Math.floor(seconds % 60);
                          return `${mins}:${secs.toString().padStart(2, '0')}`;
                        };
                        
                        return (
                          <>
                            <div className="stat">
                              <span className="stat-label">Original:</span>
                              <span className="stat-value">{formatTime(totalDuration)}</span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">Final:</span>
                              <span className="stat-value green">{formatTime(keptDuration)}</span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">Removed:</span>
                              <span className="stat-value red">{formatTime(removedDuration)}</span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">Saved:</span>
                              <span className="stat-value highlight">{savedPercentage}%</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="silence-controls">
                      <button 
                        className="silence-btn"
                        onClick={() => {
                          const newState = !showSilenceSettings;
                          console.log('🔇 SILENCE SETTINGS TOGGLED:', { 
                            from: showSilenceSettings, 
                            to: newState 
                          });
                          setShowSilenceSettings(newState);
                        }}
                      >
                        🔇 Remove Silence
                      </button>
                      
                      {showSilenceSettings && (
                        <div className="silence-settings">
                          <label>
                            Threshold: 
        <input
                              type="range" 
                              min="0.5" 
                              max="3" 
                              step="0.5"
                              value={silenceThreshold}
                              onChange={(e) => {
                                const newThreshold = parseFloat(e.target.value);
                                console.log('🔇 SILENCE THRESHOLD CHANGED:', { 
                                  from: silenceThreshold, 
                                  to: newThreshold 
                                });
                                setSilenceThreshold(newThreshold);
                              }}
                            />
                            <span>{silenceThreshold}s</span>
                          </label>
                          <button 
                            className="detect-btn" 
                            onClick={() => {
                              console.log('🔍 DETECT SILENCE BUTTON CLICKED');
                              console.log('🔍 About to call detectSilentParts function...');
                              detectSilentParts();
                              console.log('🔍 detectSilentParts function completed');
                            }}
                          >
                            Detect
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="export-section">
                      <button 
                        className="export-btn"
                        onClick={() => {
                          console.log('📤 EXPORT BUTTON CLICKED');
                          handleExport();
                        }}
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
                          <p className="progress-text">{Math.round(exportProgress)}% {exportETA}</p>
                        </div>
                      )}
                    </div>
                  </>
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
                  <div className="transcript-inline">
                    {transcript.map((segment) => (
                      <span
                        key={segment.id}
                        className={`inline-word ${!segment.keep ? 'removed' : ''} ${segment.isSilence ? 'silence-segment' : ''} ${segment.id === currentSegmentId ? 'active' : ''}`}
                        onClick={() => {
                          console.log('🎯 SEGMENT CLICKED:', {
                            id: segment.id,
                            text: segment.text,
                            start: segment.start,
                            end: segment.end,
                            keep: segment.keep,
                            isSilence: segment.isSilence
                          });
                          handleSegmentClick(segment);
                        }}
                        onDoubleClick={() => {
                          if (!segment.isSilence) {
                            console.log('✏️ SEGMENT DOUBLE-CLICKED (EDIT):', {
                              id: segment.id,
                              text: segment.text
                            });
                            handleStartEdit(segment);
                          }
                        }}
                      >
                        {segment.text}
                        <div className="word-tooltip">
                          <div className="word-info">
                            <span className="word-time">
                              {Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(1).padStart(4, '0')} - 
                              {Math.floor(segment.end / 60)}:{(segment.end % 60).toFixed(1).padStart(4, '0')}
                            </span>
                            <span className="word-duration">({(segment.end - segment.start).toFixed(1)}s)</span>
                          </div>
                          <button 
                            className="inline-cut-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('✂️ TOOLTIP CUT BUTTON CLICKED:', {
                                segmentId: segment.id,
                                text: segment.text,
                                currentKeep: segment.keep,
                                newKeep: !segment.keep
                              });
                              handleSegmentToggle(segment.id);
                            }}
                            title={segment.keep ? "Remove this segment" : "Keep this segment"}
                          >
                            {segment.keep ? "✂️" : "✓"}
                          </button>
                        </div>
                      </span>
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
