use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::error::Result;
use crate::services::RecordingService;
use crate::models::TestStep;

#[derive(Debug, Default)]
pub struct AppState {
    pub recording_sessions: Arc<Mutex<HashMap<Uuid, RecordingSession>>>,
    pub recording_service: Arc<RecordingService>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingSession {
    pub id: Uuid,
    pub script_id: Option<Uuid>,
    pub name: String,
    pub steps: Vec<TestStep>,
    pub created_at: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingRequest {
    pub script_name: String,
    pub script_description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingResponse {
    pub success: bool,
    pub session: Option<RecordingSession>,
    pub message: String,
}

#[tauri::command]
pub async fn start_recording(request: RecordingRequest, state: State<'_, AppState>) -> Result<RecordingResponse> {
    // Use the recording service to start recording
    let recording_service = state.recording_service.clone();

    match recording_service.start_recording(request.script_name.clone()).await {
        Ok(session) => {
            let mut sessions = state.recording_sessions.lock().unwrap();

            // Create UI session representation
            let ui_session = RecordingSession {
                id: session.id,
                script_id: None,
                name: session.script_name.clone(),
                steps: Vec::new(), // Will be populated by recording events
                created_at: session.start_time.to_rfc3339(),
                is_active: true,
            };

            sessions.insert(session.id, ui_session.clone());

            Ok(RecordingResponse {
                success: true,
                session: Some(ui_session),
                message: format!("Recording session '{}' started", session.id),
            })
        },
        Err(e) => {
            Ok(RecordingResponse {
                success: false,
                session: None,
                message: format!("Failed to start recording: {}", e),
            })
        }
    }
}

#[tauri::command]
pub fn stop_recording(state: State<AppState>) -> Result<RecordingResponse> {
    let mut sessions = state.recording_sessions.lock().unwrap();

    // Find active recording session
    let active_session = sessions
        .iter()
        .find(|(_, session)| session.is_active)
        .map(|(_, session)| session.clone());

    match active_session {
        Some(mut session) => {
            session.is_active = false;
            sessions.insert(session.id, session.clone());
            let session_id = session.id;

            Ok(RecordingResponse {
                success: true,
                session: Some(session),
                message: format!("Recording session '{}' stopped", session_id),
            })
        },
        None => Ok(RecordingResponse {
            success: false,
            session: None,
            message: "No active recording session found".to_string(),
        }),
    }
}

#[tauri::command]
pub fn pause_recording(state: State<AppState>) -> Result<RecordingResponse> {
    let mut sessions = state.recording_sessions.lock().unwrap();

    // Find active recording session
    let active_session = sessions
        .iter()
        .find(|(_, session)| session.is_active)
        .map(|(_, session)| session.clone());

    match active_session {
        Some(mut session) => {
            session.is_active = false;
            sessions.insert(session.id, session.clone());
            let session_id = session.id;

            Ok(RecordingResponse {
                success: true,
                session: Some(session),
                message: format!("Recording session '{}' paused", session_id),
            })
        },
        None => Ok(RecordingResponse {
            success: false,
            session: None,
            message: "No active recording session found".to_string(),
        }),
    }
}

#[tauri::command]
pub fn resume_recording(state: State<AppState>) -> Result<RecordingResponse> {
    let mut sessions = state.recording_sessions.lock().unwrap();

    // Find paused recording session
    let paused_session = sessions
        .iter()
        .find(|(_, session)| !session.is_active)
        .map(|(_, session)| session.clone());

    match paused_session {
        Some(mut session) => {
            session.is_active = true;
            sessions.insert(session.id, session.clone());
            let session_id = session.id;

            Ok(RecordingResponse {
                success: true,
                session: Some(session),
                message: format!("Recording session '{}' resumed", session_id),
            })
        },
        None => Ok(RecordingResponse {
            success: false,
            session: None,
            message: "No paused recording session found".to_string(),
        }),
    }
}