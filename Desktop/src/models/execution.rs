use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: Uuid,
    pub script_path: PathBuf,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub status: ExecutionStatus,
    pub steps: Vec<StepResult>,
    pub error: Option<ExecutionError>,
    pub screenshots: Vec<PathBuf>,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_index: usize,
    pub step_type: String,
    pub description: String,
    pub status: ExecutionStatus,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub screenshot: Option<PathBuf>,
    pub retry_count: u32,
    // Add missing fields
    pub selector_used: Option<String>,
    pub execution_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionError {
    pub code: String,
    pub message: String,
    pub stack_trace: Option<String>,
    pub step_index: Option<usize>,
    pub timestamp: DateTime<Utc>,
}

impl ExecutionResult {
    pub fn new(script_path: PathBuf) -> Self {
        Self {
            id: Uuid::new_v4(),
            script_path,
            started_at: Utc::now(),
            ended_at: None,
            status: ExecutionStatus::Pending,
            steps: Vec::new(),
            error: None,
            screenshots: Vec::new(),
            metadata: Value::Object(Default::default()),
        }
    }

    pub fn add_step(&mut self, step: StepResult) {
        self.steps.push(step);
    }

    pub fn mark_completed(&mut self) {
        self.ended_at = Some(Utc::now());
        self.status = ExecutionStatus::Completed;
    }

    pub fn mark_failed(&mut self, error: ExecutionError) {
        self.ended_at = Some(Utc::now());
        self.status = ExecutionStatus::Failed;
        self.error = Some(error);
    }

    pub fn is_success(&self) -> bool {
        self.status == ExecutionStatus::Completed &&
        self.steps.iter().all(|s| s.status == ExecutionStatus::Completed)
    }
}