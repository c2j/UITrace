<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Test Executions</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">View and analyze test execution results</p>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
          <select v-model="dateRange" class="input w-full">
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
          <select v-model="projectFilter" class="input w-full">
            <option value="">All Projects</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select v-model="statusFilter" class="input w-full">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search executions..."
            class="input w-full"
          >
        </div>
      </div>
    </div>

    <!-- Executions List -->
    <div v-if="loading" class="text-center py-12">
      <Icon name="carbon:circle-dash" class="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
      <p class="text-gray-600 dark:text-gray-400">Loading executions...</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="execution in filteredExecutions"
        :key="execution.id"
        class="card hover:shadow-md transition-shadow cursor-pointer"
        @click="viewExecution(execution)"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3 mb-2">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                {{ execution.scriptName }}
              </h3>
              <span class="status-badge" :class="getStatusClass(execution.status)">
                {{ execution.status }}
              </span>
              <span v-if="execution.status === 'running'" class="text-sm text-gray-500 dark:text-gray-400">
                Started {{ formatDuration(execution.startTime) }} ago
              </span>
            </div>
            <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Project: {{ execution.projectName }}</span>
              <span>Duration: {{ execution.duration }}ms</span>
              <span v-if="execution.executedBy">Executed by: {{ execution.executedBy }}</span>
              <span>{{ formatDate(execution.createdAt) }}</span>
            </div>
            <div v-if="execution.error" class="mt-2 text-sm text-error-600 dark:text-error-400">
              Error: {{ execution.error }}
            </div>
          </div>
          <div class="ml-4 flex items-center space-x-2">
            <button
              v-if="execution.status === 'running'"
              @click.stop="cancelExecution(execution)"
              class="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              v-else
              @click.stop="rerunExecution(execution)"
              class="btn btn-primary text-sm"
            >
              Rerun
            </button>
            <Icon name="carbon:chevron-right" class="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <!-- Progress bar for running executions -->
        <div v-if="execution.status === 'running'" class="mt-4">
          <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>{{ execution.currentStep }} / {{ execution.totalSteps }} steps</span>
            <span>{{ Math.round((execution.currentStep / execution.totalSteps) * 100) }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-primary-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${(execution.currentStep / execution.totalSteps) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Execution Details Modal -->
    <Modal v-model="showDetailsModal" title="Execution Details" size="large">
      <ExecutionDetails
        v-if="selectedExecution"
        :execution="selectedExecution"
        @close="showDetailsModal = false"
      />
    </Modal>
  </div>
</template>

<script setup>
const { $toast } = useNuxtApp()
const loading = ref(false)
const searchQuery = ref('')
const dateRange = ref('week')
const projectFilter = ref('')
const statusFilter = ref('')
const showDetailsModal = ref(false)
const selectedExecution = ref(null)

// Mock data
const projects = ref([
  { id: 1, name: 'E-commerce Platform' },
  { id: 2, name: 'Admin Dashboard' },
  { id: 3, name: 'Mobile App Web View' }
])

const executions = ref([
  {
    id: 'exec-1',
    scriptId: 1,
    scriptName: 'Login Flow Test',
    projectId: 1,
    projectName: 'E-commerce Platform',
    status: 'completed',
    duration: 2450,
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() - 3597550),
    executedBy: 'John Doe',
    createdAt: new Date(Date.now() - 3600000),
    totalSteps: 4,
    currentStep: 4,
    results: {
      passed: 4,
      failed: 0,
      skipped: 0
    }
  },
  {
    id: 'exec-2',
    scriptId: 2,
    scriptName: 'Search Functionality',
    projectId: 1,
    projectName: 'E-commerce Platform',
    status: 'failed',
    duration: 3200,
    startTime: new Date(Date.now() - 7200000),
    endTime: new Date(Date.now() - 7196800),
    executedBy: 'Jane Smith',
    createdAt: new Date(Date.now() - 7200000),
    totalSteps: 4,
    currentStep: 4,
    results: {
      passed: 2,
      failed: 2,
      skipped: 0
    },
    error: 'Element not found: .search-results'
  },
  {
    id: 'exec-3',
    scriptId: 3,
    scriptName: 'Cart Operations',
    projectId: 1,
    projectName: 'E-commerce Platform',
    status: 'running',
    duration: 0,
    startTime: new Date(Date.now() - 300000),
    endTime: null,
    executedBy: 'Bob Johnson',
    createdAt: new Date(Date.now() - 300000),
    totalSteps: 8,
    currentStep: 5,
    results: {
      passed: 4,
      failed: 0,
      skipped: 0
    }
  },
  {
    id: 'exec-4',
    scriptId: 4,
    scriptName: 'User Registration',
    projectId: 2,
    projectName: 'Admin Dashboard',
    status: 'cancelled',
    duration: 1500,
    startTime: new Date(Date.now() - 10800000),
    endTime: new Date(Date.now() - 10785000),
    executedBy: 'Alice Brown',
    createdAt: new Date(Date.now() - 10800000),
    totalSteps: 6,
    currentStep: 2,
    results: {
      passed: 2,
      failed: 0,
      skipped: 4
    }
  }
])

const filteredExecutions = computed(() => {
  let result = executions.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      e.scriptName.toLowerCase().includes(query) ||
      e.projectName.toLowerCase().includes(query)
    )
  }

  if (projectFilter.value) {
    result = result.filter(e => e.projectId === projectFilter.value)
  }

  if (statusFilter.value) {
    result = result.filter(e => e.status === statusFilter.value)
  }

  // Filter by date range
  const now = new Date()
  let startDate
  switch (dateRange.value) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      break
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7))
      break
    case 'month':
      startDate = new Date(now.setDate(now.getDate() - 30))
      break
  }
  if (startDate) {
    result = result.filter(e => e.createdAt >= startDate)
  }

  return result.sort((a, b) => b.createdAt - a.createdAt)
})

