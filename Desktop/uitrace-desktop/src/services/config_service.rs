use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use tracing::{info, debug, error};
use config::{Config, ConfigError, File};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub browser: BrowserConfig,
    pub storage: StorageConfig,
    pub logging: LoggingConfig,
    pub performance: PerformanceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub api_base_url: String,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserConfig {
    pub default_browser: String,
    pub headless: bool,
    pub window_width: u32,
    pub window_height: u32,
    pub page_load_timeout: u64,
    pub implicit_wait: u64,
    pub webdriver_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub scripts_directory: String,
    pub screenshots_directory: String,
    pub baselines_directory: String,
    pub data_directory: String,
    pub reports_directory: String,
    pub max_file_size_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_path: Option<String>,
    pub max_file_size_mb: u64,
    pub max_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub execution_timeout_seconds: u64,
    pub step_timeout_seconds: u64,
    pub retry_attempts: u32,
    pub retry_delay_ms: u64,
    pub similarity_threshold: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                api_base_url: "http://localhost:8000".to_string(),
                timeout_seconds: 30,
                retry_attempts: 3,
                auth_token: None,
            },
            browser: BrowserConfig {
                default_browser: "chrome".to_string(),
                headless: false,
                window_width: 1366,
                window_height: 768,
                page_load_timeout: 30,
                implicit_wait: 10,
                webdriver_url: "http://localhost:9515".to_string(),
            },
            storage: StorageConfig {
                scripts_directory: "storage/scripts".to_string(),
                screenshots_directory: "storage/screenshots".to_string(),
                baselines_directory: "storage/baselines".to_string(),
                data_directory: "storage/data".to_string(),
                reports_directory: "storage/reports".to_string(),
                max_file_size_mb: 50,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                file_path: Some("logs/uitrace.log".to_string()),
                max_file_size_mb: 10,
                max_files: 5,
            },
            performance: PerformanceConfig {
                execution_timeout_seconds: 300,
                step_timeout_seconds: 30,
                retry_attempts: 3,
                retry_delay_ms: 1000,
                similarity_threshold: 0.98,
            },
        }
    }
}

pub struct ConfigService {
    config: AppConfig,
    config_path: String,
}

impl ConfigService {
    pub fn new() -> Result<Self, ConfigError> {
        let config_path = Self::get_config_path();
        let config = Self::load_config(&config_path)?;

        Ok(Self {
            config,
            config_path,
        })
    }

    pub fn load_config(config_path: &str) -> Result<AppConfig, ConfigError> {
        let mut settings = Config::builder();

        // Add default configuration
        let default_config = AppConfig::default();
        settings = settings.add_source(config::File::from_str(
            &serde_json::to_string_pretty(&default_config).unwrap(),
            config::FileFormat::Json,
        ));

        // Add configuration file if it exists
        if Path::new(config_path).exists() {
            info!("Loading configuration from: {}", config_path);
            settings = settings.add_source(File::with_name(config_path));
        } else {
            info!("Configuration file not found, using defaults: {}", config_path);
        }

        // Add environment variables
        settings = settings.add_source(config::Environment::with_prefix("UITRACE"));

        // Build configuration
        let config = settings.build()?;

        // Deserialize to AppConfig
        config.try_deserialize::<AppConfig>()
    }

    pub fn save_config(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Saving configuration to: {}", self.config_path);

        let config_json = serde_json::to_string_pretty(&self.config)?;

        // Ensure directory exists
        if let Some(parent) = Path::new(&self.config_path).parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&self.config_path, config_json)?;

