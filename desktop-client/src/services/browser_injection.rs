//! Browser injection and event monitoring for script recording
//! T025: Implement browser injection and monitoring for script recording

use thirtyfour::prelude::*;
use tokio::sync::mpsc;
use std::sync::Arc;
use log::{info, error};

use crate::error::Result;
use crate::models::Selector;
use crate::services::recording::ElementInfo;
use crate::services::RecordingService;

/// Browser injection service for event monitoring
pub struct BrowserInjectionService {
    driver: WebDriver,
    recording_service: Arc<RecordingService>,
    selector_generator: Arc<crate::services::SelectorGenerator>,
    event_tx: mpsc::Sender<UserInteractionEvent>,
    is_monitoring: Arc<tokio::sync::RwLock<bool>>,
}

/// User interaction events captured from the browser
#[derive(Debug, Clone)]
pub enum UserInteractionEvent {
    Click {
        element: ElementInfo,
        selectors: Vec<Selector>,
        position: (f64, f64),
    },
    Type {
        element: ElementInfo,
        text: String,
        selectors: Vec<Selector>,
    },
    Navigate {
        url: String,
    },
    Scroll {
        direction: ScrollDirection,
        amount: f64,
    },
    Wait {
        duration_ms: u64,
    },
}

#[derive(Debug, Clone)]
pub enum ScrollDirection {
    Up,
    Down,
    Left,
    Right,
}

impl BrowserInjectionService {
    pub fn new(
        driver: WebDriver,
        recording_service: Arc<RecordingService>,
        selector_generator: Arc<crate::services::SelectorGenerator>,
    ) -> (Self, mpsc::Receiver<UserInteractionEvent>) {
        let (event_tx, event_rx) = mpsc::channel(100);

        let service = Self {
            driver,
            recording_service,
            selector_generator,
            event_tx,
            is_monitoring: Arc::new(tokio::sync::RwLock::new(false)),
        };

        (service, event_rx)
    }

    /// Start browser monitoring and injection
    pub async fn start_monitoring(&self) -> Result<()> {
        info!("Starting browser injection and event monitoring");

        // Inject monitoring scripts
        self.inject_monitoring_scripts().await?;

        // Start event listeners
        self.start_event_listeners().await?;

        *self.is_monitoring.write().await = true;
        info!("Browser injection and monitoring started successfully");

        Ok(())
    }

    /// Stop monitoring
    pub async fn stop_monitoring(&self) -> Result<()> {
        info!("Stopping browser injection and monitoring");

        *self.is_monitoring.write().await = false;

        // Cleanup monitoring scripts
        self.cleanup_monitoring_scripts().await?;

        info!("Browser injection and monitoring stopped");
        Ok(())
    }

