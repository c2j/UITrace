// UITrace Recorder Popup Script

class PopupController {
  constructor() {
    this.isRecording = false;
    this.recordingId = null;
    this.eventCount = 0;
    this.recordingStartTime = null;
    this.timerInterval = null;

    this.initElements();
    this.initEventListeners();
    this.updateState();
  }

  initElements() {
    // Buttons
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.viewAllBtn = document.getElementById('viewAllBtn');
    this.optionsBtn = document.getElementById('optionsBtn');

    // Status elements
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');

    // Recording info
    this.recordingInfo = document.getElementById('recordingInfo');
    this.eventCountEl = document.getElementById('eventCount');
    this.durationEl = document.getElementById('duration');

    // Recordings list
    this.recordingsList = document.getElementById('recordingsList');
  }

  initEventListeners() {
    this.startBtn.addEventListener('click', () => this.startRecording());
    this.stopBtn.addEventListener('click', () => this.stopRecording());
    this.exportBtn.addEventListener('click', () => this.exportRecording());
    this.viewAllBtn.addEventListener('click', () => this.viewAllRecordings());
    this.optionsBtn.addEventListener('click', () => this.openOptions());

    // Update state when popup is opened
    document.addEventListener('DOMContentLoaded', () => this.updateState());
  }

  async updateState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECORDING_STATE'
      });

      this.isRecording = response.isRecording;
      this.recordingId = response.recordingId;
      this.eventCount = response.eventCount || 0;

      this.updateUI();

      // Load recent recordings
      await this.loadRecentRecordings();
    } catch (error) {
      console.error('Failed to update state:', error);
    }
  }

  updateUI() {
    if (this.isRecording) {
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.exportBtn.disabled = true;

      this.statusDot.classList.add('recording');
      this.statusText.textContent = 'Recording...';

      this.recordingInfo.style.display = 'block';
      this.eventCountEl.textContent = this.eventCount;

      // Start timer
      if (!this.timerInterval) {
        this.startTimer();
      }
    } else {
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.exportBtn.disabled = !this.recordingId;

      this.statusDot.classList.remove('recording');
      this.statusText.textContent = 'Ready';

      this.recordingInfo.style.display = 'none';

      // Stop timer
      if (this.timerInterval) {
        this.stopTimer();
      }
    }
  }

  async startRecording() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_RECORDING'
      });

      if (response.success) {
        this.recordingId = response.recordingId;
        this.eventCount = 0;
        this.recordingStartTime = Date.now();
        this.isRecording = true;
        this.updateUI();
      } else {
        this.showError('Failed to start recording');
      }
    } catch (error) {
      console.error('Start recording error:', error);
      this.showError('Failed to start recording');
    }
  }

  async stopRecording() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING'
      });

      if (response.success) {
        this.isRecording = false;
        this.recordingId = response.recording.id;
        this.updateUI();
        await this.loadRecentRecordings();
      } else {
        this.showError('Failed to stop recording');
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      this.showError('Failed to stop recording');
    }
  }

  async exportRecording() {
    if (!this.recordingId) {
      this.showError('No recording to export');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_RECORDING',
        recordingId: this.recordingId
      });

      if (response.success) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uitrace-recording-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        this.showError('Failed to export recording');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showError('Failed to export recording');
    }
  }

  async loadRecentRecordings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECORDINGS'
      });

      if (response.recordings && response.recordings.length > 0) {
        // Show last 3 recordings
        const recent = response.recordings.slice(-3).reverse();
        this.renderRecordings(recent);
      } else {
        this.renderRecordings([]);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  }

  renderRecordings(recordings) {
    if (recordings.length === 0) {
      this.recordingsList.innerHTML = '<p class="no-recordings">No recordings yet</p>';
      return;
    }

    this.recordingsList.innerHTML = recordings.map(recording => {
      const date = new Date(recording.startedAt);
      const formattedDate = date.toLocaleDateString();
      const formattedTime = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const eventCount = recording.events?.length || 0;

      return `
        <div class="recording-item" data-id="${recording.id}">
          <div class="recording-item-name">${recording.name}</div>
          <div class="recording-item-meta">
            <span>${formattedDate} ${formattedTime}</span>
            <span>${eventCount} events</span>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    this.recordingsList.querySelectorAll('.recording-item').forEach(item => {
      item.addEventListener('click', () => {
        this.recordingId = item.dataset.id;
        this.exportBtn.disabled = false;
        this.updateUI();
      });
    });
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      this.durationEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  viewAllRecordings() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('recordings.html')
    });
  }

  openOptions() {
    chrome.runtime.openOptionsPage();
  }

  showError(message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize popup controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});