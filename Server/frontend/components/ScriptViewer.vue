<template>
  <div class="space-y-6">
    <!-- Script Details -->
    <div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ script.name }}</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">{{ script.description }}</p>
      <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
        <span>Version {{ script.version }}</span>
        <span>•</span>
        <span>{{ formatDate(script.updatedAt) }}</span>
        <span>•</span>
        <span>{{ script.projectName }}</span>
      </div>
    </div>

    <!-- Script Steps -->
    <div>
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Test Steps</h4>
      <div class="space-y-3">
        <div
          v-for="(step, index) in script.content.steps"
          :key="step.id"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center">
              <span class="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                {{ index + 1 }}
              </span>
              <span class="font-medium text-gray-900 dark:text-white capitalize">
                {{ step.type }}
              </span>
            </div>
          </div>

          <div class="ml-9 space-y-1 text-sm">
            <div v-if="step.url" class="text-gray-600 dark:text-gray-400">
              URL: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{{ step.url }}</code>
            </div>
            <div v-if="step.selector" class="text-gray-600 dark:text-gray-400">
              Selector: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{{ step.selectorType }}={{ step.selector }}</code>
            </div>
            <div v-if="step.value" class="text-gray-600 dark:text-gray-400">
              Value: <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">{{ step.value }}</code>
            </div>
            <div v-if="step.assertion" class="text-gray-600 dark:text-gray-400">
              Assert: <span class="font-medium">{{ step.assertion }}</span>
            </div>
            <div v-if="step.duration" class="text-gray-600 dark:text-gray-400">
              Wait: <span class="font-medium">{{ step.duration }}ms</span>
            </div>
            <div v-if="step.timeout" class="text-gray-600 dark:text-gray-400">
              Timeout: <span class="font-medium">{{ step.timeout }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Variables -->
    <div v-if="script.content.variables && script.content.variables.length > 0">
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Variables</h4>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="variable in script.content.variables"
            :key="variable"
            class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
          >
            ${{ variable }}
          </span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button @click="$emit('close')" class="btn btn-secondary">
        Close
      </button>
      <button @click="$emit('edit')" class="btn btn-secondary">
        <Icon name="carbon:edit" class="h-4 w-4 mr-2" />
        Edit Script
      </button>
      <button @click="$emit('execute')" class="btn btn-primary">
        <Icon name="carbon:play" class="h-4 w-4 mr-2" />
        Run Script
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  script: {
    type: Object,
    required: true
  }
})

defineEmits(['close', 'edit', 'execute'])

const formatDate = (date) => {
  const options = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  return new Intl.DateTimeFormat('en-US', options).format(date)
}
</script>