const getStatusClass = (status) => {
  const statusClasses = {
    completed: 'status-success',
    failed: 'status-error',
    running: 'status-warning',
    cancelled: 'status-pending'
  }
  return statusClasses[status] || 'status-pending'
}

const formatDate = (date) => {
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

const formatDuration = (startTime) => {
  const duration = Date.now() - startTime
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

const viewExecution = (execution) => {
  selectedExecution.value = execution
  showDetailsModal.value = true
}

const cancelExecution = async (execution) => {
  try {
    // API call to cancel execution
    execution.status = 'cancelled'
    execution.endTime = new Date()
    execution.duration = execution.endTime - execution.startTime
    $toast.success('Execution cancelled')
  } catch (error) {
    $toast.error('Failed to cancel execution')
  }
}

const rerunExecution = async (execution) => {
  try {
    // Create new execution based on existing one
    const newExecution = {
      ...execution,
      id: `exec-${Date.now()}`,
      status: 'running',
      duration: 0,
      startTime: new Date(),
      endTime: null,
      createdAt: new Date(),
      currentStep: 0
    }
    executions.value.unshift(newExecution)
    $toast.success('Execution started')
  } catch (error) {
    $toast.error('Failed to start execution')
  }
}

// Auto-update running executions
let updateInterval = null

onMounted(() => {
  loading.value = true
  updateInterval = setInterval(() => {
    executions.value.forEach(execution => {
      if (execution.status === 'running') {
        // Simulate progress
        if (execution.currentStep < execution.totalSteps) {
          execution.currentStep = Math.min(
            execution.currentStep + Math.random(),
            execution.totalSteps
          )
        } else {
          execution.status = 'completed'
          execution.endTime = new Date()
          execution.duration = execution.endTime - execution.startTime
          execution.results = {
            passed: execution.totalSteps,
            failed: 0,
            skipped: 0
          }
        }
      }
    })
  }, 2000)

  setTimeout(() => {
    loading.value = false
  }, 500)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>