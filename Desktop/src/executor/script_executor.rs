use crate::executor::config::ExecutionConfig;
use crate::models::{ExecutionResult, ExecutionStatus, TestData};
use crate::execution::{StepResult, ExecutionError};
use crate::utils::error_handler::UITraceError;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

pub struct ScriptExecutor {
    config: ExecutionConfig,
    executions: Arc<RwLock<HashMap<String, ExecutionResult>>>,
    is_running: Arc<Mutex<bool>>,
}

impl ScriptExecutor {
    pub fn new(config: ExecutionConfig) -> Self {
        Self {
            config,
            executions: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn execute_script(
        &self,
        script_path: &PathBuf,
        test_data: Option<TestData>,
    ) -> Result<String, UITraceError> {
        let execution_id = Uuid::new_v4().to_string();
        let mut result = ExecutionResult::new(script_path.clone());

        // Store the execution
        {
            let mut executions = self.executions.write().await;
            executions.insert(execution_id.clone(), result.clone());
        }

        // Start execution in background
        let executions = Arc::clone(&self.executions);
        let is_running = Arc::clone(&self.is_running);
        let config = self.config.clone();
        let script_path = script_path.clone();
        let execution_id_clone = execution_id.clone();

        tokio::spawn(async move {
            *is_running.lock().await = true;

            // Load and parse script
            match Self::load_script(&script_path).await {
                Ok(steps) => {
                    for (index, step) in steps.iter().enumerate() {
                        let mut step_result = StepResult {
                            step_index: index,
                            step_type: step.step_type.clone(),
                            description: step.description.clone(),
                            status: ExecutionStatus::Running,
                            started_at: chrono::Utc::now(),
                            ended_at: None,
                            error: None,
                            screenshot: None,
                            retry_count: 0,
                            selector_used: None,
                            execution_time_ms: None,
                        };

                        // Execute step with retries
                        let mut retry_count = 0;
                        loop {
                            match Self::execute_step(step, test_data.as_ref()).await {
                                Ok(_) => {
                                    step_result.status = ExecutionStatus::Completed;
                                    break;
                                }
                                Err(e) if retry_count < config.max_retries => {
                                    retry_count += 1;
                                    step_result.retry_count = retry_count;
                                    tokio::time::sleep(tokio::time::Duration::from_millis(config.retry_delay)).await;
                                }
                                Err(e) => {
                                    step_result.status = ExecutionStatus::Failed;
                                    step_result.error = Some(e.to_string());
                                    break;
                                }
                            }
                        }

                        step_result.ended_at = Some(chrono::Utc::now());

                        // Update execution result
                        {
                            let mut executions = executions.write().await;
                            if let Some(execution) = executions.get_mut(&execution_id_clone) {
                                execution.add_step(step_result.clone());

                                // Stop if step failed and config says to stop on failure
                                if step_result.status == ExecutionStatus::Failed && config.stop_on_failure {
                                    execution.mark_failed(ExecutionError {
                                        code: "STEP_FAILED".to_string(),
                                        message: format!("Step {} failed: {}", index, step_result.error.unwrap_or_default()),
                                        stack_trace: None,
                                        step_index: Some(index),
                                        timestamp: chrono::Utc::now(),
                                    });
                                    break;
                                }
                            }
                        }
                    }

                    // Mark as completed if no failures
                    {
                        let mut executions = executions.write().await;
                        if let Some(execution) = executions.get_mut(&execution_id_clone) {
                            if execution.status == ExecutionStatus::Running {
                                execution.mark_completed();
                            }
                        }
                    }
                }
                Err(e) => {
                    let mut executions = executions.write().await;
                    if let Some(execution) = executions.get_mut(&execution_id_clone) {
                        execution.mark_failed(ExecutionError {
                            code: "SCRIPT_LOAD_ERROR".to_string(),
                            message: e.to_string(),
                            stack_trace: None,
                            step_index: None,
                            timestamp: chrono::Utc::now(),
                        });
                    }
                }
            }

            *is_running.lock().await = false;
        });

        Ok(execution_id)
    }

    pub async fn stop_execution(&self) -> Result<ExecutionResult, UITraceError> {
        let mut is_running = self.is_running.lock().await;
        *is_running = false;

        // Return the most recent execution
        let executions = self.executions.read().await;
        let mut latest: Option<(&String, &ExecutionResult)> = None;

        for (id, execution) in executions.iter() {
            if execution.status == ExecutionStatus::Running {
                latest = Some((id, execution));
                break;
            }
        }

        if let Some((id, _)) = latest {
            let mut executions = self.executions.write().await;
            if let Some(execution) = executions.get_mut(id) {
                execution.status = ExecutionStatus::Stopped;
                execution.ended_at = Some(chrono::Utc::now());
                return Ok(execution.clone());
            }
        }

        Err(UITraceError::Execution("No running execution found".to_string()))
    }

    pub async fn get_execution_status(&self, execution_id: &str) -> Result<serde_json::Value, UITraceError> {
        let executions = self.executions.read().await;
        if let Some(execution) = executions.get(execution_id) {
            Ok(serde_json::to_value(execution)?)
        } else {
            Err(UITraceError::Execution(format!("Execution {} not found", execution_id)))
        }
    }

    async fn load_script(path: &PathBuf) -> Result<Vec<crate::models::TestStep>, UITraceError> {
        // Implementation for loading and parsing test script
        // This would read from JSON, YAML, or custom format
        todo!("Implement script loading")
    }

    async fn execute_step(
        step: &crate::models::TestStep,
        test_data: Option<&TestData>,
    ) -> Result<(), UITraceError> {
        // Implementation for executing a single test step
        // This would use WebDriver or other automation tools
        todo!("Implement step execution")
    }
}