import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface TestStep {
  stepId: number
  name: string
  action: 'navigate' | 'click' | 'type' | 'assert_text' | 'assert_url' | 'screenshot' | 'wait'
  selectors: ElementSelector[]
  value?: string
  expectedValue?: string
  timeoutSeconds: number
  screenshot: boolean
}

export interface ElementSelector {
  selectorType: 'id' | 'css' | 'xpath' | 'name' | 'data_attribute'
  value: string
  priority: number // 1-5, lower is higher priority
}

export interface TestScript {
  id: string
  name: string
  description?: string
  version: number
  steps: TestStep[]
  createdAt: string
  updatedAt: string
}

export interface ScriptExecution {
  executionId: string
  scriptId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  totalDurationMs?: number
  totalSteps: number
  successfulSteps: number
  failedSteps: number
}

export const useScriptsStore = defineStore('scripts', () => {
  // State
  const scripts = ref<TestScript[]>([])
  const currentScript = ref<TestScript | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const activeExecution = ref<ScriptExecution | null>(null)

  // Getters
  const scriptCount = computed(() => scripts.value.length)
  const hasScripts = computed(() => scripts.value.length > 0)
  const isRecording = ref(false)
  const recordedEvents = ref<any[]>([])

  // Actions
  async function loadScripts(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await invoke('get_scripts')

      if (response.success) {
        scripts.value = response.data
      } else {
        error.value = response.error || 'Failed to load scripts'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load scripts'
    } finally {
      isLoading.value = false
    }
  }

  async function createScript(name: string, description?: string): Promise<TestScript | null> {
    isLoading.value = true
    error.value = null

    try {
      const response = await invoke('create_test_script', {
        name,
        description
      })

      if (response.success) {
        const newScript = response.data
        scripts.value.push(newScript)
        currentScript.value = newScript
        return newScript
      } else {
        error.value = response.error || 'Failed to create script'
        return null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create script'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function saveScript(script: TestScript): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await invoke('save_script', { script })

      if (response.success) {
        // Update local copy
        const index = scripts.value.findIndex(s => s.id === script.id)
        if (index !== -1) {
          scripts.value[index] = script
        }
        return true
      } else {
        error.value = response.error || 'Failed to save script'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save script'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteScript(scriptId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await invoke('delete_script', { scriptId })

      if (response.success) {
        scripts.value = scripts.value.filter(s => s.id !== scriptId)
        if (currentScript.value?.id === scriptId) {
          currentScript.value = null
        }
        return true
      } else {
        error.value = response.error || 'Failed to delete script'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete script'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function setCurrentScript(script: TestScript): void {
    currentScript.value = script
  }

  function addStep(step: TestStep): void {
    if (currentScript.value) {
      currentScript.value.steps.push(step)
    }
  }

  function removeStep(stepId: number): void {
    if (currentScript.value) {
      currentScript.value.steps = currentScript.value.steps.filter(s => s.stepId !== stepId)
    }
  }

  function updateStep(stepId: number, updates: Partial<TestStep>): void {
    if (currentScript.value) {
      const step = currentScript.value.steps.find(s => s.stepId === stepId)
      if (step) {
        Object.assign(step, updates)
      }
    }
  }

  async function executeScript(scriptId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await invoke('execute_script', { scriptId })

      if (response.success) {
        activeExecution.value = response.data
        return true
      } else {
        error.value = response.error || 'Failed to execute script'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to execute script'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Recording functionality
  function startRecording(): void {
    isRecording.value = true
    recordedEvents.value = []
  }

  function stopRecording(): void {
    isRecording.value = false
  }

  function addRecordedEvent(event: any): void {
    if (isRecording.value) {
      recordedEvents.value.push(event)
    }
  }

  function clearRecordedEvents(): void {
    recordedEvents.value = []
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // State
    scripts,
    currentScript,
    isLoading,
    error,
    activeExecution,
    isRecording,
    recordedEvents,

    // Getters
    scriptCount,
    hasScripts,

    // Actions
    loadScripts,
    createScript,
    saveScript,
    deleteScript,
    setCurrentScript,
    addStep,
    removeStep,
    updateStep,
    executeScript,
    startRecording,
    stopRecording,
    addRecordedEvent,
    clearRecordedEvents,
    clearError
  }
})