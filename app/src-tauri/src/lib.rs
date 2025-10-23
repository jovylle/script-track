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
    
    // Run FFmpeg with silencedetect filter
    let output = Command::new("ffmpeg")
        .arg("-i")
        .arg(&file_path)
        .arg("-af")
        .arg(format!("silencedetect=noise={}dB:d={}", noise_threshold, min_duration))
        .arg("-f")
        .arg("null")
        .arg("-")
        .arg("-v")
        .arg("info") // Ensure we get the silencedetect output
        .output();
    
    match output {
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            println!("FFmpeg stderr output:\n{}", stderr);
            
            // Parse the silencedetect output
            let silence_regions = parse_silence_output(&stderr);
            println!("Found {} silence regions", silence_regions.len());
            
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
    
    // Regex patterns to match FFmpeg silencedetect output
    let silence_start_re = Regex::new(r"silence_start:\s*([0-9.]+)").unwrap();
    let silence_end_re = Regex::new(r"silence_end:\s*([0-9.]+).*silence_duration:\s*([0-9.]+)").unwrap();
    
    let mut current_start: Option<f64> = None;
    
    for line in output.lines() {
        // Look for silence_start
        if let Some(caps) = silence_start_re.captures(line) {
            if let Ok(start) = caps[1].parse::<f64>() {
                current_start = Some(start);
                println!("Found silence start at: {:.2}s", start);
            }
        }
        
        // Look for silence_end
        if let Some(caps) = silence_end_re.captures(line) {
            if let (Ok(end), Ok(duration)) = (caps[1].parse::<f64>(), caps[2].parse::<f64>()) {
                if let Some(start) = current_start {
                    let region = SilenceRegion {
                        start,
                        end,
                        duration,
                    };
                    silence_regions.push(region);
                    println!("Found silence end at: {:.2}s (duration: {:.2}s)", end, duration);
                    current_start = None;
                }
            }
        }
    }
    
    silence_regions
}

#[tauri::command]
async fn open_file_location(file_path: String) -> Result<(), String> {
    use std::process::Command;
    
    println!("📁 Opening file location: {}", file_path);
    
    // Get the directory path
    let path = std::path::Path::new(&file_path);
    let parent_dir = path.parent()
        .ok_or_else(|| "Could not get parent directory".to_string())?;
    
    let parent_dir_str = parent_dir.to_string_lossy().to_string();
    
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
                    open_file_location
                ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
