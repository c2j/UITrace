use crate::recorder::{EventCapture, DomEvent};
use crate::recorder::element_info::{ElementInfo, BoundingRect, FormData};
use crate::models::test_step::TestStep;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionMessage {
    pub message_type: String,
    pub data: serde_json::Value,
}

pub struct BrowserExtension {
    event_sender: mpsc::UnboundedSender<TestStep>,
    is_recording: Arc<Mutex<bool>>,
    recorded_steps: Arc<Mutex<Vec<TestStep>>>,
}

impl BrowserExtension {
    pub fn new() -> (Self, mpsc::UnboundedReceiver<TestStep>) {
        let (sender, receiver) = mpsc::unbounded_channel();

        let extension = Self {
            event_sender: sender,
            is_recording: Arc::new(Mutex::new(false)),
            recorded_steps: Arc::new(Mutex::new(Vec::new())),
        };

        (extension, receiver)
    }

    pub fn start_recording(&self
    ) -> Result<(), BrowserExtensionError> {
        let mut is_recording = self.is_recording.lock().unwrap();
        if *is_recording {
            return Err(BrowserExtensionError::AlreadyRecording);
        }
        *is_recording = true;
        Ok(())
    }

    pub fn stop_recording(&self
    ) -> Result<Vec<TestStep>, BrowserExtensionError> {
        let mut is_recording = self.is_recording.lock().unwrap();
        if !*is_recording {
            return Err(BrowserExtensionError::NotRecording);
        }
        *is_recording = false;

        let steps = self.recorded_steps.lock().unwrap().clone();
        Ok(steps)
    }

    pub fn is_recording(&self) -> bool {
        *self.is_recording.lock().unwrap()
    }

    pub fn handle_extension_message(
        &self,
        message: ExtensionMessage,
    ) -> Result<(), BrowserExtensionError> {
        if !self.is_recording() {
            return Ok(()); // Ignore events when not recording
        }

        match message.message_type.as_str() {
            "click" => self.handle_click_event(message.data)?,
            "input" => self.handle_input_event(message.data)?,
            "navigation" => self.handle_navigation_event(message.data)?,
            "scroll" => self.handle_scroll_event(message.data)?,
            "form_submit" => self.handle_form_submit_event(message.data)?,
            _ => {
                log::warn!("Unknown message type: {}", message.message_type);
            }
        }

        Ok(())
    }

    fn handle_click_event(
        &self,
        data: serde_json::Value,
    ) -> Result<(), BrowserExtensionError> {
        let element_info: ElementInfo = serde_json::from_value(data)
            .map_err(|e| BrowserExtensionError::InvalidData(format!("Failed to parse click event: {}", e)))?;

        let dom_event = DomEvent::Click {
            element_id: element_info.id.clone(),
            element_tag: element_info.tag_name.clone(),
            element_text: element_info.text_content.clone(),
            coordinates: (
                element_info.bounding_rect.x as u32,
                element_info.bounding_rect.y as u32,
            ),
        };

        self.process_event(dom_event)
    }

    fn handle_input_event(
        &self,
        data: serde_json::Value,
    ) -> Result<(), BrowserExtensionError> {
        let element_info: ElementInfo = serde_json::from_value(data)
            .map_err(|e| BrowserExtensionError::InvalidData(format!("Failed to parse input event: {}", e)))?;

        if let Some(form_data) = &element_info.form_data {
            let dom_event = DomEvent::Type {
                element_id: element_info.id.clone(),
                element_tag: element_info.tag_name.clone(),
                input_type: form_data.input_type.clone(),
                value: form_data.value.clone(),
            };

            self.process_event(dom_event)?;
        }

        Ok(())
    }

    fn handle_navigation_event(
        &self,
        data: serde_json::Value,
    ) -> Result<(), BrowserExtensionError> {
        let url = data.get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| BrowserExtensionError::InvalidData("Missing URL in navigation event".to_string()))?;

        let previous_url = data.get("previousUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let dom_event = DomEvent::Navigation {
            url: url.to_string(),
            previous_url: previous_url.to_string(),
        };

