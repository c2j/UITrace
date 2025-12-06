<template>
  <div class="space-y-6">
    <!-- Execution Configuration -->
    <div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Execute: {{ script.name }}
      </h3>

      <!-- Browser Selection -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Browser
          </label>
          <select v-model="config.browser" class="input">
            <option value="chrome">Chrome</option>
            <option value="firefox">Firefox</option>
            <option value="edge">Microsoft Edge</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Environment
          </label>
          <select v-model="config.environment" class="input">
            <option value="staging">Staging</option>
            <option value="production">Production</option>
            <option value="development">Development</option>
          </select>
        </div>
      </div>

      <!-- Data File Selection -->
      <div v-if="script.content.variables && script.content.variables.length > 0" class="mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Test Data (Optional)
        </label>
        <select v-model="config.dataFile" class="input">
          <option :value="null">No test data (single run)</option>
          <option v-for="file in dataFiles" :key="file.id" :value="file.id">
            {{ file.name }} ({{ file.rowCount }} rows)
          </option>
        </select>
      </div>

      <!-- Advanced Options -->
      <div class="mt-4">
        <button
          type="button"
          @click="showAdvanced = !showAdvanced"
          class="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
        >
          Advanced Options
          <Icon
            :name="showAdvanced ? 'carbon:chevron-up' : 'carbon:chevron-down'"
            class="h-4 w-4 ml-1 inline"
          />
        </button>

        <div v-if="showAdvanced" class="mt-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Timeout (ms)
              </label>
              <input
                v-model.number="config.defaultTimeout"
                type="number"
                class="input"
                min="1000"
                max="60000"
                step="1000"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Page Load Timeout (ms)
              </label>
              <input
                v-model.number="config.pageLoadTimeout"
                type="number"
                class="input"
                min="5000"
                max="300000"
                step="5000"
              >
            </div>
          </div>
          <div>
            <label class="flex items-center">
              <input
                v-model="config.takeScreenshots"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Take screenshots on each step
              </span>
            </label>
          </div>
          <div>
            <label class="flex items-center">
              <input
                v-model="config.headless"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Run in headless mode
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Execution Preview -->
    <div v-if="config.dataFile" class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
      <h4 class="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
        Data-Driven Execution Preview
      </h4>
      <p class="text-sm text-blue-700 dark:text-blue-400">
        This script will run {{ selectedDataFile?.rowCount || 0 }} times with different data sets.
      </p>
    </div>

    <!-- Variables Preview -->
    <div v-if="script.content.variables && script.content.variables.length > 0">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Variables in this script
      </h4>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="variable in script.content.variables"
          :key="variable"
          class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        >
          ${{ variable }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button @click="$emit('cancel')" class="btn btn-secondary">
        Cancel
      </button>
      <button @click="handleStart" class="btn btn-primary" :disabled="loading">
        <span v-if="loading">
          <Icon name="carbon:circle-dash" class="h-4 w-4 animate-spin mr-2" />
          Starting...
        </span>
        <span v-else>
          <Icon name="carbon:play" class="h-4 w-4 mr-2" />
          Start Execution
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  script: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['start', 'cancel'])

const loading = ref(false)
const showAdvanced = ref(false)
const config = ref({
  browser: 'chrome',
  environment: 'staging',
  dataFile: null,
  defaultTimeout: 5000,
  pageLoadTimeout: 30000,
  takeScreenshots: true,
  headless: false
})

// Mock data files
const dataFiles = ref([
  { id: 1, name: 'user_credentials.csv', rowCount: 5 },
  { id: 2, name: 'search_terms.csv', rowCount: 10 },
  { id: 3, name: 'product_data.csv', rowCount: 25 }
])

const selectedDataFile = computed(() => {
  return dataFiles.value.find(f => f.id === config.value.dataFile)
})

const handleStart = async () => {
  loading.value = true
  try {
    await emit('start', config.value)
  } finally {
    loading.value = false
  }
}
</script>