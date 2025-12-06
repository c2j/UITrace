<template>
  <div class="space-y-6">
    <!-- Execution Summary -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ execution.scriptName }}</h3>
        <span class="status-badge" :class="getStatusClass(execution.status)">
          {{ execution.status }}
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span class="text-gray-500 dark:text-gray-400">Duration:</span>
          <span class="ml-2 text-gray-900 dark:text-white">{{ execution.duration }}ms</span>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Started:</span>
          <span class="ml-2 text-gray-900 dark:text-white">{{ formatDate(execution.startTime) }}</span>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Executed by:</span>
          <span class="ml-2 text-gray-900 dark:text-white">{{ execution.executedBy }}</span>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div class="card bg-gray-50 dark:bg-gray-800/50">
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Results Summary</h4>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-success-600">
            {{ execution.results?.passed || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Passed</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-error-600">
            {{ execution.results?.failed || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Failed</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-warning-600">
            {{ execution.results?.skipped || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Skipped</div>
        </div>
      </div>
    </div>

    <!-- Step Results -->
    <div>
      <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Step Results</h4>
      <div class="space-y-3">
        <div
          v-for="(step, index) in stepResults"
          :key="index"
          class="card"
          :class="getStepResultClass(step.status)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-3">
              <span class="flex-shrink-0 mt-0.5">
                <Icon
                  :name="getStepIcon(step.status)"
                  :class="['h-5 w-5', getStepIconColor(step.status)]"
                />
              </span>
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-white mb-1">
                  Step {{ index + 1 }}: {{ step.name }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  {{ step.description }}
                </div>
                <div v-if="step.error" class="mt-2 text-sm text-error-600 dark:text-error-400">
                  Error: {{ step.error }}
                </div>
              </div>
            </div>
            <div class="text-right text-sm text-gray-500 dark:text-gray-400">
              <div>{{ step.duration }}ms</div>
              <div class="capitalize">{{ step.status }}</div>
            </div>
          </div>

          <!-- Screenshots -->
          <div v-if="step.screenshot" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="viewScreenshot(step)"
              class="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              <Icon name="carbon:image" class="h-4 w-4 mr-1 inline" />
              View Screenshot
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Details -->
    <div v-if="execution.error" class="card bg-error-50 dark:bg-error-900/20">
      <h4 class="text-md font-medium text-error-900 dark:text-error-300 mb-2">Error Details</h4>
      <pre class="text-sm text-error-800 dark:text-error-400 whitespace-pre-wrap">{{ execution.error }}</pre>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button @click="downloadReport" class="btn btn-secondary">
        <Icon name="carbon:download" class="h-4 w-4 mr-2" />
        Download Report
      </button>
      <button @click="rerunExecution" class="btn btn-primary">
        <Icon name="carbon:reset" class="h-4 w-4 mr-2" />
        Rerun Test
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  execution: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

// Mock step results
const stepResults = ref([
  {
    name: 'Navigate to login page',
    description: 'Opening https://example.com/login',
    status: 'passed',
    duration: 523,
    screenshot: '/screenshots/step1.png'
  },
  {
    name: 'Enter username',
    description: 'Typing ${username} into #username field',
    status: 'passed',
    duration: 145,
    screenshot: '/screenshots/step2.png'
  },
  {
    name: 'Enter password',
    description: 'Typing ${password} into #password field',
    status: 'passed',
    duration: 98,
    screenshot: '/screenshots/step3.png'
  },
  {
    name: 'Click login button',
    description: 'Clicking #login-button',
    status: 'failed',
    duration: 2534,
    error: 'Element #login-button not found within timeout',
    screenshot: '/screenshots/step4.png'
  }
])

const getStatusClass = (status) => {
  const statusClasses = {
    completed: 'status-success',
    failed: 'status-error',
    running: 'status-warning',
    cancelled: 'status-pending'
  }
  return statusClasses[status] || 'status-pending'
}

const getStepResultClass = (status) => {
  const classes = {
    passed: 'border-l-4 border-l-success-500',
    failed: 'border-l-4 border-l-error-500',
    skipped: 'border-l-4 border-l-warning-500'
  }
  return classes[status] || ''
}

const getStepIcon = (status) => {
  const icons = {
    passed: 'carbon:checkmark-filled',
    failed: 'carbon:close-filled',
    skipped: 'carbon:skip-forward-filled'
  }
  return icons[status] || 'carbon:help-filled'
}

const getStepIconColor = (status) => {
  const colors = {
    passed: 'text-success-600',
    failed: 'text-error-600',
    skipped: 'text-warning-600'
  }
  return colors[status] || 'text-gray-600'
}

const formatDate = (date) => {
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

const viewScreenshot = (step) => {
  // Open screenshot in modal or new tab
  window.open(step.screenshot, '_blank')
}

const downloadReport = () => {
  // Generate and download report
  const report = {
    execution: props.execution,
    steps: stepResults.value,
    generatedAt: new Date().toISOString()
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `execution-report-${props.execution.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const rerunExecution = () => {
  navigateTo(`/scripts/${props.execution.scriptId}?run=true`)
}
</script>