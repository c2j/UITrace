<template>
  <div class="space-y-6">
    <!-- Script Details -->
    <div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Script Name
          </label>
          <input
            v-model="scriptData.name"
            type="text"
            class="input"
            placeholder="Enter script name"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project
          </label>
          <select v-model="scriptData.projectId" class="input">
            <option value="">Select a project</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          v-model="scriptData.description"
          rows="3"
          class="input"
          placeholder="Describe what this script tests"
        ></textarea>
      </div>
    </div>

    <!-- Script Steps -->
    <div>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Test Steps</h3>
        <button @click="addStep" class="btn btn-primary">
          <Icon name="carbon:add" class="h-4 w-4 mr-2" />
          Add Step
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(step, index) in scriptData.content.steps"
          :key="step.id"
          class="card bg-gray-50 dark:bg-gray-800/50"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
              <span class="text-sm font-medium text-gray-500 dark:text-gray-400 mr-3">
                Step {{ index + 1 }}
              </span>
              <select v-model="step.type" class="input w-[150px]">
                <option value="navigate">Navigate</option>
                <option value="click">Click</option>
                <option value="type">Type</option>
                <option value="select">Select</option>
                <option value="assert">Assert</option>
                <option value="wait">Wait</option>
                <option value="screenshot">Screenshot</option>
              </select>
            </div>
            <button
              @click="removeStep(index)"
              class="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <Icon name="carbon:trash-can" class="h-4 w-4" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- URL (for navigate) -->
            <div v-if="step.type === 'navigate'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                v-model="step.url"
                type="url"
                class="input"
                placeholder="https://example.com"
              >
            </div>

            <!-- Selectors (for click, type, select, assert) -->
            <div v-if="['click', 'type', 'select', 'assert'].includes(step.type)">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Selector
              </label>
              <div class="flex space-x-2">
                <select v-model="step.selectorType" class="input w-[100px]">
                  <option value="css">CSS</option>
                  <option value="xpath">XPath</option>
                  <option value="id">ID</option>
                  <option value="name">Name</option>
                </select>
                <input
                  v-model="step.selector"
                  type="text"
                  class="input flex-1"
                  placeholder="Enter selector"
                >
              </div>
            </div>

            <!-- Value (for type, select) -->
            <div v-if="['type', 'select'].includes(step.type)">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Value
              </label>
              <input
                v-model="step.value"
                type="text"
                class="input"
                :placeholder="step.type === 'type' ? 'Text to type' : 'Option value'"
              >
            </div>

            <!-- Assertion Type -->
            <div v-if="step.type === 'assert'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assertion
              </label>
              <select v-model="step.assertion" class="input">
                <option value="visible">Element is visible</option>
                <option value="hidden">Element is hidden</option>
                <option value="enabled">Element is enabled</option>
                <option value="disabled">Element is disabled</option>
                <option value="contains">Text contains</option>
                <option value="equals">Text equals</option>
              </select>
            </div>

            <!-- Duration (for wait) -->
            <div v-if="step.type === 'wait'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (ms)
              </label>
              <input
                v-model.number="step.duration"
                type="number"
                class="input"
                placeholder="1000"
              >
            </div>

            <!-- Timeout (all steps) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timeout (ms)
              </label>
              <input
                v-model.number="step.timeout"
                type="number"
                class="input"
                placeholder="5000"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Variables -->
    <div>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Variables</h3>
        <button @click="addVariable" class="btn btn-secondary">
          <Icon name="carbon:add" class="h-4 w-4 mr-2" />
          Add Variable
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="(variable, index) in scriptData.content.variables"
          :key="`var-${index}`"
          class="flex items-center space-x-2"
        >
          <input
            v-model="scriptData.content.variables[index]"
            type="text"
            class="input flex-1"
            placeholder="Variable name (e.g., username)"
          >
          <button
            @click="removeVariable(index)"
            class="text-red-400 hover:text-red-600 dark:hover:text-red-300"
          >
            <Icon name="carbon:close" class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button @click="$emit('cancel')" class="btn btn-secondary">
        Cancel
      </button>
      <button @click="handleSave" class="btn btn-primary" :disabled="!isValid">
        {{ script ? 'Update' : 'Save' }} Script
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  script: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save', 'cancel'])

// Mock projects data
const projects = ref([
  { id: 1, name: 'E-commerce Platform' },
  { id: 2, name: 'Admin Dashboard' },
  { id: 3, name: 'Mobile App Web View' }
])

const scriptData = ref({
  name: '',
  description: '',
  projectId: '',
  content: {
    steps: [],
    variables: []
  }
})

// Initialize script data
if (props.script) {
  scriptData.value = {
    ...props.script,
    content: {
      steps: props.script.content?.steps || [],
      variables: props.script.content?.variables || []
    }
  }
} else {
  // Add a default step for new scripts
  addStep()
}

const isValid = computed(() => {
  return scriptData.value.name &&
         scriptData.value.projectId &&
         scriptData.value.content.steps.length > 0
})

let nextStepId = 1

const addStep = () => {
  scriptData.value.content.steps.push({
    id: nextStepId++,
    type: 'navigate',
    url: '',
    selectorType: 'css',
    selector: '',
    value: '',
    assertion: 'visible',
    duration: 1000,
    timeout: 5000
  })
}

const removeStep = (index) => {
  scriptData.value.content.steps.splice(index, 1)
}

const addVariable = () => {
  scriptData.value.content.variables.push('')
}

const removeVariable = (index) => {
  scriptData.value.content.variables.splice(index, 1)
}

const handleSave = () => {
  emit('save', {
    name: scriptData.value.name,
    description: scriptData.value.description,
    projectId: scriptData.value.projectId,
    content: scriptData.value.content
  })
}
</script>