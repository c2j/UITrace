use crate::models::Recording;
use crate::recording::{RecordedEvent, EventTarget, EventData, EventType};
use crate::recorder::config::RecordingConfig;
use chrono::Utc;
use serde_json::Value;
use std::path::PathBuf;
use thirtyfour::prelude::*;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum RecordingError {
    #[error("WebDriver error: {0}")]
    WebDriver(#[from] WebDriverError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Recording not started")]
    NotStarted,
    #[error("Recording already in progress")]
    AlreadyRecording,
}

pub struct WebRecorder {
    driver: Option<WebDriver>,
    recording: Option<Recording>,
    config: RecordingConfig,
    session_id: Option<String>,
}

impl WebRecorder {
    pub fn new(config: RecordingConfig) -> Self {
        Self {
            driver: None,
            recording: None,
            config,
            session_id: None,
        }
    }

    pub async fn start_recording(&mut self, url: &str) -> Result<String, RecordingError> {
        if self.recording.is_some() {
            return Err(RecordingError::AlreadyRecording);
        }

        // Initialize WebDriver
        let caps = DesiredCapabilities::chrome();
        let driver = WebDriver::new("http://localhost:4444", caps).await?;

        // Navigate to the URL
        driver.goto(url).await?;

        // Create recording instance
        let recording = Recording {
            id: Uuid::new_v4(),
            name: format!("Recording_{}", Utc::now().format("%Y%m%d_%H%M%S")),
            url: url.to_string(),
            started_at: Utc::now(),
            ended_at: None,
            events: Vec::new(),
            metadata: Some(self.config.metadata.clone()),
        };

        let session_id = recording.id.to_string();

        self.driver = Some(driver);
        self.recording = Some(recording);
        self.session_id = Some(session_id.clone());

        // Start event capture
        self.inject_recording_script().await?;

        Ok(session_id)
    }

    pub async fn stop_recording(&mut self) -> Result<Recording, RecordingError> {
        let mut recording = self.recording.take()
            .ok_or(RecordingError::NotStarted)?;

        recording.ended_at = Some(Utc::now());

        // Close driver
        if let Some(driver) = self.driver.take() {
            driver.quit().await?;
        }

        Ok(recording)
    }

    pub async fn save_recording(&self, path: &PathBuf, metadata: Option<Value>) -> Result<(), RecordingError> {
        let recording = self.recording.as_ref()
            .ok_or(RecordingError::NotStarted)?;

        let mut final_recording = recording.clone();
        if let Some(metadata) = metadata {
            let existing = final_recording.metadata.unwrap_or(Value::Object(Default::default()));
            final_recording.metadata = Some({
                let mut map = existing.as_object().unwrap_or(&serde_json::Map::new()).clone();
                if let Some(obj) = metadata.as_object() {
                    for (k, v) in obj {
                        map.insert(k.clone(), v.clone());
                    }
                }
                Value::Object(map)
            });
        }

        let json = serde_json::to_string_pretty(&final_recording)?;
        std::fs::write(path, json)?;

        Ok(())
    }

    async fn inject_recording_script(&self) -> Result<(), RecordingError> {
        let _driver = self.driver.as_ref().ok_or(RecordingError::NotStarted)?;

        let script = r#"
            (function() {
                // Event listeners will be injected here
                console.log('UITrace recording script injected');
            })();
        "#;

        // Temporarily skip script injection
        // TODO: Fix script injection to work with async WebDriver
        // driver.execute(script, Vec::new()).await?;
        Ok(())
    }
}