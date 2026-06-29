use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const SMALL_FILE_THRESHOLD: u64 = 10 * 1024 * 1024;
const SAMPLE_SIZE: u64 = 1024 * 1024;

pub fn compute_file_hash(path: &Path) -> std::io::Result<String> {
    let metadata = std::fs::metadata(path)?;
    let size = metadata.len();

    if size < SMALL_FILE_THRESHOLD {
        compute_full_hash(path)
    } else {
        compute_sampled_hash(path, size)
    }
}

fn compute_full_hash(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn compute_sampled_hash(path: &Path, size: u64) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();

    hasher.update(&size.to_le_bytes());

    let mut buffer = vec![0u8; SAMPLE_SIZE as usize];

    file.seek(SeekFrom::Start(0))?;
    let n = file.read(&mut buffer)?;
    hasher.update(&buffer[..n]);

    if size > SAMPLE_SIZE * 2 {
        let mid = size / 2 - SAMPLE_SIZE / 2;
        file.seek(SeekFrom::Start(mid))?;
        let n = file.read(&mut buffer)?;
        hasher.update(&buffer[..n]);
    }

    if size > SAMPLE_SIZE {
        let tail_start = size.saturating_sub(SAMPLE_SIZE);
        file.seek(SeekFrom::Start(tail_start))?;
        let n = file.read(&mut buffer)?;
        hasher.update(&buffer[..n]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

pub fn detect_file_type(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "ico" | "tiff" | "tif" => {
            "image".into()
        }
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" => "video".into(),
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" => "audio".into(),
        _ => "other".into(),
    }
}