    /// Inject monitoring scripts into the page
    async fn inject_monitoring_scripts(&self) -> Result<()> {
        let monitoring_script = r#"
        (function() {
            // Create a global object to store UITrace monitoring data
            window.__UITRACE_MONITORING__ = {
                events: [],
                isRecording: false,

                startRecording: function() {
                    this.isRecording = true;
                    console.log('[UITrace] Monitoring started');
                },

                stopRecording: function() {
                    this.isRecording = false;
                    console.log('[UITrace] Monitoring stopped');
                },

                recordEvent: function(event) {
                    if (!this.isRecording) return;

                    event.timestamp = Date.now();
                    this.events.push(event);

                    // Dispatch custom event for background script
                    window.dispatchEvent(new CustomEvent('uitrace-event', {
                        detail: event
                    }));
                }
            };

            // Monitor click events
            document.addEventListener('click', function(event) {
                if (!window.__UITRACE_MONITORING__.isRecording) return;

                const element = event.target;
                const elementInfo = {
                    tagName: element.tagName.toLowerCase(),
                    textContent: element.textContent ? element.textContent.trim().substring(0, 100) : '',
                    attributes: {},
                    boundingRect: element.getBoundingClientRect()
                };

                // Collect important attributes
                for (let attr of element.attributes) {
                    if (attr.name.startsWith('data-') ||
                        attr.name === 'id' ||
                        attr.name === 'name' ||
                        attr.name === 'class' ||
                        attr.name === 'type' ||
                        attr.name === 'href' ||
                        attr.name === 'src') {
                        elementInfo.attributes[attr.name] = attr.value;
                    }
                }

                const clickEvent = {
                    type: 'click',
                    element: elementInfo,
                    position: {
                        x: event.clientX,
                        y: event.clientY
                    },
                    button: event.button,
                    modifiers: {
                        ctrl: event.ctrlKey,
                        shift: event.shiftKey,
                        alt: event.altKey,
                        meta: event.metaKey
                    }
                };

                window.__UITRACE_MONITORING__.recordEvent(clickEvent);
            }, true);

            // Monitor input/typing events
            let typingTimer;
            const TYPING_DELAY = 500; // ms

            document.addEventListener('input', function(event) {
                if (!window.__UITRACE_MONITORING__.isRecording) return;

                clearTimeout(typingTimer);

                const element = event.target;

                // Only record for text input elements
                if (!['INPUT', 'TEXTAREA'].includes(element.tagName)) return;

                typingTimer = setTimeout(function() {
                    const elementInfo = {
                        tagName: element.tagName.toLowerCase(),
                        attributes: {}
                    };

                    // Collect relevant attributes
                    for (let attr of element.attributes) {
                        if (attr.name === 'id' || attr.name === 'name' || attr.name === 'type') {
                            elementInfo.attributes[attr.name] = attr.value;
                        }
                    }

                    const typeEvent = {
                        type: 'type',
                        element: elementInfo,
                        text: element.value,
                        inputType: element.type
                    };

                    window.__UITRACE_MONITORING__.recordEvent(typeEvent);
                }, TYPING_DELAY);
            }, true);

            // Monitor navigation events
            let lastUrl = window.location.href;

            const checkNavigation = function() {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl && window.__UITRACE_MONITORING__.isRecording) {
                    const navEvent = {
                        type: 'navigation',
                        from: lastUrl,
                        to: currentUrl
                    };

                    window.__UITRACE_MONITORING__.recordEvent(navEvent);
                    lastUrl = currentUrl;
                }
            };

            // Monitor URL changes
            window.addEventListener('popstate', checkNavigation);

            // Monitor hash changes
            window.addEventListener('hashchange', checkNavigation);

            // Monitor scroll events
            let scrollTimer;
            const SCROLL_DELAY = 200;

            window.addEventListener('scroll', function() {
                if (!window.__UITRACE_MONITORING__.isRecording) return;

                clearTimeout(scrollTimer);

                scrollTimer = setTimeout(function() {
                    const scrollEvent = {
                        type: 'scroll',
                        position: {
                            x: window.scrollX,
                            y: window.scrollY
                        },
                        direction: window.scrollY > (window.__UITRACE_MONITORING__.lastScrollY || 0) ? 'down' : 'up'
                    };

                    window.__UITRACE_MONITORING__.lastScrollY = window.scrollY;
                    window.__UITRACE_MONITORING__.recordEvent(scrollEvent);
                }, SCROLL_DELAY);
            }, true);

            console.log('[UITrace] Monitoring scripts injected successfully');
        })();
        "#;

