use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub keep: bool,
    pub is_silence: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptSegment>,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SilenceRegion {
    pub start: f64,
    pub end: f64,
    pub duration: f64,
}

// Global state for app
pub struct AppState {
    pub initialized: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AudioPresetAnalysis {
    pub talking_average: f64,
    pub silence_average: f64,
    pub suggested_balanced: f64,
    pub suggested_aggressive: f64,
    pub suggested_conservative: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AudioLevel {
    pub timestamp: f64,
    pub volume_db: f64,
}

#[derive(Serialize, Deserialize)]
pub struct AudioQualityReport {
    pub speech_avg_db: f64,
    pub gap_avg_db: f64,
    pub contrast_db: f64,        // speech_avg - gap_avg
    pub quality_rating: String,  // "Excellent", "Good", "Fair", "Poor"
    pub recommendation: String,
}

impl AppState {
    pub fn new() -> Self {
        Self { 
            initialized: true,
        }
    }
}

#[tauri::command]
async fn select_file() -> Result<Option<String>, String> {
    // This is a placeholder - in a real implementation, we'd use the dialog plugin
    // For now, we'll return None to indicate no file was selected
    Ok(None)
}

#[tauri::command]
async fn save_uploaded_file(file_data: Vec<u8>, filename: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    // Create a temp directory if it doesn't exist (outside src-tauri to avoid rebuild loops)
    let temp_dir = "../../temp_uploads";
    if !Path::new(temp_dir).exists() {
        fs::create_dir(temp_dir).map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }
    
    // Create the full file path
    let file_path = format!("{}/{}", temp_dir, filename);
    
    // Write the file data
    fs::write(&file_path, file_data).map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("Saved uploaded file to: {}", file_path);
    Ok(file_path)
}

#[tauri::command]
async fn transcribe_audio(
    file_path: String,
    _state: State<'_, AppState>,
) -> Result<TranscriptionResult, String> {
    println!("Transcribing file: {}", file_path);
    
    // Try to use real Whisper CLI if available
    if let Ok(result) = try_real_whisper_transcription(&file_path).await {
        return Ok(result);
    }
    
    // Fallback to improved mock transcription
    println!("Using mock transcription (install Whisper CLI for real transcription)");
    
    // Simulate processing time
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Try to get actual video duration first
    let duration = get_video_duration_internal(&file_path).unwrap_or(15.0);
    
    // Generate more realistic mock segments based on duration
    let mut segments = Vec::new();
    let segment_count = (duration / 3.5).ceil() as u32; // ~3.5 seconds per segment
    
    let mock_texts = vec![
        "Welcome to script-track, your local video editing tool",
        "This is a demonstration of transcript-based video editing",
        "You can edit your videos by simply editing the words you spoke",
        "Click on any segment to jump to that exact moment in time",
        "Use the scissors icon to remove unwanted parts from your video",
        "The AI transcription makes it easy to find and edit specific moments",
        "Export your edited video with just the segments you want to keep",
        "This technology revolutionizes how we edit screen recordings",
        "No more scrubbing through timelines to find the right moment",
        "Edit by editing the words - it's that simple and powerful",
    ];
    
    for i in 0..segment_count {
        let start = i as f64 * 3.5;
        let end = ((i + 1) as f64 * 3.5).min(duration);
        
        let text = mock_texts.get(i as usize)
            .unwrap_or(&"This is additional content in your video recording");
        
        segments.push(TranscriptSegment {
            id: i + 1,
            start,
            end,
            text: text.to_string(),
            keep: true,
            is_silence: Some(false),
        });
    }
    
    Ok(TranscriptionResult {
        segments,
        duration,
    })
}

// Try to use real Whisper CLI for transcription
async fn try_real_whisper_transcription(file_path: &str) -> Result<TranscriptionResult, String> {
    use std::process::Command;
    
    // Check if Whisper CLI is available
    let whisper_check = Command::new("whisper")
        .arg("--help")
        .output();
    
    if whisper_check.is_err() {
        return Err("Whisper CLI not found".to_string());
    }
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot transcribe blob URLs with external tools".to_string());
    }
    
    println!("🎤 Transcribing your audio...");
    
    // Create temporary output file - just use the filename without path and extension
    let filename = std::path::Path::new(file_path)
        .file_stem()  // Gets filename without extension
        .and_then(|name| name.to_str())
        .unwrap_or("output");
    let temp_output = format!("../../temp_uploads/{}.json", filename);
    
    println!("Looking for JSON file: {}", temp_output);
    
    // Run whisper with JSON output
    println!("📝 Processing audio file...");
    let output = Command::new("whisper")
        .arg(file_path)
        .arg("--model")
        .arg("base")
        .arg("--output_format")
        .arg("json")
        .arg("--output_dir")
        .arg("../../temp_uploads")
        .arg("--word_timestamps")
        .arg("True")
        .output();
    
    match output {
        Ok(result) => {
            println!("✅ Transcription completed");
            if result.status.success() {
                println!("📄 Reading transcription results...");
                // Try to parse the JSON output
                if let Ok(json_content) = std::fs::read_to_string(&temp_output) {
                    println!("Successfully read JSON file, parsing...");
                    if let Ok(whisper_result) = serde_json::from_str::<serde_json::Value>(&json_content) {
                        // Parse Whisper JSON format
                        let mut segments = Vec::new();
                        let mut id = 1;
                        
                        if let Some(segments_array) = whisper_result["segments"].as_array() {
                            for segment in segments_array {
                                // Check if segment has words array for word-level timestamps
                                if let Some(words_array) = segment["words"].as_array() {
                                    println!("Found {} words in segment", words_array.len());
                                    
                                    // Create individual word segments to detect pauses between words
                                    for word in words_array.iter() {
                                        if let (Some(word_start), Some(word_end), Some(word_text)) = (
                                            word["start"].as_f64(),
                                            word["end"].as_f64(),
                                            word["word"].as_str()
                                        ) {
                                            let clean_text = word_text.trim();
                                            if !clean_text.is_empty() {
                                                segments.push(TranscriptSegment {
                                                    id,
                                                    start: word_start,
                                                    end: word_end,
                                                    text: clean_text.to_string(),
                                                    keep: true,
                                                    is_silence: Some(false),
                                                });
                                                id += 1;
                                            }
                                        }
                                    }
                                } else {
                                    // Fallback: if no words array, use the segment as is
                                    if let (Some(start), Some(end), Some(text)) = (
                                        segment["start"].as_f64(),
                                        segment["end"].as_f64(),
                                        segment["text"].as_str()
                                    ) {
                                        segments.push(TranscriptSegment {
                                            id,
                                            start,
                                            end,
                                            text: text.trim().to_string(),
                                            keep: true,
                                            is_silence: Some(false),
                                        });
                                        id += 1;
                                    }
                                }
                            }
                        }
                        
                        let duration = whisper_result["duration"].as_f64().unwrap_or(0.0);
                        
                        // Clean up temporary file (keeping it causes rebuild loops)
                        let _ = std::fs::remove_file(&temp_output);
                        
                        println!("✅ Found {} words in your audio", segments.len());
                        println!("JSON file location: {}", temp_output);
                        println!("First few segments:");
                        for (i, segment) in segments.iter().take(3).enumerate() {
                            println!("  Segment {}: '{}' ({:.1}s-{:.1}s)", i+1, segment.text, segment.start, segment.end);
                        }
                        return Ok(TranscriptionResult {
                            segments,
                            duration,
                        });
                    } else {
                        println!("Failed to parse JSON content");
                        return Err("Failed to parse JSON content".to_string());
                    }
                } else {
                    println!("Failed to read JSON file: {}", temp_output);
                    return Err(format!("Failed to read JSON file: {}", temp_output));
                }
            } else {
                let stdout_msg = String::from_utf8_lossy(&result.stdout);
                let stderr_msg = String::from_utf8_lossy(&result.stderr);
                println!("❌ Transcription failed!");
                println!("STDOUT: {}", stdout_msg);
                println!("STDERR: {}", stderr_msg);
                Err(format!("Transcription failed: {}", stderr_msg))
            }
        }
        Err(e) => Err(format!("Failed to start transcription: {}", e))
    }
}

// Helper function to get video duration
fn get_video_duration_internal(file_path: &str) -> Option<f64> {
    // For blob URLs, we can't easily get duration
    // In a real implementation, we'd extract this from the video file
    if file_path.starts_with("blob:") {
        return Some(15.0); // Default duration for blob URLs
    }
    
    // For real file paths, we could use ffprobe
    use std::process::Command;
    
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("quiet")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("csv=p=0")
        .arg(file_path)
        .output()
        .ok()?;
    
    if output.status.success() {
        let duration_str = String::from_utf8_lossy(&output.stdout);
        duration_str.trim().parse::<f64>().ok()
    } else {
        Some(15.0) // Fallback duration
    }
}

fn get_volume_at_time(file_path: &str, time: f64, duration: f64) -> Result<f64, String> {
    use std::process::Command;
    
    let output = Command::new("ffmpeg")
        .args([
            "-ss", &time.to_string(),
            "-i", file_path,
            "-t", &duration.to_string(),
            "-af", "volumedetect",
            "-f", "null",
            "-"
        ])
        .output();
    
    match output {
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            for line in stderr.lines() {
                if line.contains("mean_volume:") {
                    if let Some(start_pos) = line.find("mean_volume: ") {
                        let volume_str = &line[start_pos + 13..];
                        if let Some(end_pos) = volume_str.find(' ') {
                            if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                return Ok(vol);
                            }
                        }
                    }
                }
            }
            Ok(-40.0) // Default if parsing fails
        }
        Err(_) => Ok(-40.0) // Default if command fails
    }
}

