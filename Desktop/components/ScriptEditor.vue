<template>
  <div class="script-editor h-full flex flex-col">
    <!-- Toolbar -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit Script' : 'New Script' }}
          </h1>
          <div class="flex items-center space-x-2">
            <UButton
              color="gray"
              variant="ghost"
              size="sm"
              @click="showJsonView = !showJsonView"
              :icon="showJsonView ? 'heroicons:document-text' : 'heroicons:code-bracket'"
            >
              {{ showJsonView ? 'Form View' : 'JSON View' }}
            </UButton>
            <UDropdown :items="toolbarActions">
              <UButton color="gray" variant="ghost" size="sm" icon="heroicons:ellipsis-horizontal" />
            </UDropdown>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <UButton
            color="gray"
            variant="outline"
            @click="handleCancel"
            :disabled="isSaving"
          >
            Cancel
          </UButton>
          <UButton
            color="blue"
            @click="handleSave"
            :loading="isSaving"
            :disabled="!isValid"
          >
            <Icon name="heroicons:bookmark" class="w-4 h-4 mr-2" />
            Save Script
          </UButton>
        </div>
      </div>
    </div>

    <!-- Editor Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Form View -->
      <div v-if="!showJsonView" class="h-full flex">
        <!-- Left Panel - Script Metadata & Steps -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- Script Metadata -->
          <UCard class="m-6 mb-0">
            <template #header>
              <h3 class="text-lg font-medium">Script Details</h3>
            </template>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <UFormGroup label="Script Name" required>
                  <UInput
                    id="script-name"
                    v-model="script.name"
                    placeholder="Enter script name"
                    :disabled="isSaving"
                  />
                </UFormGroup>
              </div>

              <div>
                <UFormGroup label="Version">
                  <UInput
                    id="script-version"
                    v-model="script.version"
                    placeholder="1.0.0"
                    :disabled="isSaving"
                  />
                </UFormGroup>
              </div>

              <div class="md:col-span-2">
                <UFormGroup label="Description">
                  <UTextarea
                    id="script-description"
                    v-model="script.description"
                    placeholder="Describe what this script does"
                    rows="3"
                    :disabled="isSaving"
                  />
                </UFormGroup>
              </div>

              <div class="md:col-span-2">
                <UFormGroup label="Tags">
                  <UInputTags
                    id="script-tags"
                    v-model="script.tags"
                    placeholder="Add tags (e.g., smoke, regression)"
                    :suggestions="tagSuggestions"
                    :disabled="isSaving"
                  />
                </UFormGroup>
              </div>
            </div>
          </UCard>

          <!-- Steps Section -->
          <UCard class="flex-1 m-6 mt-6 flex flex-col">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium">Test Steps</h3>
                <UButton
                  size="sm"
                  color="blue"
                  @click="showAddStepModal = true"
                  icon="heroicons:plus"
                >
                  Add Step
                </UButton>
              </div>
            </template>

            <div class="flex-1 overflow-y-auto">
              <div v-if="script.steps.length === 0" class="text-center py-12">
                <Icon name="heroicons:queue-list" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p class="text-gray-600">No steps added yet</p>
                <p class="text-sm text-gray-500 mt-1">Add your first test step to get started</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(step, index) in script.steps"
                  :key="step.id || index"
                  class="group border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  :class="{ 'opacity-50': isDragging && draggedIndex === index }"
                >
                  <div class="flex items-start space-x-3">
                    <!-- Drag Handle -->
                    <div
                      class="mt-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                      draggable="true"
                      @dragstart="handleDragStart(index)"
                      @dragover.prevent="handleDragOver(index)"
                      @dragend="handleDragEnd"
                      @drop.prevent="handleDrop(index)"
                    >
                      <Icon name="heroicons:bars-3" class="w-4 h-4 text-gray-400" />
                    </div>

                    <!-- Step Content -->
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                          <span class="text-sm font-medium text-gray-500">Step {{ index + 1 }}</span>
                          <UBadge :color="getStepActionColor(step.action)" size="sm">
                            {{ step.action }}
                          </UBadge>
                          <span v-if="step.name" class="text-sm text-gray-700 dark:text-gray-300">{{ step.name }}</span>
                        </div>

                        <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <UButton
                            size="xs"
                            color="blue"
                            variant="ghost"
                            @click="editStep(index)"
                            icon="heroicons:pencil"
                          />
                          <UButton
                            size="xs"
                            color="red"
                            variant="ghost"
                            @click="deleteStep(index)"
                            icon="heroicons:trash"
                          />
                        </div>
                      </div>

                      <!-- Step Details -->
                      <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div v-if="step.selector" class="flex items-center space-x-2">
                          <span class="font-medium">Selector:</span>
                          <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                            {{ step.selector }}
                          </code>
                          <UBadge v-if="step.selectorType" size="xs" color="gray">
                            {{ step.selectorType }}
                          </UBadge>
                        </div>

                        <div v-if="step.value" class="flex items-center space-x-2">
                          <span class="font-medium">Value:</span>
                          <span>{{ step.value }}</span>
                        </div>

                        <div v-if="step.timeout" class="flex items-center space-x-2">
                          <span class="font-medium">Timeout:</span>
                          <span>{{ step.timeout }}ms</span>
                        </div>

                        <div v-if="step.description" class="text-gray-500">
                          {{ step.description }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Right Panel - Step Preview -->
        <div class="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6">
          <h3 class="text-lg font-medium mb-4">Step Preview</h3>

          <div v-if="selectedStepIndex !== null" class="space-y-4">
            <UCard>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                  <p class="text-sm text-gray-600">{{ script.steps[selectedStepIndex].action }}</p>
                </div>

                <div v-if="script.steps[selectedStepIndex].selector">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selector</label>
                  <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <code class="text-xs">{{ script.steps[selectedStepIndex].selector }}</code>
                  </div>
                </div>

                <div v-if="script.steps[selectedStepIndex].value">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                  <p class="text-sm text-gray-600">{{ script.steps[selectedStepIndex].value }}</p>
                </div>

                <div v-if="script.steps[selectedStepIndex].description">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <p class="text-sm text-gray-600">{{ script.steps[selectedStepIndex].description }}</p>
                </div>
              </div>
            </UCard>
          </div>

          <div v-else class="text-center py-12">
            <Icon name="heroicons:eye" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p class="text-gray-600">Select a step to preview</p>
          </div>
        </div>
      </div>

      <!-- JSON View -->
      <div v-else class="h-full">
        <UCard class="h-full m-6 flex flex-col">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium">JSON View</h3>
              <div class="flex items-center space-x-2">
                <UButton
                  size="sm"
                  color="blue"
                  variant="outline"
                  @click="formatJson"
                  icon="heroicons:sparkles"
                >
                  Format
                </UButton>
                <UButton
                  size="sm"
                  color="green"
                  variant="outline"
                  @click="copyJson"
                  icon="heroicons:clipboard-document"
                >
                  Copy
                </UButton>
              </div>
            </div>
          </template>

          <div class="flex-1 overflow-auto">
            <UTextarea
              v-model="jsonContent"
              :rows="20"
              class="font-mono text-sm"
              placeholder="Script JSON will appear here..."
              @update:model-value="handleJsonChange"
            />
          </div>

          <div v-if="jsonError" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400">{{ jsonError }}</p>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Add/Edit Step Modal -->
    <UModal v-model="showAddStepModal" :ui="{ width: 'sm:max-w-2xl' }">
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ editingStepIndex !== null ? 'Edit Step' : 'Add New Step' }}</h3>
        </template>

        <form @submit.prevent="saveStep" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup label="Step Name" required>
              <UInput
                v-model="stepForm.name"
                placeholder="e.g., Login to application"
                required
              />
            </UFormGroup>

            <UFormGroup label="Action" required>
              <USelectMenu
                v-model="stepForm.action"
                :options="stepActions"
                placeholder="Select action"
                required
              />
            </UFormGroup>
          </div>

          <UFormGroup label="Description">
            <UTextarea
              v-model="stepForm.description"
              placeholder="Describe what this step does"
              rows="2"
            />
          </UFormGroup>

          <div v-if="needsSelector" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormGroup label="Selector Type">
              <USelectMenu
                v-model="stepForm.selectorType"
                :options="selectorTypes"
                placeholder="Select type"
              />
            </UFormGroup>

            <UFormGroup label="Selector" class="md:col-span-2">
              <UInput
                v-model="stepForm.selector"
                placeholder="e.g., #login-button or [data-testid='submit']"
              />
            </UFormGroup>
          </div>

          <UFormGroup v-if="needsValue" label="Value">
            <UInput
              v-model="stepForm.value"
              :placeholder="getValuePlaceholder(stepForm.action)"
            />
          </UFormGroup>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup label="Timeout (ms)">
              <UInputNumber
                v-model="stepForm.timeout"
                :min="0"
                :step="1000"
                placeholder="5000"
              />
            </UFormGroup>

            <UFormGroup label="Retry Count">
              <UInputNumber
                v-model="stepForm.retryCount"
                :min="0"
                :max="5"
                placeholder="0"
              />
            </UFormGroup>
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <UButton
              type="button"
              color="gray"
              variant="outline"
              @click="closeStepModal"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              color="blue"
            >
              {{ editingStepIndex !== null ? 'Update Step' : 'Add Step' }}
            </UButton>
          </div>
        </form>
      </UCard>
    </UModal>

    <!-- Import Script Modal -->
    <UModal v-model="showImportModal">
      <UCard>
        <template #header>
          <h3 class="font-semibold">Import Script</h3>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Import from JSON file">
            <FileUpload
              accept=".json"
              @change="handleFileImport"
              :disabled="isImporting"
            />
          </UFormGroup>

          <div class="text-sm text-gray-600">
            <p>Upload a JSON file containing a valid test script. The script will be merged with your current work.</p>
          </div>
        </div>

        <template #footer>
          <UButton
            color="gray"
            variant="outline"
            @click="showImportModal = false"
          >
            Cancel
          </UButton>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/tauri'
