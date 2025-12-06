use crate::utils::file_utils::FileUtils;
use crate::utils::error_handler::UITraceError;
use std::path::Path;

pub struct FileService {
    file_utils: FileUtils,
}

impl FileService {
    pub fn new() -> Self {
        Self {
            file_utils: FileUtils::new(),
        }
    }

    pub async fn ensure_directory_exists(&self, path: &Path) -> Result<(), UITraceError> {
        self.file_utils.ensure_directory_exists(path).await?;
        Ok(())
    }

    pub async fn file_exists(&self, path: &Path) -> bool {
        self.file_utils.file_exists(path).await
    }

    pub async fn read_file(&self, path: &Path) -> Result<String, UITraceError> {
        Ok(self.file_utils.read_file(path).await?)
    }

    pub async fn write_file(&self, path: &Path, content: &str) -> Result<(), UITraceError> {
        Ok(self.file_utils.write_file(path, content).await?)
    }

    pub async fn copy_file(&self, from: &Path, to: &Path) -> Result<(), UITraceError> {
        Ok(self.file_utils.copy_file(from, to).await?)
    }

    pub async fn delete_file(&self, path: &Path) -> Result<(), UITraceError> {
        Ok(self.file_utils.delete_file(path).await?)
    }
}

impl Default for FileService {
    fn default() -> Self {
        Self::new()
    }
}