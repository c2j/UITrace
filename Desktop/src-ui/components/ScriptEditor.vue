<template>
  <div class="script-editor">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Script Editor</h2>
      <div class="flex gap-2">
        <button
          v-if="!isRecording"
          @click="startRecording"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <Icon name="heroicons:microphone" class="w-5 h-5" />
          Start Recording
        </button>
        <button
          v-else
          @click="stopRecording"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <Icon name="heroicons:stop" class="w-5 h-5" />
          Stop Recording
        </button>
      </div>
    </div>

    <!-- Script Metadata -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h3 class="text-lg font-semibold mb-4">Script Details</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Script Name</label>
          <input
            v-model="scriptData.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter script name"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Created By</label>
          <input
            v-model="scriptData.created_by"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            disabled
          />
        </div>
      </div>
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          v-model="scriptData.description"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="3"
          placeholder="Enter script description"
        ></textarea>
      </div>
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <input
          v-model="tagsInput"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter tags separated by commas"
        />
      </div>
    </div>

    <!-- Script Steps -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Test Steps ({{ scriptData.steps.length }})</h3>
        <div class="flex gap-2">
          <button
            @click="saveScript"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Icon name="heroicons:document-save" class="w-5 h-5" />
            Save Script
          </button>
          <button
            @click="addNewStep"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Icon name="heroicons:plus" class="w-5 h-5" />
            Add Step
          </button>
        </div>
      </div>

      <div v-if="scriptData.steps.length === 0" class="text-center py-12 text-gray-500">
        <Icon name="heroicons:document-text" class="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>No steps recorded yet. Start recording to capture user actions.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="(step, index) in scriptData.steps"
          :key="step.step_id"
          class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                  {{ index + 1 }}
                </span>
                <span class="font-semibold text-gray-900">{{ step.name }}</span>
                <span
                  :class="{
                    'px-2 py-1 text-xs rounded-full': true,
                    'bg-green-100 text-green-800': step.action === 'navigate',
                    'bg-blue-100 text-blue-800': step.action === 'click',
                    'bg-purple-100 text-purple-800': step.action === 'type',
                    'bg-gray-100 text-gray-800': true
                  }"
                >
                  {{ step.action }}
                </span>
              </div>
              <p class="text-gray-600 mb-2">{{ step.description }}</p>

              <!-- Value field for type actions -->
              <div v-if="step.value" class="mb-2">
                <span class="text-sm font-medium text-gray-700">Value: </span>
                <code class="px-2 py-1 bg-gray-100 text-sm rounded">{{ step.value }}</code>
              </div>

              <!-- Selectors -->
              <div v-if="step.selectors && step.selectors.length > 0" class="mb-2">
                <span class="text-sm font-medium text-gray-700">Selectors:</span>
                <div class="mt-1 space-y-1">
                  <div
                    v-for="selector in step.selectors"
                    :key="selector.selector_type"
                    class="flex items-center gap-2 text-sm"
                  >
                    <span
                      class="px-2 py-1 rounded"
                      :class="{
                        'bg-red-100 text-red-800': selector.selector_type === 'id',
                        'bg-blue-100 text-blue-800': selector.selector_type === 'css',
                        'bg-green-100 text-green-800': selector.selector_type === 'xpath',
                        'bg-purple-100 text-purple-800': true
                      }"
                    >
                      {{ selector.selector_type }}
                    </span>
                    <code class="flex-1 text-gray-700">{{ selector.value }}</code>
                    <span class="text-gray-500">Priority: {{ selector.priority }}</span>
                  </div>
                </div>
              </div>

              <!-- Timeout -->
              <div class="text-sm text-gray-600">
                Timeout: {{ step.timeout_seconds }}s
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 ml-4">
              <button
                @click="editStep(index)"
                class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Edit step"
              >
                <Icon name="heroicons:pencil" class="w-5 h-5" />
              </button>
              <button
                @click="duplicateStep(index)"
                class="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                title="Duplicate step"
              >
                <Icon name="heroicons:document-duplicate" class="w-5 h-5" />
              </button>
              <button
                @click="deleteStep(index)"
                class="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete step"
              >
                <Icon name="heroicons:trash" class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Status -->
    <div v-if="saveStatus" :class="{
      'px-4 py-3 rounded-lg mb-6': true,
      'bg-green-100 text-green-800': saveStatus.type === 'success',
      'bg-red-100 text-red-800': saveStatus.type === 'error',
      'bg-blue-100 text-blue-800': saveStatus.type === 'info'
    }">
      <div class="flex items-center">
        <Icon
          :name="{
            'success': 'heroicons:check-circle',
            'error': 'heroicons:x-circle',
            'info': 'heroicons:information-circle'
          }[saveStatus.type]"
          class="w-5 h-5 mr-2"
        />
        {{ saveStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'

// State
const isRecording = ref(false)
const saveStatus = ref(null)
const tagsInput = ref('')

// Script data
const scriptData = ref({
  id: '',
  name: 'New Test Script',
  description: '',
  version: '1.0.0',
  created_by: 'uitrace_user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: [],
  steps: []
})

// Computed
const scriptNameDisplay = computed(() => {
  return scriptData.value.name || 'Untitled Script'
})

const stepCount = computed(() => {
  return scriptData.value.steps.length
})

// Watch for tags input changes
watch(tagsInput, (newValue) => {
  if (newValue) {
    scriptData.value.tags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag)
  } else {
    scriptData.value.tags = []
  }
})

// Methods
const startRecording = async () => {
  try {
    const sessionId = await invoke('start_recording', { url: null })
    isRecording.value = true
    showStatus('Recording started', 'info')
    console.log('Recording session ID:', sessionId)
  } catch (error) {
    showStatus(`Failed to start recording: ${error}`, 'error')
  }
}

const stopRecording = async () => {
  try {
    const steps = await invoke('stop_recording')
    isRecording.value = false
    scriptData.value.steps = steps || []
    showStatus(`Recording stopped. Captured ${stepCount.value} steps.`, 'success')
  } catch (error) {
    showStatus(`Failed to stop recording: ${error}`, 'error')
  }
}

const saveScript = async () => {
  try {
    const scriptId = await invoke('save_recording', {
      name: scriptData.value.name,
      description: scriptData.value.description,
      steps: scriptData.value.steps
    })
    scriptData.value.id = scriptId
    showStatus('Script saved successfully', 'success')
  } catch (error) {
    showStatus(`Failed to save script: ${error}`, 'error')
  }
}

const addNewStep = () => {
  const newStep = {
    step_id: stepCount.value + 1,
    name: `Step ${stepCount.value + 1}`,
    step_type: 'action',
    action: 'click',
    description: '',
    value: null,
    expected_value: null,
    timeout_seconds: 30,
    selectors: [],
    metadata: {}
  }
  scriptData.value.steps.push(newStep)
}

const editStep = (index) => {
  // TODO: Implement step editing modal
  console.log('Edit step:', index)
}

const duplicateStep = (index) => {
  const originalStep = scriptData.value.steps[index]
  const duplicateStep = {
    ...originalStep,
    step_id: stepCount.value + 1,
    name: `${originalStep.name} (Copy)`
  }
  scriptData.value.steps.splice(index + 1, 0, duplicateStep)
}

const deleteStep = (index) => {
  scriptData.value.steps.splice(index, 1)
  // Renumber steps
  scriptData.value.steps.forEach((step, i) => {
    step.step_id = i + 1
    step.name = step.name.replace(/^Step \d+/, `Step ${i + 1}`)
  })
}

const showStatus = (message, type = 'info') => {
  saveStatus.value = { message, type }
  setTimeout(() => {
    saveStatus.value = null
  }, 5000)
}

// Generate new script ID on mount
scriptData.value.id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
</script>

<style scoped>
.script-editor {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Custom scrollbar for steps container */
.space-y-4 {
  max-height: 600px;
  overflow-y: auto;
}

/* Step item hover effects */
.border-gray-200:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Code styling */
code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

/* Icon animation for recording state */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.is-recording {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>