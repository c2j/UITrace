use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::{TestStep, StepAction, Selector};
use crate::error::{Result, AppError};

#[derive(Debug, Clone)]
pub struct RecordingService {
    is_recording: Arc<Mutex<bool>>,
    current_session: Arc<Mutex<Option<RecordingSession>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSession {
    pub id: Uuid,
    pub script_name: String,
    pub steps: Vec<RecordedStep>,
    pub start_time: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedStep {
    pub id: Uuid,
    pub action: StepAction,
    pub target_element: Option<ElementInfo>,
    pub value: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub selectors: Vec<Selector>,
    pub screenshot: Option<String>, // Base64 encoded screenshot
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementInfo {
    pub tag_name: String,
    pub text_content: Option<String>,
    pub attributes: std::collections::HashMap<String, String>,
    pub bounding_rect: Option<BoundingRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl RecordingService {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(Mutex::new(false)),
            current_session: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start_recording(&self, script_name: String) -> Result<RecordingSession> {
        let mut is_recording = self.is_recording.lock().await;
        if *is_recording {
            return Err(AppError::RecordingError("Recording already in progress".to_string()));
        }

        let session = RecordingSession {
            id: Uuid::new_v4(),
            script_name,
            steps: Vec::new(),
            start_time: chrono::Utc::now(),
        };

        *self.current_session.lock().await = Some(session.clone());
        *is_recording = true;

        Ok(session)
    }

    pub async fn stop_recording(&self) -> Result<RecordingSession> {
        let mut is_recording = self.is_recording.lock().await;
        let mut session = self.current_session.lock().await;

        if !*is_recording {
            return Err(AppError::RecordingError("No recording in progress".to_string()));
        }

        let recording_session = session.take()
            .ok_or_else(|| AppError::RecordingError("No active recording session".to_string()))?;

        *is_recording = false;
        Ok(recording_session)
    }

    pub async fn record_navigation(&self, url: String) -> Result<()> {
        if !*self.is_recording.lock().await {
            return Ok(());
        }

        let mut session = self.current_session.lock().await;
        if let Some(ref mut session) = *session {
            let step = RecordedStep {
                id: Uuid::new_v4(),
                action: StepAction::Navigate,
                target_element: None,
                value: Some(url),
                timestamp: chrono::Utc::now(),
                selectors: vec![],
                screenshot: None,
            };
            session.steps.push(step);
        }
        Ok(())
    }

    pub async fn record_click(&self, target_info: ElementInfo, selectors: Vec<Selector>) -> Result<()> {
        if !*self.is_recording.lock().await {
            return Ok(());
        }

        let mut session = self.current_session.lock().await;
        if let Some(ref mut session) = *session {
            let step = RecordedStep {
                id: Uuid::new_v4(),
                action: StepAction::Click,
                target_element: Some(target_info),
                value: None,
                timestamp: chrono::Utc::now(),
                selectors,
                screenshot: None,
            };
            session.steps.push(step);
        }
        Ok(())
    }

    pub async fn record_type(&self, target_info: ElementInfo, text: String, selectors: Vec<Selector>) -> Result<()> {
        if !*self.is_recording.lock().await {
            return Ok(());
        }

        let mut session = self.current_session.lock().await;
        if let Some(ref mut session) = *session {
            let step = RecordedStep {
                id: Uuid::new_v4(),
                action: StepAction::Type,
                target_element: Some(target_info),
                value: Some(text),
                timestamp: chrono::Utc::now(),
                selectors,
                screenshot: None,
            };
            session.steps.push(step);
        }
        Ok(())
    }

    pub async fn record_wait(&self, duration_ms: u64) -> Result<()> {
        if !*self.is_recording.lock().await {
            return Ok(());
        }

        let mut session = self.current_session.lock().await;
        if let Some(ref mut session) = *session {
            let step = RecordedStep {
                id: Uuid::new_v4(),
                action: StepAction::Wait,
                target_element: None,
                value: Some(duration_ms.to_string()),
                timestamp: chrono::Utc::now(),
                selectors: vec![],
                screenshot: None,
            };
            session.steps.push(step);
        }
        Ok(())
    }

    pub async fn is_recording(&self) -> bool {
        *self.is_recording.lock().await
    }

    pub async fn get_current_session(&self) -> Option<RecordingSession> {
        self.current_session.lock().await.clone()
    }

    pub async fn convert_to_test_script(&self, session: RecordingSession, author_id: Uuid) -> crate::models::TestScript {
        let mut script = crate::models::TestScript::new(session.script_name, author_id);

        for (index, recorded_step) in session.steps.iter().enumerate() {
            let test_step = TestStep {
                step_id: index as i32 + 1,
                name: format!("Step {}: {:?}", index + 1, recorded_step.action),
                action: recorded_step.action.clone(),
                value: recorded_step.value.clone(),
                expected_value: None,
                timeout_seconds: 30,
                retry_count: 3,
                selectors: recorded_step.selectors.clone(),
                data_source: None,
                enabled: true,
            };
            script.steps.push(test_step);
        }

        script
    }

    pub async fn clear_session(&self,
    ) -> Result<()> {
        let mut session = self.current_session.lock().await;
        *session = None;
        Ok(())
    }

    pub async fn get_session_info(&self,
    ) -> Option<SessionInfo> {
        let session = self.current_session.lock().await;
        let is_recording = *self.is_recording.lock().await;

        session.as_ref().map(|s| SessionInfo {
            id: s.id,
            script_name: s.script_name.clone(),
            step_count: s.steps.len(),
            duration_seconds: (chrono::Utc::now() - s.start_time).num_seconds(),
            is_active: is_recording,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: Uuid,
    pub script_name: String,
    pub step_count: usize,
    pub duration_seconds: i64,
    pub is_active: bool,
}

impl Default for RecordingService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_recording_session_lifecycle() {
        let service = RecordingService::new();

        // Start recording
        let session = service.start_recording("Test Script".to_string()).await.unwrap();
        assert_eq!(session.script_name, "Test Script");
        assert!(service.is_recording().await);

        // Record some actions
        service.record_navigation("https://example.com".to_string()).await.unwrap();

        let element_info = ElementInfo {
            tag_name: "button".to_string(),
            text_content: Some("Click me".to_string()),
            attributes: std::collections::HashMap::new(),
            bounding_rect: None,
        };

        let selectors = vec![
            Selector {
                selector_type: SelectorType::Id,
                value: "#test-button".to_string(),
                priority: 1,
            }
        ];

        service.record_click(element_info.clone(), selectors.clone()).await.unwrap();
        service.record_type(element_info, "test text".to_string(), selectors).await.unwrap();

        // Verify session has steps
        let current_session = service.get_current_session().await.unwrap();
        assert_eq!(current_session.steps.len(), 3);

        // Stop recording
        let final_session = service.stop_recording().await.unwrap();
        assert_eq!(final_session.steps.len(), 3);
        assert!(!service.is_recording().await);
    }

    #[tokio::test]
    async fn test_no_duplicate_recording() {
        let service = RecordingService::new();

        service.start_recording("First Script".to_string()).await.unwrap();

        // Should fail to start another recording
        let result = service.start_recording("Second Script".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_stop_without_start() {
        let service = RecordingService::new();

        // Should fail to stop without starting
        let result = service.stop_recording().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_convert_to_test_script() {
        let service = RecordingService::new();
        let author_id = Uuid::new_v4();

        let mut session = RecordingSession {
            id: Uuid::new_v4(),
            script_name: "Test Script".to_string(),
            steps: vec![],
            start_time: chrono::Utc::now(),
        };

        // Add some recorded steps
        session.steps.push(RecordedStep {
            id: Uuid::new_v4(),
            action: StepAction::Navigate,
            target_element: None,
            value: Some("https://example.com".to_string()),
            timestamp: chrono::Utc::now(),
            selectors: vec![],
            screenshot: None,
        });

        let test_script = service.convert_to_test_script(session, author_id).await;

        assert_eq!(test_script.name, "Test Script");
        assert_eq!(test_script.author_id, author_id);
        assert_eq!(test_script.steps.len(), 1);
        assert_eq!(test_script.steps[0].action, StepAction::Navigate);
    }
}