import { save, open } from '@tauri-apps/api/dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs'

// Props
interface Props {
  scriptId?: string
  initialScript?: any
}

const props = withDefaults(defineProps<Props>(), {
  scriptId: undefined,
  initialScript: null
})

// Emits
const emit = defineEmits<{
  save: [script: any]
  cancel: []
  change: [script: any]
}>()

// State
const isEditing = computed(() => !!props.scriptId)
const isSaving = ref(false)
const isImporting = ref(false)
const showJsonView = ref(false)
const showAddStepModal = ref(false)
const showImportModal = ref(false)
const selectedStepIndex = ref<number | null>(null)
const editingStepIndex = ref<number | null>(null)
const jsonError = ref('')
const jsonContent = ref('')

// Drag and drop state
const isDragging = ref(false)
const draggedIndex = ref<number | null>(null)

// Script data
const script = ref({
  id: props.scriptId || '',
  name: '',
  description: '',
  version: '1.0.0',
  tags: [],
  steps: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

// History for undo/redo
const history = ref<any[]>([])
const historyIndex = ref(-1)

// Step form
const stepForm = ref({
  name: '',
  action: '',
  description: '',
  selector: '',
  selectorType: 'css',
  value: '',
  timeout: 5000,
  retryCount: 0
})

// Constants
const stepActions = [
  { label: 'Navigate', value: 'navigate' },
  { label: 'Click', value: 'click' },
  { label: 'Type', value: 'type' },
  { label: 'Wait', value: 'wait' },
  { label: 'Screenshot', value: 'screenshot' },
  { label: 'Assert', value: 'assert' },
  { label: 'Scroll', value: 'scroll' },
  { label: 'Hover', value: 'hover' },
  { label: 'Select', value: 'select' },
  { label: 'Upload', value: 'upload' },
  { label: 'Execute Script', value: 'execute' }
]

const selectorTypes = [
  { label: 'CSS Selector', value: 'css' },
  { label: 'XPath', value: 'xpath' },
  { label: 'Text', value: 'text' },
  { label: 'Data Test ID', value: 'data-testid' },
  { label: 'ID', value: 'id' },
  { label: 'Class', value: 'class' },
  { label: 'Name', value: 'name' },
  { label: 'Tag', value: 'tag' }
]

const tagSuggestions = [
  'smoke',
  'regression',
  'e2e',
  'login',
  'search',
  'form',
  'navigation',
  'api',
  'performance'
]

// Computed
const isValid = computed(() => {
  return script.value.name.trim() !== '' && script.value.steps.length > 0 && !jsonError.value
})

const needsSelector = computed(() => {
  const actionsRequiringSelector = ['click', 'type', 'hover', 'select', 'assert', 'scroll']
  return actionsRequiringSelector.includes(stepForm.value.action)
})

const needsValue = computed(() => {
  const actionsRequiringValue = ['type', 'select', 'navigate', 'execute']
  return actionsRequiringValue.includes(stepForm.value.action)
})

const toolbarActions = computed(() => [
  [
    {
      label: 'Import Script',
      icon: 'heroicons:arrow-down-tray',
      click: () => showImportModal.value = true
    },
    {
      label: 'Export Script',
      icon: 'heroicons:arrow-up-tray',
      click: handleExport
    }
  ],
  [
    {
      label: 'Undo',
      icon: 'heroicons:arrow-uturn-left',
      click: undo,
      disabled: historyIndex.value <= 0
    },
    {
      label: 'Redo',
      icon: 'heroicons:arrow-uturn-right',
      click: redo,
      disabled: historyIndex.value >= history.value.length - 1
    }
  ],
  [
    {
      label: 'Clear All',
      icon: 'heroicons:trash',
      color: 'red',
      click: clearScript
    }
  ]
])

// Methods
const initScript = async () => {
  if (props.initialScript) {
    script.value = { ...props.initialScript }
    updateJsonContent()
    saveToHistory()
  } else if (props.scriptId) {
    try {
      const loadedScript = await invoke('get_script', { scriptId: props.scriptId })
      script.value = { ...loadedScript }
      updateJsonContent()
      saveToHistory()
    } catch (error) {
      console.error('Failed to load script:', error)
    }
  }
}

const saveToHistory = () => {
  const state = JSON.parse(JSON.stringify(script.value))
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push(state)
  historyIndex.value++

  // Limit history size
  if (history.value.length > 50) {
    history.value.shift()
    historyIndex.value--
  }
}

const undo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    script.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    updateJsonContent()
  }
}

