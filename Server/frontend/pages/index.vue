<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Welcome back, {{ user?.username || 'User' }}!</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-primary-100 rounded-md p-3">
            <Icon name="carbon:folder" class="h-6 w-6 text-primary-600" />
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Projects</dt>
              <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ stats.projects }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-success-100 rounded-md p-3">
            <Icon name="carbon:script" class="h-6 w-6 text-success-600" />
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Test Scripts</dt>
              <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ stats.scripts }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-warning-100 rounded-md p-3">
            <Icon name="carbon:play" class="h-6 w-6 text-warning-600" />
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Executions Today</dt>
              <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ stats.executionsToday }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0 bg-error-100 rounded-md p-3">
            <Icon name="carbon:chart-line" class="h-6 w-6 text-error-600" />
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Success Rate</dt>
              <dd class="text-lg font-medium text-gray-900 dark:text-white">{{ stats.successRate }}%</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Executions Chart -->
    <div class="card mb-8">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Execution Trends</h2>
      <div class="h-64">
        <ExecutionChart :data="chartData" />
      </div>
    </div>

    <!-- Recent Projects and Executions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Recent Projects -->
      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Recent Projects</h2>
          <NuxtLink to="/projects" class="text-primary-600 hover:text-primary-500 dark:text-primary-400 text-sm">
            View all
          </NuxtLink>
        </div>
        <div class="space-y-4">
          <div v-for="project in recentProjects" :key="project.id" class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">{{ project.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ project.description }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <span class="status-badge" :class="getStatusClass(project.status)">
                {{ project.status }}
              </span>
              <NuxtLink :to="`/projects/${project.id}`" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <Icon name="carbon:chevron-right" class="h-5 w-5" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Executions -->
      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Recent Executions</h2>
          <NuxtLink to="/executions" class="text-primary-600 hover:text-primary-500 dark:text-primary-400 text-sm">
            View all
          </NuxtLink>
        </div>
        <div class="space-y-4">
          <div v-for="execution in recentExecutions" :key="execution.id" class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">{{ execution.scriptName }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ formatDate(execution.createdAt) }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <span class="status-badge" :class="getStatusClass(execution.status)">
                {{ execution.status }}
              </span>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ execution.duration }}ms</span>
              <NuxtLink :to="`/executions/${execution.id}`" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <Icon name="carbon:chevron-right" class="h-5 w-5" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { $toast } = useNuxtApp()
const { user } = useAuth()

// Mock data
const stats = ref({
  projects: 12,
  scripts: 48,
  executionsToday: 23,
  successRate: 94
})

const chartData = ref({
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Passed',
      data: [12, 19, 15, 25, 22, 18, 28],
      backgroundColor: 'rgba(34, 197, 94, 0.2)',
      borderColor: 'rgba(34, 197, 94, 1)',
      tension: 0.4
    },
    {
      label: 'Failed',
      data: [3, 5, 2, 4, 3, 2, 3],
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderColor: 'rgba(239, 68, 68, 1)',
      tension: 0.4
    }
  ]
})

const recentProjects = ref([
  { id: 1, name: 'E-commerce Site', description: 'Testing checkout flow', status: 'active' },
  { id: 2, name: 'Admin Dashboard', description: 'User management tests', status: 'active' },
  { id: 3, name: 'Mobile App', description: 'Cross-platform tests', status: 'inactive' },
  { id: 4, name: 'API Integration', description: 'RESTful API tests', status: 'active' }
])

const recentExecutions = ref([
  { id: 1, scriptName: 'Login Flow Test', status: 'passed', duration: 2450, createdAt: new Date() },
  { id: 2, scriptName: 'Search Functionality', status: 'failed', duration: 3200, createdAt: new Date(Date.now() - 3600000) },
  { id: 3, scriptName: 'Cart Operations', status: 'passed', duration: 4100, createdAt: new Date(Date.now() - 7200000) },
  { id: 4, scriptName: 'User Registration', status: 'passed', duration: 3800, createdAt: new Date(Date.now() - 10800000) }
])

const getStatusClass = (status) => {
  const statusClasses = {
    passed: 'status-success',
    failed: 'status-error',
    running: 'status-warning',
    active: 'status-success',
    inactive: 'status-pending'
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

onMounted(async () => {
  try {
    // Fetch actual data from API
    // const response = await $fetch('/api/dashboard/stats')
    // stats.value = response
  } catch (error) {
    $toast.error('Failed to load dashboard data')
  }
})
</script>