        self.driver.execute(monitoring_script, vec![]).await?;
        info!("Monitoring scripts injected successfully");
        Ok(())
    }

    /// Start event listeners for user interactions
    async fn start_event_listeners(&self) -> Result<()> {
        // Listen for custom events from the injected script
        let listener_script = r#"
        (function() {
            if (window.__UITRACE_EVENT_LISTENER__) {
                window.removeEventListener('uitrace-event', window.__UITRACE_EVENT_LISTENER__);
            }

            window.__UITRACE_EVENT_LISTENER__ = function(event) {
                // Store the event in a global array for retrieval
                if (!window.__UITRACE_EVENTS__) {
                    window.__UITRACE_EVENTS__ = [];
                }
                window.__UITRACE_EVENTS__.push(event.detail);
            };

            window.addEventListener('uitrace-event', window.__UITRACE_EVENT_LISTENER__);
            console.log('[UITrace] Event listener registered');
        })();
        "#;

        self.driver.execute(listener_script, vec![]).await?;

        // Start polling for events
        self.start_event_polling().await?;

        Ok(())
    }

    /// Start polling for recorded events
    async fn start_event_polling(&self) -> Result<()> {
        let _event_tx = self.event_tx.clone();
        let driver = self.driver.clone();
        let is_monitoring = self.is_monitoring.clone();
        let _selector_generator = self.selector_generator.clone();
        let _recording_service = self.recording_service.clone();

        tokio::spawn(async move {
            let poll_interval = tokio::time::Duration::from_millis(100);

            loop {
                if !*is_monitoring.read().await {
                    break;
                }

                // Poll for events
                let script = r#"
                (function() {
                    if (window.__UITRACE_EVENTS__ && window.__UITRACE_EVENTS__.length > 0) {
                        const events = window.__UITRACE_EVENTS__.splice(0);
                        return events;
                    }
                    return [];
                })();
                "#;

                match driver.execute(script, vec![]).await {
                    Ok(_result) => {
                        // For now, we'll use a simplified approach
                        // In a real implementation, we would parse the ScriptRet properly
                        // For this iteration, we'll focus on the core functionality
                    }
                    Err(e) => {
                        error!("Failed to poll events: {}", e);
                    }
                }

                tokio::time::sleep(poll_interval).await;
            }
        });

        Ok(())
    }

    /// Cleanup monitoring scripts
    async fn cleanup_monitoring_scripts(&self) -> Result<()> {
        let cleanup_script = r#"
        (function() {
            if (window.__UITRACE_MONITORING__) {
                window.__UITRACE_MONITORING__.stopRecording();
                delete window.__UITRACE_MONITORING__;
            }

            if (window.__UITRACE_EVENT_LISTENER__) {
                window.removeEventListener('uitrace-event', window.__UITRACE_EVENT_LISTENER__);
                delete window.__UITRACE_EVENT_LISTENER__;
            }

            if (window.__UITRACE_EVENTS__) {
                delete window.__UITRACE_EVENTS__;
            }

            console.log('[UITrace] Monitoring scripts cleaned up');
        })();
        "#;

        self.driver.execute(cleanup_script, vec![]).await?;
        info!("Monitoring scripts cleaned up successfully");
        Ok(())
    }

    /// Check if monitoring is active
    pub async fn is_monitoring(&self) -> bool {
        *self.is_monitoring.read().await
    }
}

/// Additional methods for RecordingService
impl RecordingService {
    pub async fn record_scroll(&self, _direction: ScrollDirection, _amount: f64) -> Result<()> {
        if !self.is_recording().await {
            return Ok(());
        }

        // For now, we'll skip the scroll recording since we need to refactor
        // the recording service to properly handle step updates
        // TODO: Implement proper scroll recording integration
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_interaction_event_creation() {
        let click_event = UserInteractionEvent::Click {
            element: ElementInfo {
                tag_name: "button".to_string(),
                text_content: Some("Click me".to_string()),
                attributes: HashMap::new(),
                bounding_rect: None,
            },
            selectors: vec![],
            position: (100.0, 200.0),
        };

        match click_event {
            UserInteractionEvent::Click { position, .. } => {
                assert_eq!(position.0, 100.0);
                assert_eq!(position.1, 200.0);
            }
            _ => panic!("Expected click event"),
        }
    }

    #[test]
    fn test_scroll_direction() {
        assert_eq!(format!("{:?}", ScrollDirection::Up), "Up");
        assert_eq!(format!("{:?}", ScrollDirection::Down), "Down");
        assert_eq!(format!("{:?}", ScrollDirection::Left), "Left");
        assert_eq!(format!("{:?}", ScrollDirection::Right), "Right");
    }
}