const redo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    script.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    updateJsonContent()
  }
}

const clearScript = () => {
  if (confirm('Are you sure you want to clear all steps?')) {
    script.value.steps = []
    saveToHistory()
    updateJsonContent()
  }
}

const updateJsonContent = () => {
  jsonContent.value = JSON.stringify(script.value, null, 2)
  jsonError.value = ''
}

const handleJsonChange = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    script.value = { ...parsed }
    jsonError.value = ''
    emit('change', script.value)
  } catch (error) {
    jsonError.value = `Invalid JSON: ${error.message}`
  }
}

const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonContent.value)
    jsonContent.value = JSON.stringify(parsed, null, 2)
    jsonError.value = ''
  } catch (error) {
    jsonError.value = `Cannot format: Invalid JSON`
  }
}

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(jsonContent.value)
    // Show success message
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const addStep = () => {
  editingStepIndex.value = null
  stepForm.value = {
    name: '',
    action: '',
    description: '',
    selector: '',
    selectorType: 'css',
    value: '',
    timeout: 5000,
    retryCount: 0
  }
  showAddStepModal.value = true
}

const editStep = (index: number) => {
  editingStepIndex.value = index
  const step = script.value.steps[index]
  stepForm.value = { ...step }
  selectedStepIndex.value = index
  showAddStepModal.value = true
}

