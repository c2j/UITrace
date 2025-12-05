use tracing::{info, debug};
use std::path::Path;
use std::fs;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_url: String,
    pub screenshots_dir: String,
    pub scripts_dir: String,
    pub log_level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server_url: "http://localhost:8000".to_string(),
            screenshots_dir: "./screenshots".to_string(),
            scripts_dir: "./scripts".to_string(),
            log_level: "info".to_string(),
        }
    }
}

impl AppConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_file(path: &str) -> Result<Self> {
        debug!("Loading config from {}", path);

        if Path::new(path).exists() {
            let content = fs::read_to_string(path)?;
            let config: AppConfig = toml::from_str(&content)?;
            info!("Configuration loaded from {}", path);
            Ok(config)
        } else {
            info!("Config file not found, using defaults");
            Ok(Self::default())
        }
    }

    pub fn save_to_file(&self, path: &str) -> Result<()> {
        let content = toml::to_string_pretty(self)?;
        fs::write(path, content)?;
        info!("Configuration saved to {}", path);
        Ok(())
    }

    pub fn ensure_directories(&self) -> Result<()> {
        std::fs::create_dir_all(&self.screenshots_dir)?;
        std::fs::create_dir_all(&self.scripts_dir)?;
        info!("Created directories: screenshots={}, scripts={}", self.screenshots_dir, self.scripts_dir);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert_eq!(config.server_url, "http://localhost:8000");
        assert_eq!(config.log_level, "info");
    }
}