<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">Execution Status</h3>
      <span class="status-badge" :class="getStatusClass(execution.status)">
        {{ execution.status }}
      </span>
    </div>

    <div class="space-y-4">
      <!-- Progress Bar -->
      <div v-if="execution.status === 'running'">
        <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span>{{ Math.round(progressPercentage) }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div
            class="h-3 rounded-full transition-all duration-500 ease-out"
            :class="getProgressBarColor(execution.status)"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
        </div>
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Step {{ execution.currentStep }} of {{ execution.totalSteps }}
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ execution.totalSteps }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Total Steps</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-success-600">
            {{ execution.results?.passed || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Passed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-error-600">
            {{ execution.results?.failed || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Failed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-warning-600">
            {{ execution.results?.skipped || 0 }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Skipped</div>
        </div>
      </div>

      <!-- Time Information -->
      <div class="space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">Started</span>
          <span class="text-gray-900 dark:text-white">{{ formatDate(execution.startTime) }}</span>
        </div>
        <div v-if="execution.endTime" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">Ended</span>
          <span class="text-gray-900 dark:text-white">{{ formatDate(execution.endTime) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">Duration</span>
          <span class="text-gray-900 dark:text-white">{{ getDuration() }}</span>
        </div>
        <div v-if="execution.executedBy" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">Executed by</span>
          <span class="text-gray-900 dark:text-white">{{ execution.executedBy }}</span>
        </div>
      </div>

      <!-- Current Step (when running) -->
      <div v-if="execution.status === 'running' && currentStepName" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
        <div class="text-sm font-medium text-blue-900 dark:text-blue-300">
          Currently executing: {{ currentStepName }}
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="execution.error" class="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
        <div class="text-sm font-medium text-red-900 dark:text-red-300">
          Error: {{ execution.error }}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex space-x-3">
        <button
          v-if="execution.status === 'running'"
          @click="$emit('cancel', execution)"
          class="btn btn-secondary flex-1"
        >
          <Icon name="carbon:stop-filled" class="h-4 w-4 mr-2" />
          Cancel
        </button>
        <button
          v-if="execution.status === 'failed'"
          @click="$emit('retry', execution)"
          class="btn btn-primary flex-1"
        >
          <Icon name="carbon:reset" class="h-4 w-4 mr-2" />
          Retry
        </button>
        <button
          @click="$emit('view-details', execution)"
          class="btn btn-secondary flex-1"
        >
          <Icon name="carbon:details" class="h-4 w-4 mr-2" />
          View Details
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  execution: {
    type: Object,
    required: true
  }
})

defineEmits(['cancel', 'retry', 'view-details'])

const progressPercentage = computed(() => {
  if (!props.execution.totalSteps) return 0
  return (props.execution.currentStep / props.execution.totalSteps) * 100
})

const currentStepName = computed(() => {
  // This would normally come from the execution details
  const stepNames = [
    'Navigating to page',
    'Entering credentials',
    'Clicking login button',
    'Verifying login success',
    'Running assertions'
  ]
  return stepNames[props.execution.currentStep - 1] || null
})

const getStatusClass = (status) => {
  const statusClasses = {
    running: 'status-warning',
    completed: 'status-success',
    failed: 'status-error',
    cancelled: 'status-pending'
  }
  return statusClasses[status] || 'status-pending'
}

const getProgressBarColor = (status) => {
  const colors = {
    running: 'bg-warning-500',
    completed: 'bg-success-500',
    failed: 'bg-error-500',
    cancelled: 'bg-gray-500'
  }
  return colors[status] || 'bg-gray-500'
}

const formatDate = (date) => {
  if (!date) return '-'
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

const getDuration = () => {
  const { startTime, endTime, duration } = props.execution
  if (duration) return `${duration}ms`

  if (startTime) {
    const end = endTime || new Date()
    const diff = end - startTime
    if (diff < 1000) return `${diff}ms`
    return `${(diff / 1000).toFixed(1)}s`
  }

  return '-'
}
</script>