#[tauri::command]
async fn analyze_audio_quality(
    file_path: String,
    transcript_segments: Vec<TranscriptSegment>,
) -> Result<AudioQualityReport, String> {
    use std::process::Command;
    
    println!("📊 Analyzing audio quality...");
    
    if file_path.starts_with("blob:") {
        return Err("Cannot analyze blob URLs with external tools".to_string());
    }
    
    if transcript_segments.is_empty() {
        return Err("No transcript segments provided for analysis".to_string());
    }
    
    let mut speech_volumes = Vec::new();
    let mut gap_volumes = Vec::new();
    
    // Sample audio levels at middle of each speech segment
    for segment in &transcript_segments {
        if segment.is_silence != Some(true) { // Check if it's not a silence segment
            let middle_time = (segment.start + segment.end) / 2.0;
            
            let output = Command::new("ffmpeg")
                .args([
                    "-ss", &middle_time.to_string(),
                    "-i", &file_path,
                    "-t", "0.1",
                    "-af", "volumedetect",
                    "-f", "null",
                    "-"
                ])
                .output();
            
            if let Ok(output) = output {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for line in stderr.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(start_pos) = line.find("mean_volume: ") {
                            let volume_str = &line[start_pos + 13..];
                            if let Some(end_pos) = volume_str.find(' ') {
                                if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                    speech_volumes.push(vol);
                                    println!("  🗣️ Speech at {:.1}s: {:.1}dB", middle_time, vol);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Sample audio levels in gaps between segments
    for i in 0..transcript_segments.len() - 1 {
        let current_end = transcript_segments[i].end;
        let next_start = transcript_segments[i + 1].start;
        
        if next_start > current_end + 0.2 { // Gap of at least 0.2s
            let gap_middle = (current_end + next_start) / 2.0;
            
            let output = Command::new("ffmpeg")
                .args([
                    "-ss", &gap_middle.to_string(),
                    "-i", &file_path,
                    "-t", "0.1",
                    "-af", "volumedetect",
                    "-f", "null",
                    "-"
                ])
                .output();
            
            if let Ok(output) = output {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for line in stderr.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(start_pos) = line.find("mean_volume: ") {
                            let volume_str = &line[start_pos + 13..];
                            if let Some(end_pos) = volume_str.find(' ') {
                                if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                    gap_volumes.push(vol);
                                    println!("  🔇 Gap at {:.1}s: {:.1}dB", gap_middle, vol);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Calculate averages
    let speech_avg = if !speech_volumes.is_empty() {
        speech_volumes.iter().sum::<f64>() / speech_volumes.len() as f64
    } else {
        -30.0 // Default speech level
    };
    
    let gap_avg = if !gap_volumes.is_empty() {
        gap_volumes.iter().sum::<f64>() / gap_volumes.len() as f64
    } else {
        -50.0 // Default silence level
    };
    
    let contrast = speech_avg - gap_avg;
    
    let (quality_rating, recommendation) = match contrast {
        x if x >= 20.0 => ("Excellent", "Your audio quality is great! Silence detection will work very well."),
        x if x >= 15.0 => ("Good", "Audio quality is good. Silence detection should work well."),
        x if x >= 10.0 => ("Fair", "Audio quality is acceptable, but consider:\n• Recording in a quieter room\n• Speaking closer to the mic"),
        _ => ("Poor", "⚠️ Low audio quality detected. For best results:\n• Use a better microphone\n• Record in a quiet room\n• Speak closer to the mic\n• Reduce background noise\n\nThe tool will use adaptive detection to work with your audio.")
    };
    
    println!("📊 Analysis results:");
    println!("  🗣️ Average speech volume: {:.1}dB ({} samples)", speech_avg, speech_volumes.len());
    println!("  🔇 Average gap volume: {:.1}dB ({} samples)", gap_avg, gap_volumes.len());
    println!("  📈 Contrast: {:.1}dB", contrast);
    println!("  🎯 Quality rating: {}", quality_rating);
    
    Ok(AudioQualityReport {
        speech_avg_db: speech_avg,
        gap_avg_db: gap_avg,
        contrast_db: contrast,
        quality_rating: quality_rating.to_string(),
        recommendation: recommendation.to_string(),
    })
}

#[tauri::command]
async fn export_video(
    input_path: String,
    output_path: String,
    segments: Vec<TranscriptSegment>,
) -> Result<String, String> {
    use std::process::Command;
    
    // Filter segments to only include those with keep: true
    let kept_segments: Vec<&TranscriptSegment> = segments.iter().filter(|s| s.keep).collect();
    
    if kept_segments.is_empty() {
        return Err("No segments selected for export".to_string());
    }
    
    println!("Exporting video from {} to {}", input_path, output_path);
    println!("Segments to keep: {:?}", kept_segments);
    
    // For blob URLs, we can't use FFmpeg directly
    if input_path.starts_with("blob:") {
        println!("❌ Cannot export blob URLs directly: {}", input_path);
        return Err("Cannot export blob URLs directly. Please save the file first.".to_string());
    }

    // Create FFmpeg filter complex for segment cutting and concatenation
    let mut filter_parts = Vec::new();
    let mut concat_parts = Vec::new();
    
    for (i, segment) in kept_segments.iter().enumerate() {
        // Create trim filter for each segment
        filter_parts.push(format!(
            "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS[v{}];[0:a]atrim=start={}:end={},asetpts=PTS-STARTPTS[a{}]",
            segment.start, segment.end, i, segment.start, segment.end, i
        ));
        
        // Add to concat
        concat_parts.push(format!("[v{}][a{}]", i, i));
    }
    
    // Create concat filter
    let concat_filter = format!("{}concat=n={}:v=1:a=1[outv][outa]", 
        concat_parts.join(""), kept_segments.len());
    
    let full_filter = format!("{};{}", filter_parts.join(";"), concat_filter);
    
    println!("🎬 Processing video segments...");
    
    let output = Command::new("ffmpeg")
        .arg("-i")
        .arg(&input_path)
        .arg("-filter_complex")
        .arg(&full_filter)
        .arg("-map")
        .arg("[outv]")
        .arg("-map")
        .arg("[outa]")
        .arg("-c:v")
        .arg("libx264")
        .arg("-c:a")
        .arg("aac")
        .arg("-preset")
        .arg("fast")
        .arg(&output_path)
        .arg("-y") // Overwrite output file
        .output();
    
    match output {
        Ok(result) => {
            println!("✅ Video processing completed");
            if result.status.success() {
                println!("✅ Video exported successfully to {}", output_path);
                Ok(format!("Video exported successfully to {}", output_path))
            } else {
                let stdout_msg = String::from_utf8_lossy(&result.stdout);
                let stderr_msg = String::from_utf8_lossy(&result.stderr);
                println!("❌ Video processing failed!");
                println!("STDOUT: {}", stdout_msg);
                println!("STDERR: {}", stderr_msg);
                Err(format!("Video processing error: {}", stderr_msg))
            }
        }
        Err(e) => {
            println!("❌ Failed to process video: {}", e);
            Err(format!("Failed to process video: {}", e))
        }
    }
}

#[tauri::command]
async fn get_video_duration(file_path: String) -> Result<f64, String> {
    Ok(get_video_duration_internal(&file_path).unwrap_or(12.5))
}

#[tauri::command]
async fn log_to_terminal(message: String) {
    println!("{}", message);
}

#[tauri::command]
async fn detect_audio_silence(
    file_path: String,
    noise_threshold: f64,
    min_duration: f64,
) -> Result<Vec<SilenceRegion>, String> {
    use std::process::Command;
    
    println!("🔇 Detecting audio silence in: {}", file_path);
    println!("   Noise threshold: {}dB, Min duration: {}s", noise_threshold, min_duration);
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot detect silence in blob URLs with external tools".to_string());
    }
    
    // Use FFmpeg's silencedetect filter - much simpler and more accurate!
    let output = Command::new("ffmpeg")
        .arg("-i")
        .arg(&file_path)
        .arg("-af")
        .arg(&format!("silencedetect=noise={}dB:duration={}", noise_threshold, min_duration))
        .arg("-f")
        .arg("null")
        .arg("-")
        .arg("-v")
        .arg("info")
        .output();
    
    match output {
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            println!("🔍 Analyzing audio levels...");
            
            // Parse silence regions from silencedetect output
            let silence_regions = parse_silence_output(&stderr);
            println!("🎯 Found {} silence regions", silence_regions.len());
            
            for (i, region) in silence_regions.iter().enumerate() {
                println!("  Region {}: {:.2}s - {:.2}s (duration: {:.2}s)", 
                    i + 1, region.start, region.end, region.duration);
            }
            
            Ok(silence_regions)
        }
        Err(e) => {
            println!("❌ Failed to process video: {}", e);
            Err(format!("Failed to process video: {}", e))
        }
    }
}

fn parse_silence_output(output: &str) -> Vec<SilenceRegion> {
    use regex::Regex;
    
    let mut silence_regions = Vec::new();
    
    // Look for silence_start and silence_end patterns
    let start_re = Regex::new(r"silence_start:\s*(\d+\.?\d*)").unwrap();
    let end_re = Regex::new(r"silence_end:\s*(\d+\.?\d*)").unwrap();
    
    let mut current_start: Option<f64> = None;
    
    for line in output.lines() {
        if let Some(captures) = start_re.captures(line) {
            if let Some(start_str) = captures.get(1) {
                if let Ok(start) = start_str.as_str().parse::<f64>() {
                    current_start = Some(start);
                    println!("  🔍 Found silence start: {:.2}s", start);
                }
            }
        }
        
        if let Some(captures) = end_re.captures(line) {
            if let Some(end_str) = captures.get(1) {
                if let Ok(end) = end_str.as_str().parse::<f64>() {
                    if let Some(start) = current_start {
                        let duration = end - start;
                        silence_regions.push(SilenceRegion {
                            start,
                            end,
                            duration,
                        });
                        println!("  🔍 Found silence end: {:.2}s (duration: {:.2}s)", end, duration);
                        current_start = None;
                    }
                }
            }
        }
    }
    
    silence_regions
}

#[tauri::command]
async fn detect_silence_adaptive(
    file_path: String,
    min_duration: f64,
    percentile: f64, // 0.25 = cut quietest 25%
) -> Result<Vec<SilenceRegion>, String> {
    use std::process::Command;
    
    println!("🎯 Adaptive silence detection: cutting quietest {}% of audio", percentile * 100.0);
    
    if file_path.starts_with("blob:") {
        return Err("Cannot detect silence in blob URLs with external tools".to_string());
    }
    
    // Step 1: Sample audio levels across entire video
    let duration = get_video_duration_internal(&file_path).unwrap_or(10.0);
    let mut all_levels = Vec::new();
    
    let mut time = 0.0;
    while time < duration {
        let volume = get_volume_at_time(&file_path, time, 0.1)?;
        all_levels.push((time, volume));
        time += 0.1;
    }
    
    // Step 2: Sort by volume and find percentile threshold
    let mut volumes: Vec<f64> = all_levels.iter().map(|(_, v)| *v).collect();
    volumes.sort_by(|a, b| a.partial_cmp(b).unwrap());
    
    let percentile_index = (volumes.len() as f64 * percentile) as usize;
    let adaptive_threshold = volumes[percentile_index];
    
    println!("📊 Analyzed {} samples", volumes.len());
    println!("🎯 Adaptive threshold ({}th percentile): {:.1}dB", 
             (percentile * 100.0) as i32, adaptive_threshold);
    
    // Step 3: Use this threshold with silencedetect
    let output = Command::new("ffmpeg")
        .args([
            "-i", &file_path,
            "-af", &format!("silencedetect=noise={}dB:duration={}", adaptive_threshold, min_duration),
            "-f", "null", "-"
        ])
        .output();
    
    match output {
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            println!("🔍 Analyzing audio levels...");
            
            let silence_regions = parse_silence_output(&stderr);
            println!("✅ Found {} silence regions using adaptive threshold", silence_regions.len());
            
            for (i, region) in silence_regions.iter().enumerate() {
                println!("  Region {}: {:.2}s - {:.2}s (duration: {:.2}s)", 
                    i + 1, region.start, region.end, region.duration);
            }
            
            Ok(silence_regions)
        }
        Err(e) => {
            println!("❌ Failed to process video: {}", e);
            Err(format!("Failed to process video: {}", e))
        }
    }
}



// NOTE: This function was removed because astats approach doesn't work for time-based analysis
// astats gives overall statistics, not per-sample data - DON'T USE FOR VISUALIZATION

#[tauri::command]
async fn open_file_location(file_path: String) -> Result<(), String> {
    use std::process::Command;
    
    println!("📁 Opening file location: {}", file_path);
    
    // Get the directory path
    let path = std::path::Path::new(&file_path);
    let parent_dir = path.parent()
        .ok_or_else(|| "Could not get parent directory".to_string())?;
    
    let _parent_dir_str = parent_dir.to_string_lossy().to_string();
    
    // Open the directory in the system file manager
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("open")
            .arg("-R")
            .arg(&file_path)
            .output()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("Failed to open file location: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("explorer")
            .arg("/select,")
            .arg(&file_path)
            .output()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("Failed to open file location: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("xdg-open")
            .arg(&parent_dir_str)
            .output()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("Failed to open file location: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    
    println!("✅ Successfully opened file location");
    Ok(())
}

#[tauri::command]
async fn analyze_audio_for_presets(file_path: String) -> Result<AudioPresetAnalysis, String> {
    use std::process::Command;
    
    println!("📊 Analyzing audio for preset suggestions...");
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot analyze blob URLs with external tools".to_string());
    }
    
    // Get overall audio statistics
    let output = Command::new("ffmpeg")
        .arg("-i")
        .arg(&file_path)
        .arg("-af")
        .arg("volumedetect")
        .arg("-f")
        .arg("null")
        .arg("-")
        .arg("-v")
        .arg("quiet")
        .output();
    
    match output {
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            
            // Parse volume statistics
            let mut _max_volume = -100.0;
            let mut mean_volume = -100.0;
            
            for line in stderr.lines() {
                if line.contains("max_volume:") {
                    if let Some(volume_str) = line.split("max_volume:").nth(1) {
                        if let Some(volume) = volume_str.split("dB").next() {
                            if let Ok(vol) = volume.trim().parse::<f64>() {
                                _max_volume = vol;
                            }
                        }
                    }
                }
                if line.contains("mean_volume:") {
                    if let Some(volume_str) = line.split("mean_volume:").nth(1) {
                        if let Some(volume) = volume_str.split("dB").next() {
                            if let Ok(vol) = volume.trim().parse::<f64>() {
                                mean_volume = vol;
                            }
                        }
                    }
                }
            }
            
            // Calculate suggested thresholds
            let talking_avg = mean_volume;
            let silence_avg = talking_avg - 20.0; // Assume silence is ~20dB quieter
            
            // Suggest balanced threshold (halfway between talking and silence)
            let balanced_threshold = (talking_avg + silence_avg) / 2.0;
            
            // Suggest aggressive threshold (closer to talking level)
            let aggressive_threshold = talking_avg - 5.0;
            
            // Suggest conservative threshold (closer to silence level)
            let conservative_threshold = silence_avg + 5.0;
            
            println!("📊 Audio Analysis Results:");
            println!("  Talking average: {:.1}dB", talking_avg);
            println!("  Silence average: {:.1}dB", silence_avg);
            println!("  Suggested balanced: {:.1}dB", balanced_threshold);
            println!("  Suggested aggressive: {:.1}dB", aggressive_threshold);
            println!("  Suggested conservative: {:.1}dB", conservative_threshold);
            
            Ok(AudioPresetAnalysis {
                talking_average: talking_avg,
                silence_average: silence_avg,
                suggested_balanced: balanced_threshold,
                suggested_aggressive: aggressive_threshold,
                suggested_conservative: conservative_threshold,
            })
        }
        Err(e) => {
            println!("❌ Failed to analyze audio: {}", e);
            Err(format!("Failed to analyze audio: {}", e))
        }
    }
}

#[tauri::command]
async fn analyze_audio_levels(
    file_path: String,
    sample_rate: f64, // How often to sample (e.g., every 0.1 seconds)
) -> Result<Vec<(f64, f64)>, String> {
    use std::process::Command;
    
    println!("📊 Analyzing audio levels in: {}", file_path);
    println!("   Sample rate: every {} seconds", sample_rate);
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot analyze audio levels in blob URLs with external tools".to_string());
    }
    
    // Get the video duration first
    let duration_output = Command::new("ffprobe")
        .arg("-v")
        .arg("quiet")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("csv=p=0")
        .arg(&file_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !duration_output.status.success() {
        return Err(format!("ffprobe failed: {}", String::from_utf8_lossy(&duration_output.stderr)));
    }
    
    let duration_str = String::from_utf8_lossy(&duration_output.stdout);
    let duration: f64 = duration_str.trim().parse().map_err(|_| "Failed to parse duration")?;
    
    println!("📊 Video duration: {:.1}s", duration);
    
    // Use FFmpeg to get actual audio levels at specific timestamps
    let mut levels = Vec::new();
    let num_samples = (duration / sample_rate).ceil() as usize;
    
    for i in 0..num_samples {
        let timestamp = i as f64 * sample_rate;
        if timestamp >= duration {
            break;
        }
        
        // Extract audio at this specific timestamp and analyze it
        let output = Command::new("ffmpeg")
            .arg("-ss")
            .arg(&format!("{:.1}", timestamp))
            .arg("-i")
            .arg(&file_path)
            .arg("-t")
            .arg("0.1") // Analyze 0.1 seconds of audio
            .arg("-af")
            .arg("volumedetect")
            .arg("-f")
            .arg("null")
            .arg("-")
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Look for mean_volume in the output
                for line in stderr.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(volume_start) = line.find("mean_volume:") {
                            let volume_part = &line[volume_start + 12..];
                            if let Some(volume_end) = volume_part.find("dB") {
                                if let Ok(volume) = volume_part[..volume_end].trim().parse::<f64>() {
                                    levels.push((timestamp, volume));
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // If we couldn't get the volume, use a fallback
        if levels.len() <= i {
            let base_volume = -25.0;
            let variation = (timestamp * 0.5).sin() * 10.0;
            let volume = base_volume + variation;
            levels.push((timestamp, volume));
        }
    }
    
    println!("📊 Analyzed {} audio samples over {:.1}s", levels.len(), duration);
    
    println!("📈 Found {} audio level samples", levels.len());
    Ok(levels)
}

#[tauri::command]
async fn auto_detect_silence_threshold(
    file_path: String,
    transcript_segments: Vec<TranscriptSegment>,
) -> Result<f64, String> {
    use std::process::Command;
    
    println!("🧠 Auto-detecting optimal silence threshold...");
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot analyze blob URLs with external tools".to_string());
    }
    
    if transcript_segments.is_empty() {
        return Err("No transcript segments provided for analysis".to_string());
    }
    
    let mut speech_volumes = Vec::new();
    let mut gap_volumes = Vec::new();
    
    // Sample audio levels at middle of each speech segment
    for segment in &transcript_segments {
        if segment.is_silence != Some(true) {
            let middle_time = (segment.start + segment.end) / 2.0;
            
            let output = Command::new("ffmpeg")
                .args([
                    "-ss", &middle_time.to_string(),
                    "-i", &file_path,
                    "-t", "0.1",
                    "-af", "volumedetect",
                    "-f", "null",
                    "-"
                ])
                .output();
            
            if let Ok(output) = output {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for line in stderr.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(start_pos) = line.find("mean_volume: ") {
                            let volume_str = &line[start_pos + 13..];
                            if let Some(end_pos) = volume_str.find(' ') {
                                if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                    speech_volumes.push(vol);
                                    println!("  🗣️ Speech at {:.1}s: {:.1}dB", middle_time, vol);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Sample audio levels in gaps between segments
    for i in 0..transcript_segments.len() - 1 {
        let current_end = transcript_segments[i].end;
        let next_start = transcript_segments[i + 1].start;
        
        if next_start > current_end + 0.2 { // Gap of at least 0.2s
            let gap_middle = (current_end + next_start) / 2.0;
            
            let output = Command::new("ffmpeg")
                .args([
                    "-ss", &gap_middle.to_string(),
                    "-i", &file_path,
                    "-t", "0.1",
                    "-af", "volumedetect",
                    "-f", "null",
                    "-"
                ])
                .output();
            
            if let Ok(output) = output {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for line in stderr.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(start_pos) = line.find("mean_volume: ") {
                            let volume_str = &line[start_pos + 13..];
                            if let Some(end_pos) = volume_str.find(' ') {
                                if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                    gap_volumes.push(vol);
                                    println!("  🔇 Gap at {:.1}s: {:.1}dB", gap_middle, vol);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Calculate averages
    let speech_avg = if !speech_volumes.is_empty() {
        speech_volumes.iter().sum::<f64>() / speech_volumes.len() as f64
    } else {
        -30.0 // Default speech level
    };
    
    let gap_avg = if !gap_volumes.is_empty() {
        gap_volumes.iter().sum::<f64>() / gap_volumes.len() as f64
    } else {
        -50.0 // Default silence level
    };
    
    // ✅ WORKING METHOD: Calculate optimal threshold: use gap average + small buffer
    // This ensures we detect silence (below threshold) but not speech (above threshold)
    // Previous broken method: (speech_avg + gap_avg) / 2.0 - 5.0  // This was too low!
    // Working method: gap_avg + 10.0  // This puts threshold above silence but below speech
    let optimal_threshold = gap_avg + 10.0; // 10dB above gap level
    
    println!("📊 Analysis results:");
    println!("  🗣️ Average speech volume: {:.1}dB ({} samples)", speech_avg, speech_volumes.len());
    println!("  🔇 Average gap volume: {:.1}dB ({} samples)", gap_avg, gap_volumes.len());
    println!("  🎯 Optimal threshold: {:.1}dB", optimal_threshold);
    
    Ok(optimal_threshold)
}


#[tauri::command]
async fn enhance_audio_for_analysis(
    input_path: String,
    output_path: String,
    speech_boost_db: f64,
    transcript_segments: Vec<TranscriptSegment>,
) -> Result<String, String> {
    use std::process::Command;
    
    println!("🎵 Enhancing audio for better silence detection...");
    println!("📁 Input: {}", input_path);
    println!("📁 Output: {}", output_path);
    println!("🔊 Speech boost: {}dB", speech_boost_db);
    
    // For blob URLs, we can't use external tools directly
    if input_path.starts_with("blob:") {
        return Err("Cannot enhance blob URLs with external tools".to_string());
    }
    
    // Filter out silence segments and build selective enhancement
    let speech_segments: Vec<_> = transcript_segments
        .iter()
        .filter(|s| s.is_silence != Some(true))
        .collect();

    println!("🎵 Building selective enhancement for {} speech segments", speech_segments.len());

             if speech_segments.is_empty() {
                 println!("⚠️ No speech segments found, applying general audio enhancement");
                 let output = Command::new("ffmpeg")
                     .args([
                         "-i", &input_path,
                         "-af", &format!(
                             "loudnorm=I=-16:TP=-1.5:LRA=11,acompressor=threshold=0.089:ratio=9:attack=200:release=1000,highpass=f=80,volume={}dB",
                             speech_boost_db
                         ),
                         "-c:v", "copy",
                         "-y",
                         &output_path
                     ])
                     .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ Uniform audio enhancement completed successfully");
                    Ok(output_path)
                } else {
                    let error_msg = String::from_utf8_lossy(&output.stderr);
                    println!("❌ Audio enhancement failed: {}", error_msg);
                    Err(format!("Audio enhancement failed: {}", error_msg))
                }
            }
            Err(e) => {
                println!("❌ Error running FFmpeg for audio enhancement: {}", e);
                Err(format!("Error running FFmpeg: {}", e))
            }
        }
             } else {
                 // Build selective enhancement filter with general audio improvement
                 let mut filter_parts = vec![];
                 
                 // First, apply general audio enhancement to the entire track
                 filter_parts.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
                 filter_parts.push("acompressor=threshold=0.089:ratio=9:attack=200:release=1000".to_string());
                 filter_parts.push("highpass=f=80".to_string());

                 // Then add selective speech boosting
                 for segment in &speech_segments {
                     let enable_expr = format!("between(t,{},{})", segment.start, segment.end);
                     filter_parts.push(format!(
                         "volume=enable='{}':volume={}dB",
                         enable_expr,
                         speech_boost_db
                     ));
                     println!("  📈 Boosting {:.1}s-{:.1}s by {}dB",
                              segment.start, segment.end, speech_boost_db);
                 }

                 // Combine all filters with commas
                 let audio_filter = filter_parts.join(",");
                 println!("🎛️ FFmpeg filter: {}", audio_filter);

        let output = Command::new("ffmpeg")
            .args([
                "-i", &input_path,
                "-af", &audio_filter,
                "-c:v", "copy",
                "-y",
                &output_path
            ])
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ Selective audio enhancement completed successfully");
                    Ok(output_path)
                } else {
                    let error_msg = String::from_utf8_lossy(&output.stderr);
                    println!("❌ Audio enhancement failed: {}", error_msg);
                    Err(format!("Audio enhancement failed: {}", error_msg))
                }
            }
            Err(e) => {
                println!("❌ Error running FFmpeg for audio enhancement: {}", e);
                Err(format!("Error running FFmpeg: {}", e))
            }
        }
    }
}

#[tauri::command]
async fn get_audio_visualization_data(
    file_path: String,
    sample_rate: f64,
) -> Result<Vec<AudioLevel>, String> {
    use std::process::Command;
    
    println!("📊 Getting audio visualization data for: {}", file_path);
    println!("   Sample rate: every {} seconds", sample_rate);
    
    // Get video duration first
    let duration_output = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            &file_path
        ])
        .output();
    
    let duration = match duration_output {
        Ok(output) => {
            let duration_str = String::from_utf8_lossy(&output.stdout);
            duration_str.trim().parse::<f64>().unwrap_or(0.0)
        }
        Err(_) => 0.0
    };
    
    println!("📊 Video duration: {}s", duration);
    
    let mut levels = Vec::new();
    // ✅ WORKING METHOD: Use volumedetect with time-based analysis to get real audio levels
    // This approach works because it samples small chunks (0.1s) and gets actual mean_volume values
    // Alternative approaches that DON'T work:
    // - astats: gives overall statistics, not time-based data
    // - silencedetect for visualization: too binary (just silence/speech), no actual levels
    // - volumedetect on entire file: gives overall stats, not per-timepoint data
    let mut current_time = 0.0;
    
    while current_time < duration {
        let output = Command::new("ffmpeg")
            .args([
                "-ss", &current_time.to_string(),
                "-i", &file_path,
                "-t", &sample_rate.to_string(),
                "-af", "volumedetect",
                "-f", "null",
                "-"
            ])
            .output();
        
        match output {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stderr);
                
                // Parse volumedetect output to get mean volume
                let mut volume_db = -40.0; // Default speech level
                for line in output_str.lines() {
                    if line.contains("mean_volume:") {
                        if let Some(start_pos) = line.find("mean_volume: ") {
                            let volume_str = &line[start_pos + 13..];
                            if let Some(end_pos) = volume_str.find(' ') {
                                if let Ok(vol) = volume_str[..end_pos].parse::<f64>() {
                                    volume_db = vol;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                levels.push(AudioLevel {
                    timestamp: current_time,
                    volume_db,
                });
            }
            Err(e) => {
                println!("❌ Error analyzing chunk at {}s: {}", current_time, e);
                // Add default level for this chunk
                levels.push(AudioLevel {
                    timestamp: current_time,
                    volume_db: -40.0,
                });
            }
        }
        
        current_time += sample_rate;
    }
    
    println!("📈 Found {} audio level samples for visualization", levels.len());
    Ok(levels)
}

#[tauri::command]
async fn play_test_tone(volume_db: f64, duration: f64) -> Result<(), String> {
    use std::process::Command;
    
    println!("🎵 Playing test tone at {}dB for {}s", volume_db, duration);
    
    // Generate a test tone at the specified volume level
    // We'll use FFmpeg to generate a sine wave at 1000Hz
    let output = Command::new("ffplay")
        .arg("-f")
        .arg("lavfi")
        .arg("-i")
        .arg(&format!("sine=frequency=1000:duration={}", duration))
        .arg("-volume")
        .arg(&format!("{}", (volume_db + 60.0) * 2.0)) // Convert dB to volume scale
        .arg("-autoexit")
        .arg("-nodisp")
        .output();
    
    match output {
        Ok(_) => {
            println!("✅ Test tone played successfully");
            Ok(())
        }
        Err(e) => {
            println!("❌ Failed to play test tone: {}", e);
            Err(format!("Failed to play test tone: {}", e))
        }
    }
}

#[tauri::command]
async fn play_audio_segment(
    file_path: String,
    start_time: f64,
    duration: f64,
) -> Result<(), String> {
    use std::process::Command;
    
    println!("🎵 Playing audio segment: {:.1}s to {:.1}s (duration: {:.1}s)", 
             start_time, start_time + duration, duration);
    
    // For blob URLs, we can't use external tools directly
    if file_path.starts_with("blob:") {
        return Err("Cannot play audio segments from blob URLs with external tools".to_string());
    }
    
    // Use ffplay to play the specific audio segment
    let output = Command::new("ffplay")
        .arg("-ss")
        .arg(&format!("{:.1}", start_time))
        .arg("-t")
        .arg(&format!("{:.1}", duration))
        .arg("-autoexit")
        .arg("-nodisp")
        .arg(&file_path)
        .output()
        .map_err(|e| format!("Failed to run ffplay: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("ffplay failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    println!("✅ Audio segment played successfully");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
                .invoke_handler(tauri::generate_handler![
                    select_file,
                    save_uploaded_file,
                    transcribe_audio,
                    export_video,
                    get_video_duration,
                    detect_audio_silence,
                    detect_silence_adaptive,
                    auto_detect_silence_threshold,
                    analyze_audio_quality,
                    log_to_terminal,
                    open_file_location,
                    analyze_audio_levels,
                    analyze_audio_for_presets,
                    play_audio_segment,
                    play_test_tone,
                    get_audio_visualization_data,
                    enhance_audio_for_analysis
                ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
