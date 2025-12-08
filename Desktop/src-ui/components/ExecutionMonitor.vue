<template>
  <div class="execution-monitor">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Execution Monitor</h2>
      <div class="flex gap-2">
        <button
          v-if="!isExecuting"
          @click="startExecution"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Icon name="heroicons:play" class="w-5 h-5" />
          Start Execution
        </button>
        <button
          v-if="isExecuting"
          @click="pauseExecution"
          class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
        >
          <Icon name="heroicons:pause" class="w-5 h-5" />
          Pause
        </button>
        <button
          v-if="isExecuting"
          @click="stopExecution"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <Icon name="heroicons:stop" class="w-5 h-5" />
          Stop
        </button>
      </div>
    </div>

    <!-- Execution Status Overview -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="grid grid-cols-4 gap-6">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ executionStatus.totalSteps }}</div>
          <div class="text-sm text-gray-600">Total Steps</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ executionStatus.completedSteps }}</div>
          <div class="text-sm text-gray-600">Completed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600">{{ executionStatus.failedSteps }}</div>
          <div class="text-sm text-gray-600">Failed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">{{ executionStatus.successRate }}%</div>
          <div class="text-sm text-gray-600">Success Rate</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="mt-6">
        <div class="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{{ executionProgress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: executionProgress + '%' }"
          ></div>
        </div>
      </div>

      <!-- Current Step Info -->
      <div v-if="currentStep" class="mt-4 p-4 bg-gray-50 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-700">Current Step</div>
            <div class="text-lg font-semibold text-gray-900">{{ currentStep.name }}</div>
            <div class="text-sm text-gray-600">{{ currentStep.description }}</div>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-600">Step {{ currentStepIndex + 1 }} of {{ totalSteps }}</div>
            <div class="text-sm text-gray-600">{{ currentStep.timeout_seconds }}s timeout</div>
          </div>
        </div>

        <!-- Current Selector Info -->
        <div v-if="currentSelector" class="mt-3 pt-3 border-t border-gray-200">
          <div class="text-sm text-gray-700 mb-2">Trying selector:</div>
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-1 text-xs rounded"
              :class="{
                'bg-red-100 text-red-800': currentSelector.selector_type === 'id',
                'bg-blue-100 text-blue-800': currentSelector.selector_type === 'css',
                'bg-green-100 text-green-800': currentSelector.selector_type === 'xpath',
                'bg-purple-100 text-purple-800': true
              }"
            >
              {{ currentSelector.selector_type }}
            </span>
            <code class="text-sm text-gray-700">{{ currentSelector.value }}</code>
            <span class="text-xs text-gray-500">Priority: {{ currentSelector.priority }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Execution Log -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Execution Log</h3>
        <button
          @click="clearLog"
          class="text-sm text-gray-600 hover:text-gray-800"
        >
          Clear Log
        </button>
      </div>

      <div class="max-h-64 overflow-y-auto space-y-2">
        <div
          v-for="(log, index) in executionLog"
          :key="index"
          class="flex items-start gap-2 text-sm"
          :class="{
            'text-green-700': log.level === 'success',
            'text-red-700': log.level === 'error',
            'text-yellow-700': log.level === 'warning',
            'text-blue-700': log.level === 'info',
            'text-gray-600': log.level === 'debug'
          }"
        >
          <Icon
            :name="{
              'success': 'heroicons:check-circle',
              'error': 'heroicons:x-circle',
              'warning': 'heroicons:exclamation-triangle',
              'info': 'heroicons:information-circle',
              'debug': 'heroicons:bug-ant'
            }[log.level]"
            class="w-4 h-4 mt-0.5 flex-shrink-0"
          />
          <div class="flex-1">
            <div class="font-mono text-xs text-gray-500">{{ formatTime(log.timestamp) }}</div>
            <div>{{ log.message }}</div>
          </div>
        </div>

        <div v-if="executionLog.length === 0" class="text-center py-8 text-gray-500">
          <Icon name="heroicons:document-text" class="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No execution logs yet. Start execution to see logs here.</p>
        </div>
      </div>
    </div>

    <!-- Fallback Information -->
    <div v-if="fallbackInfo" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div class="flex items-start gap-3">
        <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <h4 class="font-semibold text-yellow-900 mb-2">Fallback Strategy Active</h4>
          <p class="text-sm text-yellow-800 mb-3">{{ fallbackInfo.message }}</p>
          <div v-if="fallbackInfo.recommendations.length > 0" class="space-y-1">
            <p class="text-sm font-medium text-yellow-900">Recommendations:</p>
            <ul class="text-sm text-yellow-800 list-disc list-inside space-y-1">
              <li v-for="rec in fallbackInfo.recommendations" :key="rec">{{ rec }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Execution Results -->
    <div v-if="executionResult" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold mb-4">Execution Results</h3>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div class="text-sm text-gray-600">Execution ID</div>
          <div class="font-mono text-sm">{{ executionResult.executionId }}</div>
        </div>
        <div>
          <div class="text-sm text-gray-600">Total Duration</div>
          <div class="font-semibold">{{ formatDuration(executionResult.totalDuration) }}</div>
        </div>
        <div>
          <div class="text-sm text-gray-600">Browser</div>
          <div>{{ executionResult.browserType }} {{ executionResult.browserVersion }}</div>
        </div>
        <div>
          <div class="text-sm text-gray-600">Fallback Used</div>
          <div :class="executionResult.fallbackUsed ? 'text-yellow-600' : 'text-gray-600'">
            {{ executionResult.fallbackUsed ? 'Yes' : 'No' }}
          </div>
        </div>
      </div>

      <div v-if="executionResult.errors.length > 0" class="mt-4">
        <h4 class="font-semibold text-red-900 mb-2">Errors</h4>
        <div class="space-y-2">
          <div
            v-for="error in executionResult.errors"
            :key="error.stepId"
            class="p-3 bg-red-50 border border-red-200 rounded"
          >
            <div class="font-medium text-red-900">Step {{ error.stepId }}: {{ error.stepName }}</div>
            <div class="text-sm text-red-700 mt-1">{{ error.message }}</div>
            <div v-if="error.fallbackSelectors.length > 0" class="mt-2">
              <div class="text-xs text-red-600 font-medium">Attempted selectors:</div>
              <ul class="text-xs text-red-600 list-disc list-inside mt-1">
                <li v-for="selector in error.fallbackSelectors" :key="selector">{{ selector }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'

// Props
const props = defineProps({
  script: {
    type: Object,
    default: null
  }
})

// State
const isExecuting = ref(false)
const currentStep = ref(null)
const currentStepIndex = ref(0)
const totalSteps = ref(0)
const currentSelector = ref(null)
const executionLog = ref([])
const executionResult = ref(null)
const fallbackInfo = ref(null)

// Computed
const executionStatus = computed(() => {
  if (!executionResult.value) {
    return {
      totalSteps: totalSteps.value,
      completedSteps: 0,
      failedSteps: 0,
      successRate: 0
    }
  }
  return executionResult.value
})

const executionProgress = computed(() => {
  if (totalSteps.value === 0) return 0
  return Math.round((executionStatus.value.completedSteps / totalSteps.value) * 100)
})

// Methods
const startExecution = async () => {
  if (!props.script) {
    addLog('No script loaded for execution', 'warning')
    return
  }

  try {
    isExecuting.value = true
    addLog('Starting script execution...', 'info')

    const result = await invoke('execute_script', {
      script: props.script,
      config: {
        maxRetries: 3,
        baseDelayMs: 1000,
        timeoutMs: 30000,
        browserType: 'chrome',
        headless: true,
        enableFallback: true
      }
    })

    executionResult.value = result
    addLog(`Script execution completed: ${result.completedSteps}/${result.totalSteps} steps`,
           result.failedSteps > 0 ? 'warning' : 'success')

    if (result.fallbackUsed) {
      addLog('Fallback selectors were used during execution', 'info')
      fallbackInfo.value = {
        message: 'The execution successfully used fallback selectors when primary selectors failed.',
        recommendations: result.fallbackRecommendations || []
      }
    }

  } catch (error) {
    addLog(`Execution failed: ${error}`, 'error')
  } finally {
    isExecuting.value = false
  }
}

const pauseExecution = async () => {
  try {
    await invoke('pause_execution')
    addLog('Execution paused', 'info')
  } catch (error) {
    addLog(`Failed to pause execution: ${error}`, 'error')
  }
}

const stopExecution = async () => {
  try {
    await invoke('stop_execution')
    addLog('Execution stopped by user', 'info')
  } catch (error) {
    addLog(`Failed to stop execution: ${error}`, 'error')
  } finally {
    isExecuting.value = false
  }
}

const clearLog = () => {
  executionLog.value = []
}

const addLog = (message, level = 'info') => {
  executionLog.value.push({
    timestamp: new Date(),
    message,
    level
  })
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// Listen for execution events
const setupExecutionListeners = () => {
  // Set up Tauri event listeners for real-time execution updates
  // This would listen for events like step_start, step_complete, selector_fallback, etc.
}

// Lifecycle
onMounted(() => {
  setupExecutionListeners()

  if (props.script) {
    totalSteps.value = props.script.steps.length
    addLog('Script loaded and ready for execution', 'info')
  }
})

onUnmounted(() => {
  // Clean up event listeners
})
</script>

<style scoped>
.execution-monitor {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Custom scrollbar for logs */
.max-h-64 {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.max-h-64::-webkit-scrollbar {
  width: 8px;
}

.max-h-64::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.max-h-64::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}

.max-h-64::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* Animation for executing state */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.is-executing {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>