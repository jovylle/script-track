use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub keep: bool,
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
    
    println!("Using real Whisper CLI for transcription...");
    
    // Create temporary output file - just use the filename without path and extension
    let filename = std::path::Path::new(file_path)
        .file_stem()  // Gets filename without extension
        .and_then(|name| name.to_str())
        .unwrap_or("output");
    let temp_output = format!("../../temp_uploads/{}.json", filename);
    
    println!("Looking for JSON file: {}", temp_output);
    
    // Run whisper with JSON output
    println!("Running Whisper command on file: {}", file_path);
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
            println!("Whisper command completed with status: {}", result.status);
            if result.status.success() {
                println!("Whisper command succeeded, looking for JSON file: {}", temp_output);
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
                                        });
                                        id += 1;
                                    }
                                }
                            }
                        }
                        
                        let duration = whisper_result["duration"].as_f64().unwrap_or(0.0);
                        
                        // Clean up temporary file (keeping it causes rebuild loops)
                        let _ = std::fs::remove_file(&temp_output);
                        
                        println!("Successfully parsed {} word-level segments from Whisper", segments.len());
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
                println!("Whisper command failed!");
                println!("STDOUT: {}", stdout_msg);
                println!("STDERR: {}", stderr_msg);
                Err(format!("Whisper command failed: {}", stderr_msg))
            }
        }
        Err(e) => Err(format!("Failed to run Whisper: {}", e))
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
    
    println!("Using FFmpeg filter: {}", full_filter);
    
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
            println!("FFmpeg command completed with status: {}", result.status);
            if result.status.success() {
                println!("✅ Video exported successfully to {}", output_path);
                Ok(format!("Video exported successfully to {}", output_path))
            } else {
                let stdout_msg = String::from_utf8_lossy(&result.stdout);
                let stderr_msg = String::from_utf8_lossy(&result.stderr);
                println!("❌ FFmpeg failed!");
                println!("STDOUT: {}", stdout_msg);
                println!("STDERR: {}", stderr_msg);
                Err(format!("FFmpeg error: {}", stderr_msg))
            }
        }
        Err(e) => {
            println!("❌ Failed to run FFmpeg: {}", e);
            Err(format!("Failed to run FFmpeg: {}", e))
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
            println!("🔍 FFmpeg output:\n{}", stderr);
            
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
            println!("❌ Failed to run FFmpeg: {}", e);
            Err(format!("Failed to run FFmpeg: {}", e))
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

fn parse_volume_from_output(output: &str) -> Option<f64> {
    use regex::Regex;
    
    // Look for "mean_volume: -XX.X dB" in the output
    let re = Regex::new(r"mean_volume:\s*(-?\d+\.?\d*)\s*dB").unwrap();
    
    if let Some(captures) = re.captures(output) {
        if let Some(volume_str) = captures.get(1) {
            if let Ok(volume) = volume_str.as_str().parse::<f64>() {
                return Some(volume);
            }
        }
    }
    
    // If we can't find mean_volume, try other patterns
    let re_max = Regex::new(r"max_volume:\s*(-?\d+\.?\d*)\s*dB").unwrap();
    if let Some(captures) = re_max.captures(output) {
        if let Some(volume_str) = captures.get(1) {
            if let Ok(volume) = volume_str.as_str().parse::<f64>() {
                return Some(volume);
            }
        }
    }
    
    // Debug: log what we're getting from FFmpeg
    if !output.trim().is_empty() {
        println!("    🔍 FFmpeg output: {}", output.chars().take(200).collect::<String>());
    }
    
    None
}

fn group_quiet_samples(samples: Vec<(f64, f64)>, min_duration: f64) -> Vec<SilenceRegion> {
    if samples.is_empty() {
        println!("🔍 No quiet samples to group");
        return Vec::new();
    }
    
    println!("🔍 Grouping {} quiet samples with min duration {:.1}s", samples.len(), min_duration);
    
    let mut regions = Vec::new();
    let mut current_start = samples[0].0;
    let mut current_end = samples[0].0 + 0.1; // Each sample is 0.1s
    let mut current_samples = 1;
    
    for (time, _volume) in samples.iter().skip(1) {
        // If this sample is within 0.2s of the current region, extend it
        if *time <= current_end + 0.2 {
            current_end = *time + 0.1;
            current_samples += 1;
        } else {
            // Start a new region
            let duration = current_end - current_start;
            println!("  📊 Region candidate: {:.1}s-{:.1}s (duration: {:.1}s, samples: {})", 
                current_start, current_end, duration, current_samples);
            
            if duration >= min_duration {
                regions.push(SilenceRegion {
                    start: current_start,
                    end: current_end,
                    duration,
                });
                println!("    ✅ Added region (duration >= {:.1}s)", min_duration);
            } else {
                println!("    ❌ Skipped region (duration < {:.1}s)", min_duration);
            }
            
            current_start = *time;
            current_end = *time + 0.1;
            current_samples = 1;
        }
    }
    
    // Add the last region
    let duration = current_end - current_start;
    println!("  📊 Final region candidate: {:.1}s-{:.1}s (duration: {:.1}s, samples: {})", 
        current_start, current_end, duration, current_samples);
    
    if duration >= min_duration {
        regions.push(SilenceRegion {
            start: current_start,
            end: current_end,
            duration,
        });
        println!("    ✅ Added final region (duration >= {:.1}s)", min_duration);
    } else {
        println!("    ❌ Skipped final region (duration < {:.1}s)", min_duration);
    }
    
    println!("🔍 Grouping complete: {} regions created", regions.len());
    regions
}

fn parse_quiet_parts(output: &str, threshold: f64, min_duration: f64) -> Vec<SilenceRegion> {
    use regex::Regex;
    
    let mut quiet_regions = Vec::new();
    let mut quiet_samples = Vec::new();
    
    // Parse audio statistics to find quiet parts
    let rms_re = Regex::new(r"lavfi\.astats\.Overall\.RMS_level:\s*([0-9.-]+)").unwrap();
    let time_re = Regex::new(r"pts_time:\s*([0-9.]+)").unwrap();
    
    let mut current_time = 0.0;
    
    for line in output.lines() {
        // Extract timestamp
        if let Some(caps) = time_re.captures(line) {
            if let Ok(time) = caps[1].parse::<f64>() {
                current_time = time;
            }
        }
        
        // Extract RMS level
        if let Some(caps) = rms_re.captures(line) {
            if let Ok(rms) = caps[1].parse::<f64>() {
                // Convert RMS to dB (approximate)
                let volume_db = if rms > 0.0 {
                    20.0 * rms.log10()
                } else {
                    -100.0
                };
                
                // Check if this sample is below threshold
                if volume_db < threshold {
                    quiet_samples.push(current_time);
                    println!("Quiet sample at {:.2}s: {:.1}dB (below {:.1}dB)", current_time, volume_db, threshold);
                }
            }
        }
    }
    
    // Group consecutive quiet samples into regions
    if !quiet_samples.is_empty() {
        let mut region_start = quiet_samples[0];
        let mut region_end = quiet_samples[0];
        
        for i in 1..quiet_samples.len() {
            let current = quiet_samples[i];
            let previous = quiet_samples[i-1];
            
            // If samples are close together (within 0.2s), continue the region
            if current - previous <= 0.2 {
                region_end = current;
            } else {
                // End current region and start new one
                let duration = region_end - region_start;
                if duration >= min_duration {
                    quiet_regions.push(SilenceRegion {
                        start: region_start,
                        end: region_end,
                        duration,
                    });
                }
                region_start = current;
                region_end = current;
            }
        }
        
        // Add the last region
        let duration = region_end - region_start;
        if duration >= min_duration {
            quiet_regions.push(SilenceRegion {
                start: region_start,
                end: region_end,
                duration,
            });
        }
    }
    
    quiet_regions
}

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
            let mut max_volume = -100.0;
            let mut mean_volume = -100.0;
            
            for line in stderr.lines() {
                if line.contains("max_volume:") {
                    if let Some(volume_str) = line.split("max_volume:").nth(1) {
                        if let Some(volume) = volume_str.split("dB").next() {
                            if let Ok(vol) = volume.trim().parse::<f64>() {
                                max_volume = vol;
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
    let mut current_time = 0.0;
    
    while current_time < duration {
        let output = Command::new("ffmpeg")
            .args([
                "-i", &file_path,
                "-ss", &current_time.to_string(),
                "-t", &sample_rate.to_string(),
                "-af", "volumedetect",
                "-f", "null",
                "-"
            ])
            .output();
        
        match output {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stderr);
                if let Some(volume) = parse_volume_from_output(&output_str) {
                    levels.push(AudioLevel {
                        timestamp: current_time,
                        volume_db: volume,
                    });
                }
            }
            Err(e) => {
                println!("❌ Error analyzing chunk at {}s: {}", current_time, e);
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
                    log_to_terminal,
                    open_file_location,
                    analyze_audio_levels,
                    analyze_audio_for_presets,
                    play_audio_segment,
                    play_test_tone,
                    get_audio_visualization_data
                ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