const saveStep = () => {
  const step = { ...stepForm.value }

  if (editingStepIndex.value !== null) {
    // Update existing step
    script.value.steps[editingStepIndex.value] = step
  } else {
    // Add new step
    script.value.steps.push(step)
  }

  saveToHistory()
  updateJsonContent()
  closeStepModal()
}

const deleteStep = (index: number) => {
  if (confirm('Are you sure you want to delete this step?')) {
    script.value.steps.splice(index, 1)
    if (selectedStepIndex.value === index) {
      selectedStepIndex.value = null
    } else if (selectedStepIndex.value !== null && selectedStepIndex.value > index) {
      selectedStepIndex.value--
    }
    saveToHistory()
    updateJsonContent()
  }
}

const closeStepModal = () => {
  showAddStepModal.value = false
  editingStepIndex.value = null
  stepForm.value = {
    name: '',
    action: '',
    description: '',
    selector: '',
    selectorType: 'css',
    value: '',
    timeout: 5000,
    retryCount: 0
  }
}

const handleDragStart = (index: number) => {
  isDragging.value = true
  draggedIndex.value = index
}

const handleDragOver = (index: number) => {
  // Visual feedback
}

const handleDrop = (index: number) => {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    const draggedStep = script.value.steps[draggedIndex.value]
    script.value.steps.splice(draggedIndex.value, 1)
    script.value.steps.splice(index, 0, draggedStep)
    saveToHistory()
    updateJsonContent()
  }
}

