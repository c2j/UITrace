import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'

export interface TestStep {
  id?: string
  name: string
  action: string
  description?: string
  selector?: string
  selectorType?: string
  value?: string
  timeout?: number
  retryCount?: number
}

export interface TestScript {
  id: string
  name: string
  description?: string
  version: string
  tags: string[]
  steps: TestStep[]
  status: 'draft' | 'ready' | 'archived'
  createdAt: string
  updatedAt: string
}

export function useScriptEditor(initialScript?: Partial<TestScript>) {
  // State
  const script = ref<TestScript>({
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    tags: [],
    steps: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...initialScript
  })

  const isDirty = ref(false)
  const isLoading = ref(false)
  const error = ref('')

  // Computed
  const isValid = computed(() => {
    return script.value.name.trim() !== '' && script.value.steps.length > 0
  })

  const stepCount = computed(() => script.value.steps.length)

  // Actions
  const loadScript = async (scriptId: string) => {
    isLoading.value = true
    error.value = ''

    try {
      const loadedScript = await invoke<TestScript>('get_script', { scriptId })
      script.value = loadedScript
      isDirty.value = false
    } catch (err) {
      error.value = `Failed to load script: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const saveScript = async () => {
    if (!isValid.value) {
      throw new Error('Script is invalid')
    }

    isLoading.value = true
    error.value = ''

    try {
      script.value.updatedAt = new Date().toISOString()

      const savedScript = script.value.id
        ? await invoke<TestScript>('update_script', { script: script.value })
        : await invoke<TestScript>('create_script', { script: script.value })

      script.value = savedScript
      isDirty.value = false
      return savedScript
    } catch (err) {
      error.value = `Failed to save script: ${err}`
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const addStep = (step: TestStep) => {
    script.value.steps.push({
      ...step,
      id: crypto.randomUUID()
    })
    isDirty.value = true
  }

  const updateStep = (index: number, step: TestStep) => {
    if (index >= 0 && index < script.value.steps.length) {
      script.value.steps[index] = {
        ...step,
        id: script.value.steps[index].id || crypto.randomUUID()
      }
      isDirty.value = true
    }
  }

  const removeStep = (index: number) => {
    if (index >= 0 && index < script.value.steps.length) {
      script.value.steps.splice(index, 1)
      isDirty.value = true
    }
  }

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex >= 0 && fromIndex < script.value.steps.length &&
        toIndex >= 0 && toIndex < script.value.steps.length) {
      const step = script.value.steps.splice(fromIndex, 1)[0]
      script.value.steps.splice(toIndex, 0, step)
      isDirty.value = true
    }
  }

  const clearSteps = () => {
    script.value.steps = []
    isDirty.value = true
  }

  const reset = () => {
    script.value = {
      id: '',
      name: '',
      description: '',
      version: '1.0.0',
      tags: [],
      steps: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    isDirty.value = false
    error.value = ''
  }

  // Watch for changes
  watch(script, () => {
    isDirty.value = true
  }, { deep: true })

  return {
    // State
    script: readonly(script),
    isDirty: readonly(isDirty),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    isValid,
    stepCount,

    // Actions
    loadScript,
    saveScript,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    clearSteps,
    reset
  }
}