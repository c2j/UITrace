// UITrace Recorder Background Script

class RecordingManager {
  constructor() {
    this.isRecording = false;
    this.currentRecording = null;
    this.recordings = [];
    this.settings = {
      captureScreenshots: true,
      highlightElements: true,
      ignoreElements: ['script', 'style', 'meta', 'link'],
      autoWait: true,
      waitThreshold: 1000 // ms
    };

    this.loadSettings();
    this.setupMessageListeners();
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get('settings');
      if (stored.settings) {
        this.settings = { ...this.settings, ...stored.settings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ settings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'START_RECORDING':
          await this.startRecording(sender.tab);
          sendResponse({ success: true, recordingId: this.currentRecording?.id });
          break;

        case 'STOP_RECORDING':
          const recording = await this.stopRecording();
          sendResponse({ success: true, recording });
          break;

        case 'GET_RECORDING_STATE':
          sendResponse({
            isRecording: this.isRecording,
            recordingId: this.currentRecording?.id,
            eventCount: this.currentRecording?.events?.length || 0
          });
          break;

        case 'RECORD_EVENT':
          if (this.isRecording) {
            await this.addEvent(message.event, sender.tab);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Not recording' });
          }
          break;

        case 'GET_RECORDINGS':
          sendResponse({ recordings: this.recordings });
          break;

        case 'EXPORT_RECORDING':
          const exported = await this.exportRecording(message.recordingId);
          sendResponse({ success: true, data: exported });
          break;

        case 'DELETE_RECORDING':
          await this.deleteRecording(message.recordingId);
          sendResponse({ success: true });
          break;

        case 'GET_SETTINGS':
          sendResponse({ settings: this.settings });
          break;

        case 'UPDATE_SETTINGS':
          this.settings = { ...this.settings, ...message.settings };
          await this.saveSettings();
          sendResponse({ success: true });
          break;

        case 'CONNECT_TO_DESKTOP':
          await this.connectToDesktop(message.port);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async startRecording(tab) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.isRecording = true;
    this.currentRecording = {
      id: this.generateId(),
      name: `Recording ${new Date().toLocaleString()}`,
      url: tab?.url || window.location.href,
      startedAt: new Date().toISOString(),
      events: [],
      metadata: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.screen.width,
          height: window.screen.height
        }
      }
    };

    // Notify all content scripts
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      try {
        await chrome.tabs.sendMessage(t.id, { type: 'START_RECORDING' });
      } catch (error) {
        // Ignore tabs without content script
      }
    }

    // Update badge
    this.updateBadge('🔴', 'Recording');

    return this.currentRecording;
  }

  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    this.isRecording = false;
    this.currentRecording.endedAt = new Date().toISOString();

    // Notify all content scripts
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      try {
        await chrome.tabs.sendMessage(t.id, { type: 'STOP_RECORDING' });
      } catch (error) {
        // Ignore tabs without content script
      }
    }

    // Add to recordings list
    this.recordings.push({ ...this.currentRecording });

    const recording = this.currentRecording;
    this.currentRecording = null;

    // Update badge
    this.updateBadge('', '');

    return recording;
  }

  async addEvent(event, tab) {
    if (!this.currentRecording) {
      return;
    }

    // Add tab information
    event.tabId = tab?.id;
    event.frameId = tab?.frameId;

    // Process event based on settings
    if (this.shouldIgnoreEvent(event)) {
      return;
    }

    // Add auto-wait events
    if (this.settings.autoWait && event.eventType !== 'Wait') {
      const lastEvent = this.currentRecording.events[this.currentRecording.events.length - 1];
      if (lastEvent) {
        const timeDiff = new Date(event.timestamp) - new Date(lastEvent.timestamp);
        if (timeDiff > this.settings.waitThreshold) {
          const waitEvent = {
            id: this.generateId(),
            timestamp: new Date(new Date(lastEvent.timestamp).getTime() + 100).toISOString(),
            eventType: 'Wait',
            data: {
              duration: Math.floor(timeDiff / 1000)
            }
          };
          this.currentRecording.events.push(waitEvent);
        }
      }
    }

    this.currentRecording.events.push(event);

    // Screenshot capture if enabled
    if (this.settings.captureScreenshots && event.eventType === 'Click') {
      await this.captureScreenshot(tab);
    }
  }

  shouldIgnoreEvent(event) {
    if (event.target?.tagName) {
      return this.settings.ignoreElements.includes(event.target.tagName.toLowerCase());
    }
    return false;
  }

  async captureScreenshot(tab) {
    if (!tab) return;

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png'
      });

      const screenshotEvent = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        eventType: 'Screenshot',
        data: {
          dataUrl: dataUrl,
          windowId: tab.windowId,
          tabId: tab.id
        }
      };

      this.currentRecording.events.push(screenshotEvent);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  }

  async exportRecording(recordingId) {
    const recording = this.recordings.find(r => r.id === recordingId) || this.currentRecording;

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Convert to UITrace desktop format
    const exported = {
      id: recording.id,
      name: recording.name,
      url: recording.url,
      started_at: recording.startedAt,
      ended_at: recording.endedAt,
      events: recording.events.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        event_type: e.eventType,
        target: {
          selector: e.target.selectors?.cssSelector || e.target.selectors?.id || '',
          tag_name: e.target.tagName || 'unknown',
          text: e.target.text,
          attributes: e.target.attributes || {}
        },
        data: e.data || {}
      })),
      metadata: recording.metadata
    };

    return exported;
  }

  async deleteRecording(recordingId) {
    const index = this.recordings.findIndex(r => r.id === recordingId);
    if (index !== -1) {
      this.recordings.splice(index, 1);
    }
  }

  async connectToDesktop(port) {
    // This would connect to the UITrace desktop app
    // For now, just store the connection info
    this.desktopPort = port;

    // Send any pending recordings
    if (this.recordings.length > 0) {
      // Implementation for sending recordings to desktop app
    }
  }

  updateBadge(text, title) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeTitle({ title });
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize the recording manager
const recordingManager = new RecordingManager();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('UITrace Recorder installed');
    // Set default settings
    chrome.storage.sync.set({
      settings: recordingManager.settings
    });
  }
});

// Handle tab updates to detect navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && recordingManager.isRecording) {
    // Send navigation event
    const navigationEvent = {
      id: recordingManager.generateId(),
      timestamp: new Date().toISOString(),
      eventType: 'Navigate',
      target: {
        url: tab.url
      },
      data: {
        url: tab.url,
        title: tab.title
      }
    };

    chrome.runtime.sendMessage({
      type: 'RECORD_EVENT',
      event: navigationEvent
    }).catch(() => {
      // Ignore if no listener
    });
  }
});

console.log('UITrace Recorder: Background script loaded');