// UITrace Recorder Options Script

class OptionsController {
  constructor() {
    this.settings = {
      captureScreenshots: true,
      highlightElements: true,
      autoWait: true,
      waitThreshold: 1000,
      ignoreElements: ['script', 'style', 'meta', 'link'],
      selectorPreferences: ['id', 'dataTestId', 'name', 'class', 'xpath'],
      desktopPort: 54321
    };

    this.initElements();
    this.initEventListeners();
    this.loadSettings();
  }

  initElements() {
    // Recording settings
    this.captureScreenshots = document.getElementById('captureScreenshots');
    this.highlightElements = document.getElementById('highlightElements');
    this.autoWait = document.getElementById('autoWait');
    this.waitThreshold = document.getElementById('waitThreshold');

    // Ignore elements
    this.ignoreElementsCheckboxes = document.querySelectorAll('input[name="ignoreElements"]');

    // Selector preferences
    this.selectorPreferences = document.getElementById('selectorPreferences');
    this.selectorItems = this.selectorPreferences.querySelectorAll('.sortable-item');

    // Desktop integration
    this.desktopPort = document.getElementById('desktopPort');
    this.testConnectionBtn = document.getElementById('testConnection');

    // Data management
    this.exportSettingsBtn = document.getElementById('exportSettings');
    this.importSettingsBtn = document.getElementById('importSettings');
    this.settingsFile = document.getElementById('settingsFile');
    this.clearDataBtn = document.getElementById('clearData');

    // Footer buttons
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');

    // Modal
    this.modal = document.getElementById('confirmationModal');
  }

  initEventListeners() {
    // Save settings
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());

    // Desktop connection
    this.testConnectionBtn.addEventListener('click', () => this.testConnection());

    // Data management
    this.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
    this.importSettingsBtn.addEventListener('click', () => {
      this.settingsFile.click();
    });
    this.settingsFile.addEventListener('change', (e) => this.importSettings(e));
    this.clearDataBtn.addEventListener('click', () => this.confirmClearData());

    // Sortable selector preferences
    this.initSortable();

    // Auto-save on change
    const autoSaveElements = [
      this.captureScreenshots,
      this.highlightElements,
      this.autoWait,
      this.waitThreshold,
      this.desktopPort
    ];

    autoSaveElements.forEach(element => {
      element.addEventListener('change', () => this.saveSettings());
    });