        self.process_event(dom_event)
    }

    fn handle_scroll_event(
        &self,
        data: serde_json::Value,
    ) -> Result<(), BrowserExtensionError> {
        let x = data.get("x").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let y = data.get("y").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let delta_x = data.get("deltaX").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let delta_y = data.get("deltaY").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

        let dom_event = DomEvent::Scroll { x, y, delta_x, delta_y };
        self.process_event(dom_event)
    }

    fn handle_form_submit_event(
        &self,
        data: serde_json::Value,
    ) -> Result<(), BrowserExtensionError> {
        // For form submission, we might want to capture the action or just log it
        log::info!("Form submission detected: {:?}", data);
        Ok(())
    }

    fn process_event(&self,
        dom_event: DomEvent,
    ) -> Result<(), BrowserExtensionError> {
        let test_step = EventCapture::capture_event(dom_event)
            .map_err(|e| BrowserExtensionError::EventCaptureError(e.to_string()))?;

        // Add step number based on current count
        let step_count = self.recorded_steps.lock().unwrap().len();
        let mut step_with_number = test_step;
        step_with_number.step_id = step_count as u32 + 1;

        // Store the step
        self.recorded_steps.lock().unwrap().push(step_with_number.clone());

        // Send the step to the channel
        self.event_sender.send(step_with_number)
            .map_err(|e| BrowserExtensionError::ChannelError(format!("Failed to send step: {}", e)))?;

        Ok(())
    }

    pub fn get_recorded_steps(&self
    ) -> Vec<TestStep> {
        self.recorded_steps.lock().unwrap().clone()
    }

    pub fn clear_recorded_steps(&self) {
        self.recorded_steps.lock().unwrap().clear();
    }

    pub fn inject_content_script() -> String {
        // This JavaScript code would be injected into the browser
        // In a real implementation, this would be loaded from a separate file
        r#"
        (function() {
            // Content script for UITrace browser extension
            const UITraceRecorder = {
                isRecording: false,
                eventBuffer: [],

                init: function() {
                    this.setupEventListeners();
                    this.notifyExtension('contentScriptReady', {});
                },

                setupEventListeners: function() {
                    // Click events
                    document.addEventListener('click', (e) => {
                        if (!this.isRecording) return;
                        this.handleClick(e);
                    }, true);

                    // Input events
                    document.addEventListener('input', (e) => {
                        if (!this.isRecording) return;
                        this.handleInput(e);
                    }, true);

                    // Form submission
                    document.addEventListener('submit', (e) => {
                        if (!this.isRecording) return;
                        this.handleFormSubmit(e);
                    }, true);

                    // Navigation (popstate)
                    window.addEventListener('popstate', (e) => {
                        if (!this.isRecording) return;
                        this.handleNavigation();
                    });

                    // Scroll events (throttled)
                    let scrollTimeout;
                    window.addEventListener('scroll', (e) => {
                        if (!this.isRecording) return;
                        clearTimeout(scrollTimeout);
                        scrollTimeout = setTimeout(() => this.handleScroll(e), 100);
                    });
                },

                handleClick: function(event) {
                    const elementInfo = this.getElementInfo(event.target);
                    elementInfo.boundingRect = this.getBoundingRect(event.target);

                    this.sendMessage({
                        messageType: 'click',
                        data: elementInfo
                    });
                },

                handleInput: function(event) {
                    const elementInfo = this.getElementInfo(event.target);
                    elementInfo.formData = {
                        inputType: event.target.type,
                        value: event.target.value,
                        placeholder: event.target.placeholder,
                        name: event.target.name
                    };

                    this.sendMessage({
                        messageType: 'input',
                        data: elementInfo
                    });
                },

                handleFormSubmit: function(event) {
                    const formData = new FormData(event.target);
                    const data = {};
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }

                    this.sendMessage({
                        messageType: 'form_submit',
                        data: {
                            action: event.target.action,
                            method: event.target.method,
                            data: data
                        }
                    });
                },

                handleNavigation: function() {
                    this.sendMessage({
                        messageType: 'navigation',
                        data: {
                            url: window.location.href,
                            previousUrl: document.referrer
                        }
                    });
                },

                handleScroll: function(event) {
                    this.sendMessage({
                        messageType: 'scroll',
                        data: {
                            x: window.scrollX,
                            y: window.scrollY,
                            deltaX: event.deltaX || 0,
                            deltaY: event.deltaY || 0
                        }
                    });
                },

                getElementInfo: function(element) {
                    const computedStyle = window.getComputedStyle(element);

                    return {
                        id: element.id || null,
                        tagName: element.tagName.toLowerCase(),
                        className: element.className || null,
                        textContent: element.textContent?.substring(0, 100) || null,
                        attributes: this.getElementAttributes(element),
                        boundingRect: this.getBoundingRect(element),
                        computedStyle: {
                            display: computedStyle.display,
                            visibility: computedStyle.visibility
                        }
                    };
                },

                getElementAttributes: function(element) {
                    const attributes = {};
                    for (let attr of element.attributes) {
                        attributes[attr.name] = attr.value;
                    }
                    return attributes;
                },

                getBoundingRect: function(element) {
                    const rect = element.getBoundingClientRect();
                    return {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        left: rect.left,
                        right: rect.right,
                        bottom: rect.bottom
                    };
                },

                sendMessage: function(message) {
                    // In a real extension, this would use chrome.runtime.sendMessage
                    // For now, we'll use a custom event
                    window.dispatchEvent(new CustomEvent('UITraceMessage', {
                        detail: message
                    }));
                },

                notifyExtension: function(messageType, data) {
                    this.sendMessage({
                        messageType: messageType,
                        data: data
                    });
                },

                startRecording: function() {
                    this.isRecording = true;
                    console.log('UITrace: Recording started');
                },

                stopRecording: function() {
                    this.isRecording = false;
                    console.log('UITrace: Recording stopped');
                }
            };

            // Initialize the recorder
            UITraceRecorder.init();

            // Expose to window for testing
            window.UITraceRecorder = UITraceRecorder;
        })();
        "#.to_string()
    }
}

