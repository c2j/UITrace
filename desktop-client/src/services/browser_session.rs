use uuid::Uuid;
use serde::{Deserialize, Serialize};

use crate::error::{Result, AppError};

#[derive(Debug, Clone)]
pub struct BrowserSessionManager {
    sessions: std::collections::HashMap<Uuid, BrowserSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSession {
    pub id: Uuid,
    pub browser_type: BrowserType,
    pub capabilities: BrowserCapabilities,
    pub webdriver_url: String,
    pub session_start_time: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BrowserType {
    Chrome,
    Firefox,
    Safari,
    Edge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserCapabilities {
    pub headless: bool,
    pub window_size: Option<(u32, u32)>,
    pub user_agent: Option<String>,
    pub accept_insecure_certs: bool,
    pub page_load_strategy: PageLoadStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PageLoadStrategy {
    Normal,
    Eager,
    None,
}

impl Default for BrowserCapabilities {
    fn default() -> Self {
        Self {
            headless: false,
            window_size: Some((1920, 1080)),
            user_agent: None,
            accept_insecure_certs: false,
            page_load_strategy: PageLoadStrategy::Normal,
        }
    }
}

impl BrowserSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: std::collections::HashMap::new(),
        }
    }

    pub fn create_session(
        &mut self,
        browser_type: BrowserType,
        capabilities: BrowserCapabilities,
        webdriver_url: String,
    ) -> Result<BrowserSession> {
        let session = BrowserSession {
            id: Uuid::new_v4(),
            browser_type,
            capabilities: capabilities.clone(),
            webdriver_url,
            session_start_time: chrono::Utc::now(),
            is_active: true,
        };

        self.sessions.insert(session.id, session.clone());
        Ok(session)
    }

    pub fn get_session(
        &self, session_id: Uuid,
    ) -> Result<BrowserSession> {
        self.sessions
            .get(&session_id)
            .cloned()
            .ok_or_else(|| AppError::ExecutionError(format!("Browser session {} not found", session_id)))
    }

    pub fn list_sessions(
        &self,
    ) -> Vec<BrowserSession> {
        self.sessions.values().cloned().collect()
    }

    pub fn close_session(
        &mut self, session_id: Uuid,
    ) -> Result<()> {
        if let Some(session) = self.sessions.get_mut(&session_id) {
            session.is_active = false;
            self.sessions.remove(&session_id);
            Ok(())
        } else {
            Err(AppError::ExecutionError(format!("Browser session {} not found", session_id)))
        }
    }

    pub fn get_default_webdriver_url(browser_type: &BrowserType) -> String {
        match browser_type {
            BrowserType::Chrome => "http://localhost:9515".to_string(),
            BrowserType::Firefox => "http://localhost:4444".to_string(),
            BrowserType::Safari => "http://localhost:4444".to_string(),
            BrowserType::Edge => "http://localhost:17556".to_string(),
        }
    }

    pub async fn validate_webdriver_connection(_webdriver_url: &str) -> Result<()> {
        // For now, return success - in real implementation this would test the connection
        Ok(())
    }

    pub async fn get_browser_info(_webdriver_url: &str) -> Result<BrowserInfo> {
        // For now, return basic info without capabilities
        Ok(BrowserInfo {
            name: "chrome".to_string(),
            version: "unknown".to_string(),
            webdriver_url: "http://localhost:9515".to_string(),
            status: "available".to_string(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserInfo {
    pub name: String,
    pub version: String,
    pub webdriver_url: String,
    pub status: String,
}

impl Default for BrowserSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_close_session() {
        let mut manager = BrowserSessionManager::new();

        let session = manager.create_session(
            BrowserType::Chrome,
            BrowserCapabilities::default(),
            "http://localhost:9515".to_string(),
        ).unwrap();

        assert_eq!(session.browser_type, BrowserType::Chrome);
        assert!(session.is_active);

        // Test closing session
        manager.close_session(session.id).unwrap();

        // Verify session is closed
        let sessions = manager.list_sessions();
        assert_eq!(sessions.len(), 0);
    }

    #[test]
    fn test_default_capabilities() {
        let caps = BrowserCapabilities::default();
        assert_eq!(caps.headless, false);
        assert_eq!(caps.window_size, Some((1920, 1080)));
        assert_eq!(caps.accept_insecure_certs, false);
    }

    #[test]
    fn test_browser_type_default_urls() {
        assert_eq!(
            BrowserSessionManager::get_default_webdriver_url(&BrowserType::Chrome),
            "http://localhost:9515"
        );
        assert_eq!(
            BrowserSessionManager::get_default_webdriver_url(&BrowserType::Firefox),
            "http://localhost:4444"
        );
    }
}