    this.ignoreElementsCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateIgnoreElements());
    });

    // Selector preferences
    this.selectorItems.forEach(item => {
      const checkbox = item.querySelector('.setting-checkbox');
      checkbox.addEventListener('change', () => this.updateSelectorPreferences());
    });
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });

      if (response.settings) {
        this.settings = { ...this.settings, ...response.settings };
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  updateUI() {
    // Recording settings
    this.captureScreenshots.checked = this.settings.captureScreenshots;
    this.highlightElements.checked = this.settings.highlightElements;
    this.autoWait.checked = this.settings.autoWait;
    this.waitThreshold.value = this.settings.waitThreshold;

    // Ignore elements
    this.ignoreElementsCheckboxes.forEach(checkbox => {
      checkbox.checked = this.settings.ignoreElements.includes(checkbox.value);
    });

    // Selector preferences
    const selectorOrder = this.settings.selectorPreferences || [];
    const enabledSelectors = new Set(selectorOrder);

    // Sort and update selector items
    const sortedItems = Array.from(this.selectorItems).sort((a, b) => {
      const aValue = selectorOrder.indexOf(a.dataset.value);
      const bValue = selectorOrder.indexOf(b.dataset.value);
      return aValue - bValue;
    });

    this.selectorPreferences.innerHTML = '';
    sortedItems.forEach(item => {
      const checkbox = item.querySelector('.setting-checkbox');
      checkbox.checked = enabledSelectors.has(item.dataset.value);
      this.selectorPreferences.appendChild(item);
    });

    // Desktop port
    this.desktopPort.value = this.settings.desktopPort || 54321;
  }

  async saveSettings() {
    // Collect current settings
    this.settings.captureScreenshots = this.captureScreenshots.checked;
    this.settings.highlightElements = this.highlightElements.checked;
    this.settings.autoWait = this.autoWait.checked;
    this.settings.waitThreshold = parseInt(this.waitThreshold.value);
    this.settings.desktopPort = parseInt(this.desktopPort.value);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: this.settings
      });

      if (response.success) {
        this.showToast('Settings saved successfully', 'success');
      } else {
        this.showToast('Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  updateIgnoreElements() {
    const selected = [];
    this.ignoreElementsCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        selected.push(checkbox.value);
      }
    });
    this.settings.ignoreElements = selected;
    this.saveSettings();
  }

  updateSelectorPreferences() {
    const preferences = [];
    const enabled = new Set();

    this.selectorItems.forEach(item => {
      const checkbox = item.querySelector('.setting-checkbox');
      if (checkbox.checked) {
        enabled.add(item.dataset.value);
      }
      preferences.push(item.dataset.value);
    });

    this.settings.selectorPreferences = preferences.filter(p => enabled.has(p));
    this.saveSettings();
  }

  initSortable() {
    let draggedItem = null;

    this.selectorItems.forEach(item => {
      item.draggable = true;

      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        this.updateSelectorPreferences();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const afterElement = this.getDragAfterElement(this.selectorPreferences, e.clientY);
        if (afterElement == null) {
          this.selectorPreferences.appendChild(draggedItem);
        } else {
          this.selectorPreferences.insertBefore(draggedItem, afterElement);
        }
      });
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  async testConnection() {
    try {
      // Test connection to desktop app
      const response = await fetch(`http://localhost:${this.desktopPort.value}/api/test`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        this.showToast('Connected to UITrace Desktop', 'success');
      } else {
        this.showToast('Failed to connect to UITrace Desktop', 'error');
      }
    } catch (error) {
      this.showToast('UITrace Desktop not running', 'error');
    }
  }

  exportSettings() {
    const dataStr = JSON.stringify(this.settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uitrace-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
    this.showToast('Settings exported', 'success');
  }

  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);

      // Validate settings
      this.settings = { ...this.settings, ...importedSettings };
      await this.saveSettings();
      this.updateUI();

      this.showToast('Settings imported successfully', 'success');
    } catch (error) {
      console.error('Import error:', error);
      this.showToast('Failed to import settings', 'error');
    }

    // Reset file input
    event.target.value = '';
  }

  confirmClearData() {
    this.showModal(
      'Clear All Data',
      'Are you sure you want to delete all recordings and reset settings? This action cannot be undone.',
      () => this.clearAllData()
    );
  }

  async clearAllData() {
    try {
      // Clear all storage
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();

      // Reset to default settings
      await this.resetSettings();

      this.hideModal();
      this.showToast('All data cleared', 'success');
    } catch (error) {
      console.error('Clear data error:', error);
      this.showToast('Failed to clear data', 'error');
    }
  }

  async resetSettings() {
    // Reset to default values
    this.settings = {
      captureScreenshots: true,
      highlightElements: true,
      autoWait: true,
      waitThreshold: 1000,
      ignoreElements: ['script', 'style', 'meta', 'link'],
      selectorPreferences: ['id', 'dataTestId', 'name', 'class', 'xpath'],
      desktopPort: 54321
    };

    await this.saveSettings();
    this.updateUI();
    this.showToast('Settings reset to default', 'success');
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showModal(title, text, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-text">${text}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
          <button class="btn btn-danger" id="confirmBtn">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    const cancelBtn = modal.querySelector('#cancelBtn');
    const confirmBtn = modal.querySelector('#confirmBtn');

    cancelBtn.addEventListener('click', () => this.hideModal());
    confirmBtn.addEventListener('click', () => {
      onConfirm();
      this.hideModal();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideModal();
      }
    });
  }

  hideModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
      modal.remove();
    }
  }
}

// Create confirmation modal HTML dynamically
const modalHTML = `
<div id="confirmationModal" class="modal">
  <div class="modal-content">
    <h3 class="modal-title">Confirm Action</h3>
    <p class="modal-text">Are you sure you want to proceed?</p>
    <div class="modal-actions">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-danger">Confirm</button>
    </div>
  </div>
</div>
`;

// Initialize options controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});