use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tracing::{info, debug, error, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::models::{ExecutionResult, TestScript, ExecutionStatus};
use crate::executor::ScriptExecutor;

#[derive(Debug, Clone)]
pub struct ExecutionRequest {
    pub script_id: Uuid,
    pub execution_name: String,
    pub browser_type: String,
    pub data_file_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub struct ExecutionStatusUpdate {
    pub execution_id: Uuid,
    pub status: ExecutionStatus,
    pub progress: f64,
    pub current_step: Option<String>,
    pub error_message: Option<String>,
}

pub struct ExecutionService {
    active_executions: Arc<Mutex<HashMap<Uuid, ExecutionHandle>>>,
    status_sender: mpsc::Sender<ExecutionStatusUpdate>,
    status_receiver: Arc<Mutex<mpsc::Receiver<ExecutionStatusUpdate>>>,
}

struct ExecutionHandle {
    execution_id: Uuid,
    script_id: Uuid,
    join_handle: tokio::task::JoinHandle<()>,
    cancellation_token: tokio_util::sync::CancellationToken,
}

impl ExecutionService {
    pub fn new() -> Self {
        let (status_sender, status_receiver) = mpsc::channel(100);

        Self {
            active_executions: Arc::new(Mutex::new(HashMap::new())),
            status_sender,
            status_receiver: Arc::new(Mutex::new(status_receiver)),
        }
    }

    pub async fn start_execution(
        &self,
        request: ExecutionRequest,
        script: TestScript,
    ) -> Result<Uuid, String> {
        info!("Starting execution for script: {}", request.script_id);

        let execution_id = Uuid::new_v4();
        let cancellation_token = tokio_util::sync::CancellationToken::new();
        let status_sender = self.status_sender.clone();

        let execution_handle = tokio::spawn({
            let executions = self.active_executions.clone();
            let token = cancellation_token.clone();

            async move {
                let mut result = ExecutionResult::new(script.id);
                result.status = ExecutionStatus::Running;

                // Send initial status
                let _ = status_sender.send(ExecutionStatusUpdate {
                    execution_id,
                    status: ExecutionStatus::Running,
                    progress: 0.0,
                    current_step: Some("Starting execution".to_string()),
                    error_message: None,
                }).await;

                // Create WebDriver executor
                match ScriptExecutor::new().await {
                    Ok(mut executor) => {
                        // Check for cancellation before starting
                        if token.is_cancelled() {
                            info!("Execution cancelled before starting: {}", execution_id);
                            result.status = ExecutionStatus::Cancelled;
                            return;
                        }

                        // Execute the script
                        let execution_result = executor.execute_script(&script).await;

                        // Send completion status
                        let final_status = if execution_result.status == ExecutionStatus::Completed {
                            ExecutionStatus::Completed
                        } else {
                            ExecutionStatus::Failed
                        };

                        let _ = status_sender.send(ExecutionStatusUpdate {
                            execution_id,
                            status: final_status,
                            progress: 100.0,
                            current_step: Some("Execution completed".to_string()),
                            error_message: None,
                        }).await;

                        info!("Execution completed: {}", execution_id);
                    }
                    Err(e) => {
                        error!("Failed to create WebDriver executor: {}", e);

                        let _ = status_sender.send(ExecutionStatusUpdate {
                            execution_id,
                            status: ExecutionStatus::Failed,
                            progress: 0.0,
                            current_step: None,
                            error_message: Some(format!("Failed to initialize browser: {}", e)),
                        }).await;
                    }
                }

                // Remove from active executions
                if let Ok(mut executions) = executions.lock() {
                    executions.remove(&execution_id);
                }
            }
        });

        let handle = ExecutionHandle {
            execution_id,
            script_id: request.script_id,
            join_handle: execution_handle,
            cancellation_token,
        };

        // Add to active executions
        if let Ok(mut executions) = self.active_executions.lock() {
            executions.insert(execution_id, handle);
        }

        info!("Execution started with ID: {}", execution_id);
        Ok(execution_id)
    }

    pub fn stop_execution(&self, execution_id: Uuid) -> Result<(), String> {
        info!("Stopping execution: {}", execution_id);

        if let Ok(mut executions) = self.active_executions.lock() {
            if let Some(handle) = executions.get(&execution_id) {
                handle.cancellation_token.cancel();
                info!("Execution cancellation requested: {}", execution_id);
                Ok(())
            } else {
                Err(format!("Execution not found: {}", execution_id))
            }
        } else {
            Err("Failed to acquire execution lock".to_string())
        }
    }

    pub fn get_execution_status(&self, execution_id: Uuid) -> Option<ExecutionStatusUpdate> {
        // This is a simplified implementation
        // In a real implementation, you'd query the execution result from storage
        None
    }

    pub fn list_active_executions(&self) -> Vec<Uuid> {
        if let Ok(executions) = self.active_executions.lock() {
            executions.keys().cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub fn is_execution_active(&self, execution_id: Uuid) -> bool {
        if let Ok(executions) = self.active_executions.lock() {
            executions.contains_key(&execution_id)
        } else {
            false
        }
    }

    pub async fn get_status_updates(&self) -> Option<ExecutionStatusUpdate> {
        if let Ok(mut receiver) = self.status_receiver.lock() {
            receiver.recv().await
        } else {
            None
        }
    }

    pub fn get_execution_statistics(&self) -> ExecutionStatistics {
        if let Ok(executions) = self.active_executions.lock() {
            ExecutionStatistics {
                active_executions: executions.len(),
                total_executions_started: executions.len(), // Simplified - track in real implementation
                average_execution_time: 0.0, // Would be calculated from historical data
            }
        } else {
            ExecutionStatistics {
                active_executions: 0,
                total_executions_started: 0,
                average_execution_time: 0.0,
            }
        }
    }

    pub async fn shutdown(&self) {
        info!("Shutting down execution service");

        // Cancel all active executions
        if let Ok(mut executions) = self.active_executions.lock() {
            for (execution_id, handle) in executions.iter() {
                handle.cancellation_token.cancel();
                info!("Cancelled execution: {}", execution_id);
            }

            // Wait for all executions to complete
            for (_, mut handle) in executions.drain() {
                let _ = handle.join_handle.await;
            }
        }

        info!("Execution service shutdown complete");
    }
}

#[derive(Debug, Clone)]
pub struct ExecutionStatistics {
    pub active_executions: usize,
    pub total_executions_started: usize,
    pub average_execution_time: f64,
}

impl Default for ExecutionService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_execution_service_creation() {
        let service = ExecutionService::new();

        // Test initial state
        assert_eq!(service.list_active_executions().len(), 0);

        let stats = service.get_execution_statistics();
        assert_eq!(stats.active_executions, 0);
        assert_eq!(stats.total_executions_started, 0);
    }

    #[tokio::test]
    async fn test_execution_request_creation() {
        let request = ExecutionRequest {
            script_id: Uuid::new_v4(),
            execution_name: "Test Execution".to_string(),
            browser_type: "chrome".to_string(),
            data_file_id: None,
            user_id: None,
        };

        assert_eq!(request.browser_type, "chrome");
        assert!(request.data_file_id.is_none());
        assert!(request.user_id.is_none());
    }

    #[tokio::test]
    async fn test_status_update() {
        let update = ExecutionStatusUpdate {
            execution_id: Uuid::new_v4(),
            status: ExecutionStatus::Running,
            progress: 50.0,
            current_step: Some("Clicking button".to_string()),
            error_message: None,
        };

        assert_eq!(update.progress, 50.0);
        assert_eq!(update.status, ExecutionStatus::Running);
        assert!(update.current_step.is_some());
    }
}