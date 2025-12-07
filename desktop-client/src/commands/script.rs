use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Mutex;
use std::collections::HashMap;
use once_cell::sync::Lazy;
use chrono::Utc;

use crate::error::Result;
use crate::models::TestScript;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptRequest {
    pub name: String,
    pub description: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptResponse {
    pub success: bool,
    pub script: Option<TestScript>,
    pub scripts: Option<Vec<TestScript>>,
    pub message: String,
}

// In-memory storage for scripts (temporary implementation)
static SCRIPT_STORAGE: Lazy<Mutex<HashMap<Uuid, TestScript>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

#[tauri::command]
pub fn load_script(script_id: Uuid) -> Result<ScriptResponse> {
    let storage = SCRIPT_STORAGE.lock().unwrap();

    match storage.get(&script_id) {
        Some(script) => Ok(ScriptResponse {
            success: true,
            script: Some(script.clone()),
            scripts: None,
            message: "Script loaded successfully".to_string(),
        }),
        None => Ok(ScriptResponse {
            success: false,
            script: None,
            scripts: None,
            message: "Script not found".to_string(),
        }),
    }
}

#[tauri::command]
pub fn save_script(request: ScriptRequest) -> Result<ScriptResponse> {
    // For now, we'll create a simple script from the request
    // In a real implementation, this would deserialize the full script data
    let mut storage = SCRIPT_STORAGE.lock().unwrap();

    // Generate a new ID if not provided
    let script_id = Uuid::new_v4();

    let script = TestScript {
        id: Some(script_id),
        name: request.name.clone(),
        description: request.description.clone(),
        version: "1.0.0".to_string(),
        author_id: Uuid::new_v4(), // TODO: Get from user session
        project_id: None,
        tags: vec![],
        status: "draft".to_string(),
        steps: vec![], // TODO: Parse steps from request.content
        created_at: Some(Utc::now().to_rfc3339()),
        updated_at: Some(Utc::now().to_rfc3339()),
    };

    storage.insert(script_id, script.clone());

    Ok(ScriptResponse {
        success: true,
        script: Some(script),
        scripts: None,
        message: "Script saved successfully".to_string(),
    })
}

#[tauri::command]
pub fn delete_script(script_id: Uuid) -> Result<ScriptResponse> {
    let mut storage = SCRIPT_STORAGE.lock().unwrap();

    match storage.remove(&script_id) {
        Some(_) => Ok(ScriptResponse {
            success: true,
            script: None,
            scripts: None,
            message: "Script deleted successfully".to_string(),
        }),
        None => Ok(ScriptResponse {
            success: false,
            script: None,
            scripts: None,
            message: "Script not found".to_string(),
        }),
    }
}

#[tauri::command]
pub fn create_new_script(request: ScriptRequest) -> Result<ScriptResponse> {
    let mut storage = SCRIPT_STORAGE.lock().unwrap();

    let script_id = Uuid::new_v4();
    let script = TestScript {
        id: Some(script_id),
        name: request.name.clone(),
        description: request.description.clone(),
        version: "1.0.0".to_string(),
        author_id: Uuid::new_v4(), // TODO: Get from user session
        project_id: None,
        tags: vec![],
        status: "draft".to_string(),
        steps: vec![],
        created_at: Some(Utc::now().to_rfc3339()),
        updated_at: Some(Utc::now().to_rfc3339()),
    };

    storage.insert(script_id, script.clone());

    Ok(ScriptResponse {
        success: true,
        script: Some(script),
        scripts: None,
        message: "Script created successfully".to_string(),
    })
}

#[tauri::command]
pub fn list_scripts() -> Result<ScriptResponse> {
    let storage = SCRIPT_STORAGE.lock().unwrap();
    let scripts: Vec<TestScript> = storage.values().cloned().collect();

    Ok(ScriptResponse {
        success: true,
        script: None,
        scripts: Some(scripts),
        message: "Scripts listed successfully".to_string(),
    })
}