const handleDragEnd = () => {
  isDragging.value = false
  draggedIndex.value = null
}

const getValuePlaceholder = (action: string) => {
  const placeholders = {
    'navigate': 'https://example.com',
    'type': 'Text to type',
    'select': 'Option value',
    'execute': 'JavaScript code'
  }
  return placeholders[action] || 'Value'
}

const getStepActionColor = (action: string) => {
  const colors = {
    'navigate': 'blue',
    'click': 'green',
    'type': 'purple',
    'wait': 'yellow',
    'screenshot': 'pink',
    'assert': 'red',
    'scroll': 'gray',
    'hover': 'indigo',
    'select': 'teal',
    'upload': 'orange',
    'execute': 'cyan'
  }
  return colors[action] || 'gray'
}

const handleSave = async () => {
  if (!isValid.value) return

  isSaving.value = true

  try {
    script.value.updatedAt = new Date().toISOString()

    let savedScript
    if (isEditing.value) {
      savedScript = await invoke('update_script', { script: script.value })
    } else {
      savedScript = await invoke('create_script', { script: script.value })
    }

    emit('save', savedScript)
    saveToHistory()
  } catch (error) {
    console.error('Failed to save script:', error)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
}

const handleExport = async () => {
  try {
    const filePath = await save({
      defaultPath: `${script.value.name || 'script'}.json`,
      filters: [
        {
          name: 'JSON',
          extensions: ['json']
        }
      ]
    })

    if (filePath) {
      await writeTextFile(filePath, JSON.stringify(script.value, null, 2))
      // Show success message
    }
  } catch (error) {
    console.error('Failed to export script:', error)
  }
}

const handleFileImport = async (file: File) => {
  isImporting.value = true

  try {
    const text = await file.text()
    const importedScript = JSON.parse(text)

    // Merge with current script
    script.value = {
      ...script.value,
      ...importedScript,
      id: script.value.id || importedScript.id,
      updatedAt: new Date().toISOString()
    }

    updateJsonContent()
    saveToHistory()
    showImportModal.value = false
  } catch (error) {
    jsonError.value = `Failed to import: ${error.message}`
  } finally {
    isImporting.value = false
  }
}

// Lifecycle
onMounted(() => {
  initScript()
})

// Watch for changes
watch(script, () => {
  emit('change', script.value)
}, { deep: true })
</script>

<style scoped>
.script-editor {
  height: 100%;
}
</style>