        info!("Configuration saved successfully");
        Ok(())
    }

    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }

    pub fn get_config_mut(&mut self) -> &mut AppConfig {
        &mut self.config
    }

    pub fn update_config<F>(&mut self, updater: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnOnce(&mut AppConfig),
    {
        updater(&mut self.config);
        self.save_config()
    }

    pub fn get_server_config(&self) -> &ServerConfig {
        &self.config.server
    }

    pub fn get_browser_config(&self) -> &BrowserConfig {
        &self.config.browser
    }

    pub fn get_storage_config(&self) -> &StorageConfig {
        &self.config.storage
    }

    pub fn get_logging_config(&self) -> &LoggingConfig {
        &self.config.logging
    }

    pub fn get_performance_config(&self) -> &PerformanceConfig {
        &self.config.performance
    }

    pub fn validate_config(&self) -> Result<(), String> {
        let config = &self.config;

        // Validate server configuration
        if config.server.timeout_seconds == 0 {
            return Err("Server timeout cannot be zero".to_string());
        }

        if config.server.retry_attempts == 0 {
            return Err("Server retry attempts cannot be zero".to_string());
        }

        // Validate browser configuration
        if config.browser.window_width == 0 || config.browser.window_height == 0 {
            return Err("Browser window dimensions cannot be zero".to_string());
        }

        if config.browser.page_load_timeout == 0 {
            return Err("Page load timeout cannot be zero".to_string());
        }

        // Validate storage configuration
        if config.storage.max_file_size_mb == 0 {
            return Err("Max file size cannot be zero".to_string());
        }

        // Validate performance configuration
        if config.performance.similarity_threshold < 0.0 || config.performance.similarity_threshold > 1.0 {
            return Err("Similarity threshold must be between 0.0 and 1.0".to_string());
        }

        if config.performance.retry_delay_ms == 0 {
            return Err("Retry delay cannot be zero".to_string());
        }

        Ok(())
    }

    pub fn reset_to_defaults(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.config = AppConfig::default();
        self.save_config()
    }

    pub fn get_config_summary(&self) -> ConfigSummary {
        ConfigSummary {
            api_base_url: self.config.server.api_base_url.clone(),
            default_browser: self.config.browser.default_browser.clone(),
            scripts_directory: self.config.storage.scripts_directory.clone(),
            log_level: self.config.logging.level.clone(),
            similarity_threshold: self.config.performance.similarity_threshold,
        }
    }

    fn get_config_path() -> String {
        // Try to get config path from environment variable first
        if let Ok(path) = std::env::var("UITRACE_CONFIG_PATH") {
            return path;
        }

        // Default to user's config directory
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("uitrace").join("config.json").to_string_lossy().to_string()
        } else {
            "config.json".to_string()
        }
    }
}

#[derive(Debug, Clone)]
pub struct ConfigSummary {
    pub api_base_url: String,
    pub default_browser: String,
    pub scripts_directory: String,
    pub log_level: String,
    pub similarity_threshold: f64,
}

impl Default for ConfigService {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| {
            Self {
                config: AppConfig::default(),
                config_path: Self::get_config_path(),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();

        assert_eq!(config.server.api_base_url, "http://localhost:8000");
        assert_eq!(config.browser.default_browser, "chrome");
        assert_eq!(config.performance.similarity_threshold, 0.98);
    }

    #[test]
    fn test_config_validation() {
        let mut config = AppConfig::default();
        config.performance.similarity_threshold = 1.5; // Invalid

        let service = ConfigService {
            config,
            config_path: "test.json".to_string(),
        };

        let result = service.validate_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Similarity threshold must be between"));
    }

    #[test]
    fn test_config_summary() {
        let config = AppConfig::default();
        let service = ConfigService {
            config,
            config_path: "test.json".to_string(),
        };

        let summary = service.get_config_summary();
        assert_eq!(summary.api_base_url, "http://localhost:8000");
        assert_eq!(summary.default_browser, "chrome");
        assert_eq!(summary.similarity_threshold, 0.98);
    }

    #[test]
    fn test_config_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json").to_string_lossy().to_string();

        let mut service = ConfigService {
            config: AppConfig::default(),
            config_path: config_path.clone(),
        };

        // Save config
        let save_result = service.save_config();
        assert!(save_result.is_ok());

        // Verify file exists
        assert!(Path::new(&config_path).exists());

        // Load config
        let loaded_config = ConfigService::load_config(&config_path).unwrap();
        assert_eq!(loaded_config.server.api_base_url, "http://localhost:8000");
    }
}

// Placeholder for url crate functionality
mod url {
    #[derive(Debug)]
    pub struct Url {
        scheme: String,
    }

    impl Url {
        pub fn parse(_url: &str) -> Result<Self, Box<dyn std::error::Error>> {
            Ok(Url {
                scheme: "http".to_string(),
            })
        }

        pub fn scheme(&self) -> &str {
            &self.scheme
        }
    }
}

// Placeholder for dirs crate functionality
mod dirs {
    pub fn config_dir() -> Option<std::path::PathBuf> {
        Some(std::path::PathBuf::from("/tmp"))
    }
}