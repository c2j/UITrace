use crate::executor::ScriptExecutor;
use crate::models::{ExecutionResult, TestData};
use crate::services::file_service::FileService;
use crate::utils::error_handler::UITraceError;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct ExecutionService {
    executor: Arc<ScriptExecutor>,
    file_service: Arc<FileService>,
    execution_history: Arc<RwLock<Vec<ExecutionResult>>>,
}

impl ExecutionService {
    pub fn new(file_service: Arc<FileService>) -> Self {
        Self {
            executor: Arc::new(ScriptExecutor::new(crate::executor::config::ExecutionConfig::default())),
            file_service,
            execution_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn execute_script(
        &self,
        script_path: PathBuf,
        test_data: Option<TestData>,
    ) -> Result<String, UITraceError> {
        // Verify script exists
        if !self.file_service.file_exists(&script_path).await {
            return Err(UITraceError::Execution(format!("Script file not found: {:?}", script_path)));
        }

        let execution_id = self.executor.execute_script(&script_path, test_data).await?;

        // Start monitoring execution in background
        let executor = Arc::clone(&self.executor);
        let history = Arc::clone(&self.execution_history);
        let exec_id = execution_id.clone();

        tokio::spawn(async move {
            // Poll for completion
            loop {
                match executor.get_execution_status(&exec_id).await {
                    Ok(status_json) => {
                        if let Ok(result) = serde_json::from_value::<ExecutionResult>(status_json) {
                            if result.status == crate::models::ExecutionStatus::Completed ||
                               result.status == crate::models::ExecutionStatus::Failed ||
                               result.status == crate::models::ExecutionStatus::Stopped {
                                // Add to history
                                let mut history = history.write().await;
                                history.push(result);
                                break;
                            }
                        }
                    }
                    Err(_) => break,
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        });

        Ok(execution_id)
    }

    pub async fn stop_execution(&self) -> Result<ExecutionResult, UITraceError> {
        let result = self.executor.stop_execution().await?;

        // Add to history
        {
            let mut history = self.execution_history.write().await;
            history.push(result.clone());
        }

        Ok(result)
    }

    pub async fn get_execution_status(&self, execution_id: &str) -> Result<ExecutionResult, UITraceError> {
        let status_json = self.executor.get_execution_status(execution_id).await?;
        let result: ExecutionResult = serde_json::from_value(status_json)
            .map_err(|e| UITraceError::Serialization(format!("Failed to parse execution result: {}", e)))?;

        Ok(result)
    }

    pub async fn get_execution_history(&self) -> Result<Vec<ExecutionResult>, UITraceError> {
        let history = self.execution_history.read().await;
        Ok(history.clone())
    }

    pub async fn retry_failed_execution(&self, execution_id: &str) -> Result<String, UITraceError> {
        let history = self.execution_history.read().await;
        let execution = history.iter()
            .find(|e| e.id.to_string() == execution_id)
            .ok_or_else(|| UITraceError::Execution("Execution not found in history".to_string()))?;

        if execution.status != crate::models::ExecutionStatus::Failed {
            return Err(UITraceError::Execution("Can only retry failed executions".to_string()));
        }

        // Retry with same script path
        self.execute_script(execution.script_path.clone(), None).await
    }

    pub async fn generate_execution_report(&self, execution_id: &str, output_path: PathBuf) -> Result<(), UITraceError> {
        let result = self.get_execution_status(execution_id).await?;

        // Generate HTML report
        let html = self.generate_html_report(&result);

        // Ensure directory exists
        self.file_service.ensure_directory_exists(output_path.parent().unwrap()).await?;

        // Write report
        tokio::fs::write(&output_path, html).await
            .map_err(|e| UITraceError::Io(e))?;

        Ok(())
    }

    fn generate_html_report(&self, result: &ExecutionResult) -> String {
        let steps_html: String = result.steps.iter()
            .map(|step| {
                let status_class = match step.status {
                    crate::models::ExecutionStatus::Completed => "completed",
                    crate::models::ExecutionStatus::Failed => "failed",
                    _ => "pending",
                };

                format!(
                    r#"
                    <div class="step {status_class}">
                        <div class="step-header">
                            <span class="step-index">Step {}</span>
                            <span class="step-type">{}</span>
                            <span class="step-status">{:?}</span>
                        </div>
                        <div class="step-description">{}</div>
                        {}
                    </div>
                    "#,
                    step.step_index + 1,
                    step.step_type,
                    step.status,
                    step.description,
                    step.error.as_ref()
                        .map(|e| format!("<div class=\"step-error\">Error: {}</div>", e))
                        .unwrap_or_default()
                )
            })
            .collect();

        format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <title>Execution Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f5f5f5; padding: 20px; border-radius: 5px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; }}
        .summary-item {{ padding: 10px; background: #e9ecef; border-radius: 3px; }}
        .steps {{ margin-top: 20px; }}
        .step {{ margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }}
        .step.completed {{ border-color: #28a745; }}
        .step.failed {{ border-color: #dc3545; }}
        .step-header {{ display: flex; gap: 10px; font-weight: bold; }}
        .step-status {{ text-transform: uppercase; }}
        .step-error {{ color: #dc3545; margin-top: 5px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Execution Report</h1>
        <p>Script: {}</p>
        <p>Started: {}</p>
        <p>Duration: {} seconds</p>
    </div>

    <div class="summary">
        <div class="summary-item">Status: {:?}</div>
        <div class="summary-item">Total Steps: {}</div>
        <div class="summary-item">Passed: {}</div>
        <div class="summary-item">Failed: {}</div>
    </div>

    <div class="steps">
        <h2>Execution Steps</h2>
        {}
    </div>
</body>
</html>
            "#,
            result.script_path.display(),
            result.started_at.format("%Y-%m-%d %H:%M:%S UTC"),
            result.ended_at
                .map(|end| (end - result.started_at).num_seconds())
                .unwrap_or(0),
            result.status,
            result.steps.len(),
            result.steps.iter().filter(|s| s.status == crate::models::ExecutionStatus::Completed).count(),
            result.steps.iter().filter(|s| s.status == crate::models::ExecutionStatus::Failed).count(),
            steps_html
        )
    }
}

impl Default for ExecutionService {
    fn default() -> Self {
        Self::new(Arc::new(FileService::default()))
    }
}