#[derive(Debug, Error)]
pub enum BrowserExtensionError {
    #[error("Already recording")]
    AlreadyRecording,
    #[error("Not currently recording")]
    NotRecording,
    #[error("Invalid data: {0}")]
    InvalidData(String),
    #[error("Event capture error: {0}")]
    EventCaptureError(String),
    #[error("Channel error: {0}")]
    ChannelError(String),
}

use thiserror::Error;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_stop_recording() {
        let (extension, _receiver) = BrowserExtension::new();

        assert!(!extension.is_recording());

        // Start recording
        assert!(extension.start_recording().is_ok());
        assert!(extension.is_recording());

        // Should not be able to start again
        assert!(matches!(extension.start_recording(), Err(BrowserExtensionError::AlreadyRecording)));

        // Stop recording
        let steps = extension.stop_recording().unwrap();
        assert!(!extension.is_recording());
        assert!(steps.is_empty());

        // Should not be able to stop again
        assert!(matches!(extension.stop_recording(), Err(BrowserExtensionError::NotRecording)));
    }

    #[test]
    fn test_handle_click_message() {
        let (extension, mut receiver) = BrowserExtension::new();
        extension.start_recording().unwrap();

        let message = ExtensionMessage {
            message_type: "click".to_string(),
            data: serde_json::json!({
                "id": "test-button",
                "tag_name": "button",
                "text_content": "Click Me",
                "class_name": null,
                "attributes": {},
                "bounding_rect": {
                    "x": 100.0,
                    "y": 200.0,
                    "width": 80.0,
                    "height": 30.0
                },
                "form_data": null
            }),
        };

        assert!(extension.handle_extension_message(message).is_ok());

        // Check that step was recorded
        let steps = extension.get_recorded_steps();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0].action, "click");

        // Check that step was sent to channel
        let received_step = receiver.try_recv().unwrap();
        assert_eq!(received_step.action, "click");
    }
}

// Module exports are handled by the mod.rs file