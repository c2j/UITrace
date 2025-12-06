use thiserror::Error;
use std::path::Path;

#[derive(Error, Debug)]
pub enum FileError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
}

impl From<FileError> for std::io::Error {
    fn from(error: FileError) -> Self {
        match error {
            FileError::Io(io_err) => io_err,
            _ => std::io::Error::new(std::io::ErrorKind::Other, error.to_string()),
        }
    }
}

pub struct FileUtils;

impl FileUtils {
    pub fn new() -> Self {
        Self
    }

    pub async fn ensure_directory_exists(&self, path: &Path) -> Result<(), FileError> {
        if !path.exists() {
            tokio::fs::create_dir_all(path).await?;
        }
        Ok(())
    }

    pub async fn file_exists(&self, path: &Path) -> bool {
        tokio::fs::metadata(path).await.is_ok()
    }

    pub async fn read_file(&self, path: &Path) -> Result<String, FileError> {
        let content = tokio::fs::read_to_string(path).await?;
        Ok(content)
    }

    pub async fn write_file(&self, path: &Path, content: &str) -> Result<(), FileError> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            self.ensure_directory_exists(parent).await?;
        }

        tokio::fs::write(path, content).await?;
        Ok(())
    }

    pub async fn copy_file(&self, from: &Path, to: &Path) -> Result<(), FileError> {
        // Ensure destination directory exists
        if let Some(parent) = to.parent() {
            self.ensure_directory_exists(parent).await?;
        }

        tokio::fs::copy(from, to).await?;
        Ok(())
    }

    pub async fn delete_file(&self, path: &Path) -> Result<(), FileError> {
        if self.file_exists(path).await {
            tokio::fs::remove_file(path).await?;
        }
        Ok(())
    }

    pub async fn get_file_size(&self, path: &Path) -> Result<u64, FileError> {
        let metadata = tokio::fs::metadata(path).await?;
        Ok(metadata.len())
    }

    pub async fn create_temp_dir() -> Result<std::path::PathBuf, FileError> {
        let temp_dir = std::env::temp_dir();
        let uuid = uuid::Uuid::new_v4().to_string();
        let path = temp_dir.join(format!("uitrace_{}", uuid));

        Self::new().ensure_directory_exists(&path).await?;
        Ok(path)
    }

    pub async fn clean_temp_dirs() -> Result<(), FileError> {
        let temp_dir = std::env::temp_dir();
        let mut entries = tokio::fs::read_dir(temp_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("uitrace_") {
                    let _ = tokio::fs::remove_dir_all(&path).await;
                }
            }
        }

        Ok(())
    }

    pub fn get_extension(&self, path: &Path) -> Option<String> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase())
    }

    pub fn is_image_file(&self, path: &Path) -> bool {
        match self.get_extension(path) {
            Some(ext) => matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp"),
            None => false,
        }
    }

    pub fn is_json_file(&self, path: &Path) -> bool {
        self.get_extension(path).map(|ext| ext == "json").unwrap_or(false)
    }

    pub fn normalize_path(&self, path: &Path) -> std::path::PathBuf {
        path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
    }
}

impl Default for FileUtils {
    fn default() -> Self {
        Self::new()
    }
}