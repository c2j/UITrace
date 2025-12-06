use crate::models::Recording;
use crate::recorder::WebRecorder;
use crate::services::file_service::FileService;
use crate::utils::error_handler::UITraceError;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

pub struct RecordingService {
    recorder: Arc<Mutex<Option<WebRecorder>>>,
    recordings: Arc<RwLock<Vec<Recording>>>,
    file_service: Arc<FileService>,
}

impl RecordingService {
    pub fn new(file_service: Arc<FileService>) -> Self {
        Self {
            recorder: Arc::new(Mutex::new(None)),
            recordings: Arc::new(RwLock::new(Vec::new())),
            file_service,
        }
    }

    pub async fn start_recording(&self, url: String) -> Result<String, UITraceError> {
        let mut recorder_guard = self.recorder.lock().await;

        if recorder_guard.is_some() {
            return Err(UITraceError::Recording("Recording already in progress".to_string()));
        }

        let mut recorder = WebRecorder::new(crate::recorder::config::RecordingConfig::default());
        let session_id = recorder.start_recording(&url).await
            .map_err(|e| UITraceError::Recording(e.to_string()))?;

        *recorder_guard = Some(recorder);

        Ok(session_id)
    }

    pub async fn stop_recording(&self) -> Result<Recording, UITraceError> {
        let mut recorder_guard = self.recorder.lock().await;
        let recorder = recorder_guard.as_mut()
            .ok_or_else(|| UITraceError::Recording("No recording in progress".to_string()))?;

        let recording = recorder.stop_recording().await
            .map_err(|e| UITraceError::Recording(e.to_string()))?;

        // Store the recording
        {
            let mut recordings = self.recordings.write().await;
            recordings.push(recording.clone());
        }

        *recorder_guard = None;

        Ok(recording)
    }

    pub async fn save_recording(&self, session_id: &str, path: PathBuf) -> Result<(), UITraceError> {
        let recorder_guard = self.recorder.lock().await;
        let recorder = recorder_guard.as_ref()
            .ok_or_else(|| UITraceError::Recording("No recording in progress".to_string()))?;

        // Ensure directory exists
        self.file_service.ensure_directory_exists(path.parent().unwrap()).await?;

        recorder.save_recording(&path, None).await
            .map_err(|e| UITraceError::Recording(e.to_string()))?;

        Ok(())
    }

    pub async fn list_recordings(&self) -> Result<Vec<Recording>, UITraceError> {
        let recordings = self.recordings.read().await;
        Ok(recordings.clone())
    }

    pub async fn get_recording_by_id(&self, session_id: &str) -> Option<Recording> {
        let recordings = self.recordings.read().await;
        recordings.iter()
            .find(|r| r.id.to_string() == session_id)
            .cloned()
    }

    pub async fn load_recording_from_file(&self, path: PathBuf) -> Result<Recording, UITraceError> {
        let content = self.file_service.read_file(&path).await?;
        let recording: Recording = serde_json::from_str(&content)
            .map_err(|e| UITraceError::Serialization(format!("Failed to parse recording: {}", e)))?;

        // Store the loaded recording
        {
            let mut recordings = self.recordings.write().await;
            recordings.push(recording.clone());
        }

        Ok(recording)
    }
}

impl Default for RecordingService {
    fn default() -> Self {
        Self::new(Arc::new(FileService::default()))
    }
}