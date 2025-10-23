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

interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
}

interface TranscriptionResult {
  segments: TranscriptSegment[];
  duration: number;
}

// Helper function to log to terminal instead of browser console
const logToTerminal = async (message: string) => {
  try {
    await invoke('log_to_terminal', { message });
  } catch (e) {
    console.log(message); // Fallback to console if terminal logging fails
  }
};

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
  const [editingSegment, setEditingSegment] = useState<number | string | null>(null);
  const [editText, setEditText] = useState('');
  // Removed silenceThreshold - no longer using gap-based detection
  const [showSilenceSettings, setShowSilenceSettings] = useState(false);
  const [noiseThreshold, setNoiseThreshold] = useState(-40.0); // More sensitive default
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);
  const [audioBoost, setAudioBoost] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentSegmentId, setCurrentSegmentId] = useState<number | string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [exportETA, setExportETA] = useState<string>('');
  const [selectedWordId, setSelectedWordId] = useState<number | string | null>(null);
  const [excludedSilenceRegions, setExcludedSilenceRegions] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  const [silenceSettingsExpanded, setSilenceSettingsExpanded] = useState(false);
  
  // Undo/Redo for silence detection
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptSegment[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasSilenceDetection, setHasSilenceDetection] = useState(false);

  // Handle ESC key to deselect word
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedWordId !== null) {
        setSelectedWordId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordId]);

  // Handle click outside to close action panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedWordId !== null) {
        const target = e.target as Element;
        // Check if click is outside any word or action panel
        if (!target.closest('.inline-word') && !target.closest('.word-action-panel')) {
          setSelectedWordId(null);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedWordId]);

  // History management functions
  const saveToHistory = (newTranscript: TranscriptSegment[]) => {
    console.log('📚 SAVING TO HISTORY:', {
      currentIndex: historyIndex,
      historyLength: transcriptHistory.length,
      newTranscriptLength: newTranscript.length
    });
    
    const newHistory = transcriptHistory.slice(0, historyIndex + 1);
    newHistory.push([...newTranscript]);
    
    setTranscriptHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      console.log('↶ UNDO:', { from: historyIndex, to: newIndex });
      setHistoryIndex(newIndex);
      setTranscript(transcriptHistory[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < transcriptHistory.length - 1) {
      const newIndex = historyIndex + 1;
      console.log('↷ REDO:', { from: historyIndex, to: newIndex });
      setHistoryIndex(newIndex);
      setTranscript(transcriptHistory[newIndex]);
    }
  };

  const clearSilenceDetection = () => {
    console.log('🧹 CLEARING SILENCE DETECTION');
    const speechOnly = transcript.filter(s => !s.isSilence);
    setTranscript(speechOnly);
    setHasSilenceDetection(false);
    saveToHistory(speechOnly);
  };

  // Silence region management functions
  const getSilenceRegionKey = (start: number, end: number) => `${start.toFixed(2)}-${end.toFixed(2)}`;

  const excludeAllSilence = () => {
    console.log('✂️ EXCLUDING ALL SILENCE REGIONS');
    const newExcluded = new Set<string>();
    transcript.forEach(segment => {
      if (segment.isSilence) {
        newExcluded.add(getSilenceRegionKey(segment.start, segment.end));
      }
    });
    setExcludedSilenceRegions(newExcluded);
    
    // Update transcript to mark excluded silence as removed
    const updatedTranscript = transcript.map(segment => {
      if (segment.isSilence) {
        return { ...segment, keep: false };
      }
      return segment;
    });
    setTranscript(updatedTranscript);
    saveToHistory(updatedTranscript);
  };

  const includeAllSilence = () => {
    console.log('➕ INCLUDING ALL SILENCE REGIONS');
    setExcludedSilenceRegions(new Set());
    
    // Update transcript to mark all silence as kept
    const updatedTranscript = transcript.map(segment => {
      if (segment.isSilence) {
        return { ...segment, keep: true };
      }
      return segment;
    });
    setTranscript(updatedTranscript);
    saveToHistory(updatedTranscript);
  };

  const toggleSilenceRegion = (start: number, end: number) => {
    const key = getSilenceRegionKey(start, end);
    const newExcluded = new Set(excludedSilenceRegions);
    
    if (newExcluded.has(key)) {
      newExcluded.delete(key);
      console.log('➕ INCLUDING silence region:', key);
    } else {
      newExcluded.add(key);
      console.log('✂️ EXCLUDING silence region:', key);
    }
    
    setExcludedSilenceRegions(newExcluded);
    
    // Update transcript
    const updatedTranscript = transcript.map(segment => {
      if (segment.isSilence && 
          Math.abs(segment.start - start) < 0.1 && 
          Math.abs(segment.end - end) < 0.1) {
        return { ...segment, keep: !newExcluded.has(key) };
      }
      return segment;
    });
    setTranscript(updatedTranscript);
    saveToHistory(updatedTranscript);
  };

  // Open exported file location
  const openExportedFileLocation = async () => {
    if (!exportedFilePath) return;
    
    try {
      console.log('📁 Opening exported file location:', exportedFilePath);
      await invoke('open_file_location', { filePath: exportedFilePath });
    } catch (error) {
      console.error('Failed to open file location:', error);
    }
  };

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

  const handleDrop = async (e: React.DragEvent) => {
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
      
      setIsUploading(true);
      
      // Create blob URL for video player
      const blobUrl = URL.createObjectURL(videoFile);
      console.log('🎬 Created blob URL for video:', blobUrl);
      setVideoFile(blobUrl);
      setVideoDuration(12.5); // Mock duration

      // Save the file immediately and store the actual path
      try {
        const fileData = new Uint8Array(await videoFile.arrayBuffer());
        const savedPath = await invoke<string>('save_uploaded_file', {
          fileData: Array.from(fileData),
          filename: videoFile.name
        });
        console.log('📁 File saved to:', savedPath);
        console.log('📁 Setting videoPath to:', savedPath);
        setVideoPath(savedPath); // Store actual file path, not blob URL!
      } catch (error) {
        console.error('❌ Error saving file:', error);
        setVideoPath(blobUrl); // Fallback to blob URL if save fails
      } finally {
        setIsUploading(false);
      }

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
      video.src = blobUrl;
      
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
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log('📁 FILE SELECTED:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified)
        });
        
        setIsUploading(true);
        
        // Create blob URL for video player
        const blobUrl = URL.createObjectURL(file);
        console.log('🎬 Created blob URL for video:', blobUrl);
        setVideoFile(blobUrl);
        setVideoDuration(12.5); // Mock duration

        // Save the file immediately and store the actual path
        try {
          const fileData = new Uint8Array(await file.arrayBuffer());
          const savedPath = await invoke<string>('save_uploaded_file', {
            fileData: Array.from(fileData),
            filename: file.name
          });
          console.log('📁 File saved to:', savedPath);
          console.log('📁 Setting videoPath to:', savedPath);
          setVideoPath(savedPath); // Store actual file path, not blob URL!
        } catch (error) {
          console.error('❌ Error saving file:', error);
          setVideoPath(blobUrl); // Fallback to blob URL if save fails
        } finally {
          setIsUploading(false);
        }

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
        video.src = blobUrl;
        
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
              
              // Initialize history with the original transcript
              saveToHistory(result.segments);
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
              
              // Initialize history with mock data too
              saveToHistory(mockSegments);
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
      setExportedFilePath(result);
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

  const detectSilentParts = async () => {
    await logToTerminal(`🔇 DETECTING SILENT PARTS (Audio-Based): threshold=${noiseThreshold}dB, minDuration=${minSilenceDuration}s, segments=${transcript.length}`);
    
    if (!videoPath) {
      await logToTerminal('❌ No video path available for silence detection');
      return;
    }
    
    await logToTerminal(`📁 Using video path: ${videoPath}`);
    await logToTerminal(`📁 videoPath type: ${typeof videoPath}, starts with blob: ${videoPath?.startsWith('blob:')}`);
    await logToTerminal(`🎯 Video duration: ${videoDuration}s, Transcript segments: ${transcript.length}`);
    
    try {
      // Call the Rust backend to detect actual silence in the audio
      await logToTerminal('🎵 Calling FFmpeg silence detection...');
      await logToTerminal(`📊 Parameters: noise_threshold=${noiseThreshold}dB, min_duration=${minSilenceDuration}s`);
      
      const silenceRegions: SilenceRegion[] = await invoke('detect_audio_silence', {
        filePath: videoPath,
        noiseThreshold,
        minDuration: minSilenceDuration
      });
      
      await logToTerminal(`📈 FFmpeg returned ${silenceRegions.length} silence regions`);
      if (silenceRegions.length > 0) {
        await logToTerminal(`📋 First few regions: ${silenceRegions.slice(0, 3).map(r => `${r.start.toFixed(2)}s-${r.end.toFixed(2)}s`).join(', ')}`);
      }
      await logToTerminal(`🎯 Found ${silenceRegions.length} silence regions from audio analysis`);
      
      // Remove existing silence segments first
      const speechSegments = transcript.filter(s => !s.isSilence);
      await logToTerminal(`📋 SPEECH SEGMENTS: ${speechSegments.length}`);
      
      // Log detected silence regions
      for (const region of silenceRegions) {
        await logToTerminal(`  🔇 Silence: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s (${region.duration.toFixed(2)}s)`);
      }
      
      // Use smart splitting algorithm to avoid overlaps
      const { splitSegmentsAtSilence } = await import('./utils/transcriptUtils');
      const allSegments = splitSegmentsAtSilence(speechSegments, silenceRegions);
      
      await logToTerminal(`📊 SPLITTING RESULTS: ${speechSegments.length} speech → ${allSegments.length} total segments`);
      
      // Show detailed breakdown
      const wordSegments = allSegments.filter(s => !s.isSilence);
      const silenceSegments = allSegments.filter(s => s.isSilence);
      await logToTerminal(`📋 BREAKDOWN: ${wordSegments.length} word segments, ${silenceSegments.length} silence segments`);
      
      // Show first few segments for debugging
      await logToTerminal(`🔍 FIRST 10 SEGMENTS:`);
      for (let i = 0; i < Math.min(10, allSegments.length); i++) {
        const seg = allSegments[i];
        const type = seg.isSilence ? '🔇 SILENCE' : '🗣️ SPEECH';
        await logToTerminal(`  ${i + 1}. ${type}: ${seg.start.toFixed(1)}s-${seg.end.toFixed(1)}s "${seg.text.substring(0, 30)}${seg.text.length > 30 ? '...' : ''}"`);
      }
      
      // Save to history and update transcript
      saveToHistory(transcript);
      setTranscript(allSegments);
      setHasSilenceDetection(true);
      
      await logToTerminal(`✅ Audio-based silence detection complete: ${silenceRegions.length} silence regions added`);
      
    } catch (error) {
      await logToTerminal(`❌ Error detecting silence: ${error}`);
      alert(`Silence detection failed: ${error}`);
    }
  };

  return (
    <div className="app">
      {/* Loading overlay */}
      {isUploading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Uploading video...</p>
            <p className="loading-subtitle">Please wait while we process your file</p>
          </div>
        </div>
      )}
      
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
                {console.log('🎬 Rendering video element, videoFile:', videoFile)}
                {videoFile ? (
                  <video
                    ref={setVideoElement}
                    className="video-player"
                    onLoadStart={() => console.log('🎬 Video load started')}
                    onLoadedData={() => console.log('🎬 Video data loaded')}
                    onError={(e) => console.error('🎬 Video error:', e)}
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
                    src={videoFile}
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
              
                      {/* Custom timeline with progress bar */}
                      <div className="video-timeline-container">
                        <div className="timeline-track" onClick={(e) => {
                          if (videoElement && videoDuration > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percentage = clickX / rect.width;
                            const newTime = percentage * videoDuration;
                            videoElement.currentTime = newTime;
                            console.log('🎯 Timeline clicked:', { percentage: percentage.toFixed(2), newTime: newTime.toFixed(2) });
                          }
                        }}>
                          <div 
                            className="timeline-progress" 
                            style={{ width: videoDuration > 0 ? `${(currentTime / videoDuration) * 100}%` : '0%' }}
                          />
                          <div 
                            className="timeline-handle" 
                            style={{ left: videoDuration > 0 ? `${(currentTime / videoDuration) * 100}%` : '0%' }}
                          />
                        </div>
                        <div className="time-labels">
                          <span className="current-time">
                            {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                          </span>
                          <span className="duration">
                            {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(1).padStart(4, '0')}
                          </span>
                        </div>
                      </div>
                      
                      {/* Player controls */}
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
                        🔇 Silence Settings
                      </button>
                      
                      <div className="audio-boost-control">
                        <label>🔊 Volume: {Math.round(audioBoost * 100)}%</label>
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
                      
                      {hasSilenceDetection && (
                        <div className="silence-actions">
                          <button 
                            className="undo-btn"
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            title="Undo silence detection"
                          >
                            ↶ Undo
                          </button>
                          <button 
                            className="redo-btn"
                            onClick={redo}
                            disabled={historyIndex >= transcriptHistory.length - 1}
                            title="Redo silence detection"
                          >
                            ↷ Redo
                          </button>
                          <button 
                            className="clear-btn"
                            onClick={clearSilenceDetection}
                            title="Remove all silence segments"
                          >
                            🧹 Clear
                          </button>
                        </div>
                      )}
                      
                      {showSilenceSettings && (
                        <div className="silence-settings">
                          <div className="silence-help">
                            <span className="help-icon">ℹ️</span>
                            <span className="help-text">
                              FFmpeg-based quiet parts detection
                            </span>
                          </div>
                          
                          <div className="audio-settings">
                            <div className="settings-row">
                              <label className="setting-item" title="Noise level to detect as silent - lower values detect quieter sounds">
                                Noise Level: 
                                <div className="setting-description">
                                  {noiseThreshold <= -50 && "Very Sensitive"}
                                  {noiseThreshold > -50 && noiseThreshold <= -40 && "Balanced (recommended)"}
                                  {noiseThreshold > -40 && noiseThreshold <= -30 && "Conservative"}
                                  {noiseThreshold > -30 && "Very Conservative"}
                                </div>
                                <input
                                  type="range" 
                                  min="-60" 
                                  max="-10" 
                                  step="5"
                                  value={noiseThreshold}
                                  onChange={(e) => {
                                    const newThreshold = parseFloat(e.target.value);
                                    console.log('🔇 NOISE THRESHOLD CHANGED:', { 
                                      from: noiseThreshold, 
                                      to: newThreshold 
                                    });
                                    setNoiseThreshold(newThreshold);
                                  }}
                                  title="Noise level to detect as silent - lower values detect quieter sounds"
                                />
                                <span>{noiseThreshold}dB</span>
                              </label>
                              
                              <label className="setting-item" title="Minimum duration for silence to be detected - shorter pauses will be ignored">
                                Min Duration: 
                                <input
                                  type="range" 
                                  min="0.1" 
                                  max="2.0" 
                                  step="0.1"
                                  value={minSilenceDuration}
                                  onChange={(e) => {
                                    const newDuration = parseFloat(e.target.value);
                                    console.log('🔇 MIN DURATION CHANGED:', { 
                                      from: minSilenceDuration, 
                                      to: newDuration 
                                    });
                                    setMinSilenceDuration(newDuration);
                                  }}
                                  title="Minimum duration for silence to be detected - shorter pauses will be ignored"
                                />
                                <span>{minSilenceDuration}s</span>
                              </label>
                            </div>
                          </div>
                          
                          {/* Preset buttons for quick configuration */}
                          <div className="preset-buttons">
                            <button 
                              className="preset-btn aggressive"
                              onClick={() => {
                                setNoiseThreshold(-50);
                                setMinSilenceDuration(0.3);
                                console.log('🎯 PRESET: Aggressive - removes all pauses');
                              }}
                              title="Removes all pauses and quiet moments"
                            >
                              Aggressive
                            </button>
                            <button 
                              className="preset-btn balanced"
                              onClick={() => {
                                setNoiseThreshold(-40);
                                setMinSilenceDuration(0.5);
                                console.log('🎯 PRESET: Balanced - removes long pauses');
                              }}
                              title="Removes long pauses (recommended)"
                            >
                              Balanced
                            </button>
                            <button 
                              className="preset-btn conservative"
                              onClick={() => {
                                setNoiseThreshold(-30);
                                setMinSilenceDuration(1.0);
                                console.log('🎯 PRESET: Conservative - only true silence');
                              }}
                              title="Only removes complete silence"
                            >
                              Conservative
                            </button>
                          </div>
                          
                          <div className="detection-buttons">
                            <button 
                              className="detect-btn" 
                              onClick={() => {
                                console.log('🔍 DETECT SILENCE BUTTON CLICKED');
                                console.log('🔍 About to call detectSilentParts function...');
                                detectSilentParts();
                                console.log('🔍 detectSilentParts function completed');
                              }}
                            >
                              🎵 Detect Silence
                            </button>
                            <button 
                              className="analyze-btn" 
                              onClick={async () => {
                                if (!videoPath) {
                                  alert('Please upload a video first');
                                  return;
                                }
                                console.log('📊 ANALYZE AUDIO LEVELS BUTTON CLICKED');
                                try {
                                  await logToTerminal('📊 Starting audio level analysis...');
                                  const levels = await invoke<Array<[number, number]>>('analyze_audio_levels', {
                                    filePath: videoPath,
                                    sampleRate: 0.1 // Sample every 0.1 seconds
                                  });
                                  await logToTerminal(`📈 Audio analysis complete: ${levels.length} samples`);
                                  
                                  // Show first 10 and last 10 samples with play buttons
                                  const showCount = Math.min(10, levels.length);
                                  await logToTerminal(`🔍 FIRST ${showCount} SAMPLES (click to play 1 second):`);
                                  for (let i = 0; i < showCount; i++) {
                                    const [timestamp, volume] = levels[i];
                                    await logToTerminal(`  🎵 ${timestamp.toFixed(1)}s: ${volume.toFixed(1)}dB`);
                                  }
                                  
                                  if (levels.length > 20) {
                                    await logToTerminal(`🔍 LAST ${showCount} SAMPLES (click to play 1 second):`);
                                    for (let i = levels.length - showCount; i < levels.length; i++) {
                                      const [timestamp, volume] = levels[i];
                                      await logToTerminal(`  🎵 ${timestamp.toFixed(1)}s: ${volume.toFixed(1)}dB`);
                                    }
                                  }
                                  
                                  // Add instructions for playing audio
                                  await logToTerminal(`🎧 TO LISTEN TO AUDIO: Click the "🎵 Play Audio" button below to hear specific segments`);
                                  
                                  // Show volume range
                                  const volumes = levels.map(([_, vol]) => vol);
                                  const minVol = Math.min(...volumes);
                                  const maxVol = Math.max(...volumes);
                                  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
                                  await logToTerminal(`📊 VOLUME RANGE: ${minVol.toFixed(1)}dB to ${maxVol.toFixed(1)}dB (avg: ${avgVol.toFixed(1)}dB)`);
                                  
                                  // Show how this compares to current threshold
                                  await logToTerminal(`🎯 CURRENT THRESHOLD: ${noiseThreshold}dB`);
                                  const belowThreshold = volumes.filter(vol => vol < noiseThreshold).length;
                                  await logToTerminal(`📉 SAMPLES BELOW THRESHOLD: ${belowThreshold}/${levels.length} (${(belowThreshold/levels.length*100).toFixed(1)}%)`);
                                } catch (error) {
                                  console.error('Audio analysis failed:', error);
                                  await logToTerminal(`❌ Audio analysis failed: ${error}`);
                                }
                              }}
                            >
                              📊 Analyze Audio
                            </button>
                            <button 
                              className="test-tone-btn" 
                              onClick={async () => {
                                try {
                                  await logToTerminal(`🎵 Playing test tone at current threshold: ${noiseThreshold}dB`);
                                  await invoke('play_test_tone', {
                                    volumeDb: noiseThreshold,
                                    duration: 2.0
                                  });
                                  await logToTerminal(`✅ Test tone played at ${noiseThreshold}dB`);
                                } catch (error) {
                                  await logToTerminal(`❌ Test tone failed: ${error}`);
                                }
                              }}
                            >
                              🔊 Test {noiseThreshold}dB
                            </button>
                            
                            <button 
                              className="test-tone-btn" 
                              onClick={async () => {
                                try {
                                  await logToTerminal(`🎵 Playing test tones at common levels...`);
                                  const levels = [-30, -40, -50, -60];
                                  for (const level of levels) {
                                    await logToTerminal(`  🔊 Playing ${level}dB tone...`);
                                    await invoke('play_test_tone', {
                                      volumeDb: level,
                                      duration: 1.5
                                    });
                                    await new Promise(resolve => setTimeout(resolve, 500)); // Pause between tones
                                  }
                                  await logToTerminal(`✅ Test tone sequence complete`);
                                } catch (error) {
                                  await logToTerminal(`❌ Test tone sequence failed: ${error}`);
                                }
                              }}
                            >
                              🎵 Test Levels
                            </button>
                            
                            <button 
                              className="play-audio-btn" 
                              onClick={async () => {
                                if (!videoPath) {
                                  alert('Please upload a video first');
                                  return;
                                }
                                const timestamp = prompt('Enter timestamp to play (e.g., 5.2 for 5.2 seconds):');
                                if (timestamp) {
                                  const time = parseFloat(timestamp);
                                  if (!isNaN(time) && time >= 0) {
                                    try {
                                      await logToTerminal(`🎵 Playing audio at ${time}s for 1 second...`);
                                      await invoke('play_audio_segment', {
                                        filePath: videoPath,
                                        startTime: time,
                                        duration: 1.0
                                      });
                                      await logToTerminal(`✅ Audio played from ${time}s to ${time + 1}s`);
                                    } catch (error) {
                                      console.error('Audio playback failed:', error);
                                      await logToTerminal(`❌ Audio playback failed: ${error}`);
                                    }
                                  } else {
                                    alert('Please enter a valid number');
                                  }
                                }
                              }}
                            >
                              🎵 Play Audio
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Silence Control Buttons */}
                      {hasSilenceDetection && (
                        <div className="silence-controls">
                          <button 
                            className="exclude-all-btn"
                            onClick={excludeAllSilence}
                          >
                            ✂️ Exclude All Silent Parts
                          </button>
                          <button 
                            className="include-all-btn"
                            onClick={includeAllSilence}
                          >
                            ➕ Include All Silent Parts
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
                      {exportedFilePath && !isExporting && (
                        <button 
                          className="open-location-btn"
                          onClick={openExportedFileLocation}
                        >
                          📁 Open File Location
                        </button>
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
                        className={`inline-word ${!segment.keep ? 'removed' : ''} ${segment.isSilence ? 'silence-segment' : ''} ${segment.isSplit ? 'split-segment' : ''} ${segment.id === currentSegmentId ? 'active' : ''} ${segment.id === selectedWordId ? 'selected' : ''}`}
                        onClick={() => {
                          console.log('🎯 SEGMENT CLICKED:', {
                            id: segment.id,
                            text: segment.text,
                            start: segment.start,
                            end: segment.end,
                            keep: segment.keep,
                            isSilence: segment.isSilence
                          });
                          // Select the word to show actions
                          setSelectedWordId(segment.id === selectedWordId ? null : segment.id);
                          // Still jump to the segment
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
                        {segment.isSilence ? (
                          <span className="silence-content">
                            🔇 Silence ({(segment.end - segment.start).toFixed(1)}s)
                          </span>
                        ) : (
                          segment.text
                        )}
                        {/* Hover tooltip - just timestamp info */}
                        <div className="word-hover-info">
                          <span className="hover-time">
                            {Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(1).padStart(4, '0')}
                          </span>
                          <span className="hover-duration">({(segment.end - segment.start).toFixed(1)}s)</span>
                        </div>
                        {/* Action panel - shown only when selected */}
                        {segment.id === selectedWordId && (
                          <div className="word-action-panel">
                            {segment.isSilence ? (
                              <button 
                                className="action-btn silence-toggle-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('🔇 SILENCE TOGGLE CLICKED:', {
                                    segmentId: segment.id,
                                    start: segment.start,
                                    end: segment.end,
                                    currentKeep: segment.keep,
                                    newKeep: !segment.keep
                                  });
                                  toggleSilenceRegion(segment.start, segment.end);
                                }}
                                title={segment.keep ? "Exclude this silence" : "Include this silence"}
                              >
                                {segment.keep ? "✂️ Exclude" : "➕ Include"}
                              </button>
                            ) : (
                              <>
                                <button 
                                  className="action-btn toggle-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('✂️ ACTION TOGGLE CLICKED:', {
                                      segmentId: segment.id,
                                      text: segment.text,
                                      currentKeep: segment.keep,
                                      newKeep: !segment.keep
                                    });
                                    handleSegmentToggle(segment.id);
                                  }}
                                  title={segment.keep ? "Remove this segment" : "Keep this segment"}
                                >
                                  {segment.keep ? "✂️ Cut" : "✓ Keep"}
                                </button>
                                <button 
                                  className="action-btn edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(segment);
                                  }}
                                  title="Edit text"
                                >
                                  ✏️ Edit
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
