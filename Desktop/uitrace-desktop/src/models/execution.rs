use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub execution_id: Uuid,
    pub script_id: Uuid,
    pub status: ExecutionStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub total_duration_ms: Option<u64>,
    pub total_steps: usize,
    pub successful_steps: usize,
    pub failed_steps: usize,
    pub test_cases: Vec<TestCaseResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaseResult {
    pub case_id: Uuid,
    pub data_row_index: Option<usize>, // For data-driven testing
    pub status: CaseStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub steps: Vec<StepResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: i32,
    pub status: StepStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    pub screenshot_before_path: Option<String>,
    pub screenshot_after_path: Option<String>,
    pub visual_comparison: Option<VisualComparisonResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualComparisonResult {
    pub similarity_score: f64,
    pub difference_percentage: f64,
    pub comparison_status: ComparisonStatus,
    pub baseline_path: String,
    pub current_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CaseStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ComparisonStatus {
    Pending,
    Passed,
    Failed,
    Error,
}

impl ExecutionResult {
    pub fn new(script_id: Uuid) -> Self {
        Self {
            execution_id: Uuid::new_v4(),
            script_id,
            status: ExecutionStatus::Pending,
            started_at: Utc::now(),
            completed_at: None,
            total_duration_ms: None,
            total_steps: 0,
            successful_steps: 0,
            failed_steps: 0,
            test_cases: Vec::new(),
        }
    }

    pub fn complete(&mut self) {
        self.status = ExecutionStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.total_duration_ms = Some(
            (self.completed_at.unwrap() - self.started_at).num_milliseconds() as u64
        );
    }

    pub fn fail(&mut self, error: String) {
        self.status = ExecutionStatus::Failed;
        self.completed_at = Some(Utc::now());
        self.total_duration_ms = Some(
            (self.completed_at.unwrap() - self.started_at).num_milliseconds() as u64
        );
    }

    pub fn update_statistics(&mut self) {
        self.total_steps = self.test_cases.iter().map(|c| c.steps.len()).sum();
        self.successful_steps = self.test_cases.iter()
            .flat_map(|c| c.steps.iter())
            .filter(|s| s.status == StepStatus::Completed)
            .count();
        self.failed_steps = self.test_cases.iter()
            .flat_map(|c| c.steps.iter())
            .filter(|s| s.status == StepStatus::Failed)
            .count();
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_steps == 0 {
            0.0
        } else {
            (self.successful_steps as f64 / self.total_steps as f64) * 100.0
        }
    }
}