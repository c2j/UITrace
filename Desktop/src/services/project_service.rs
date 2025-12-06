use crate::services::file_service::FileService;
use crate::utils::error_handler::UITraceError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub settings: ProjectSettings,
    pub scripts: Vec<ScriptInfo>,
    pub recordings: Vec<RecordingInfo>,
    pub test_data: Vec<TestDataInfo>,
    pub baselines: Vec<BaselineInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    pub base_url: Option<String>,
    pub default_browser: String,
    pub default_timeout: u64,
    pub screenshot_on_failure: bool,
    pub parallel_execution: bool,
    pub max_parallel_threads: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub url: String,
    pub created_at: DateTime<Utc>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestDataInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub format: String,
    pub rows_count: usize,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub component: String,
    pub created_at: DateTime<Utc>,
    pub tags: Vec<String>,
}

pub struct ProjectService {
    file_service: Arc<FileService>,
    current_project: Arc<tokio::sync::RwLock<Option<Project>>>,
}

impl ProjectService {
    pub fn new(file_service: Arc<FileService>) -> Self {
        Self {
            file_service,
            current_project: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    pub async fn create_project(
        &self,
        name: String,
        description: Option<String>,
        project_path: &Path,
    ) -> Result<Project, UITraceError> {
        let project = Project {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.clone(),
            description,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            settings: ProjectSettings::default(),
            scripts: Vec::new(),
            recordings: Vec::new(),
            test_data: Vec::new(),
            baselines: Vec::new(),
        };

        // Create project directory structure
        let base_path = project_path.join(&name);
        self.create_project_structure(&base_path).await?;

        // Save project file
        let project_file = base_path.join("project.json");
        let content = serde_json::to_string_pretty(&project)?;
        self.file_service.write_file(&project_file, &content).await?;

        // Set as current project
        {
            let mut current = self.current_project.write().await;
            *current = Some(project.clone());
        }

        Ok(project)
    }

    pub async fn open_project(&self, project_path: &Path) -> Result<Project, UITraceError> {
        let project_file = project_path.join("project.json");
        let content = self.file_service.read_file(&project_file).await?;
        let project: Project = serde_json::from_str(&content)
            .map_err(|e| UITraceError::Serialization(format!("Failed to parse project file: {}", e)))?;

        // Set as current project
        {
            let mut current = self.current_project.write().await;
            *current = Some(project.clone());
        }

        Ok(project)
    }

    pub async fn save_current_project(&self) -> Result<(), UITraceError> {
        let mut current = self.current_project.write().await;
        if let Some(ref mut project) = *current {
            project.updated_at = Utc::now();

            // Find project file path
            let project_file = self.find_project_file().await?;
            let content = serde_json::to_string_pretty(project)?;
            self.file_service.write_file(&project_file, &content).await?;
        }

        Ok(())
    }

    pub async fn get_current_project(&self) -> Result<Option<Project>, UITraceError> {
        let current = self.current_project.read().await;
        Ok(current.clone())
    }

    pub async fn add_script(&self, name: String, path: PathBuf, description: Option<String>) -> Result<(), UITraceError> {
        let mut current = self.current_project.write().await;
        if let Some(ref mut project) = *current {
            let script = ScriptInfo {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                path,
                description,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                tags: Vec::new(),
            };
            project.scripts.push(script);
        }

        Ok(())
    }

    pub async fn add_test_data(&self, name: String, path: PathBuf, format: String, rows_count: usize) -> Result<(), UITraceError> {
        let mut current = self.current_project.write().await;
        if let Some(ref mut project) = *current {
            let test_data = TestDataInfo {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                path,
                format,
                rows_count,
                created_at: Utc::now(),
            };
            project.test_data.push(test_data);
        }

        Ok(())
    }

    pub async fn export_project(&self, export_path: &Path, include_results: bool) -> Result<(), UITraceError> {
        let current = self.current_project.read().await;
        let project = current.as_ref()
            .ok_or_else(|| UITraceError::Project("No project open".to_string()))?;

        // Create export package
        // Implementation would depend on packaging format (zip, tar, etc.)
        todo!("Implement project export")
    }

    pub async fn import_project(&self, import_path: &Path) -> Result<Project, UITraceError> {
        // Import project from package
        todo!("Implement project import")
    }

    async fn create_project_structure(&self, base_path: &Path) -> Result<(), UITraceError> {
        let dirs = [
            "scripts",
            "recordings",
            "test-data",
            "baselines",
            "reports",
            "screenshots",
        ];

        for dir in dirs {
            let path = base_path.join(dir);
            self.file_service.ensure_directory_exists(&path).await?;
        }

        Ok(())
    }

    async fn find_project_file(&self) -> Result<PathBuf, UITraceError> {
        let current = self.current_project.read().await;
        let project = current.as_ref()
            .ok_or_else(|| UITraceError::Project("No project open".to_string()))?;

        // This should be improved to track the project file location
        // For now, assume it's in a known location
        Ok(PathBuf::from(format!("../projects/{}.json", project.name)))
    }
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            base_url: None,
            default_browser: "chrome".to_string(),
            default_timeout: 30000,
            screenshot_on_failure: true,
            parallel_execution: false,
            max_parallel_threads: 4,
        }
    }
}

impl Default for ProjectService {
    fn default() -> Self {
        Self::new(Arc::new(FileService::default()))
    }
}