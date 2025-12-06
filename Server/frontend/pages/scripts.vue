<template>
  <div>
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Test Scripts</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Manage and edit your automation scripts</p>
      </div>
      <button @click="showCreateModal = true" class="btn btn-primary">
        <Icon name="carbon:add" class="h-5 w-5 mr-2" />
        New Script
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search scripts..."
            class="input"
          >
        </div>
        <select v-model="projectFilter" class="input w-[200px]">
          <option value="">All Projects</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
        <select v-model="statusFilter" class="input w-[180px]">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>

    <!-- Scripts Table -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Script Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Project
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Execution
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Success Rate
              </th>
              <th class="relative px-6 py-3">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="script in filteredScripts" :key="script.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ script.name }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      v{{ script.version }} • {{ formatDate(script.updatedAt) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 dark:text-white">{{ script.projectName }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge" :class="getStatusClass(script.status)">
                  {{ script.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ script.lastExecution ? formatDate(script.lastExecution) : 'Never' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="text-sm text-gray-900 dark:text-white">
                    {{ script.successRate }}%
                  </div>
                  <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                    <div
                      class="h-2 rounded-full"
                      :class="getSuccessRateColor(script.successRate)"
                      :style="{ width: `${script.successRate}%` }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button @click="viewScript(script)" class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-3">
                  View
                </button>
                <button @click="editScript(script)" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 mr-3">
                  Edit
                </button>
                <button @click="executeScript(script)" class="text-success-600 hover:text-success-900 dark:text-success-400 dark:hover:text-success-300 mr-3">
                  Run
                </button>
                <button @click="deleteScript(script)" class="text-error-600 hover:text-error-900 dark:text-error-400 dark:hover:text-error-300">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Script Editor Modal -->
    <Modal v-model="showEditorModal" :title="editingScript ? `Edit Script: ${editingScript.name}` : 'Create New Script'" size="large">
      <ScriptEditor
        :script="editingScript"
        @save="handleSaveScript"
        @cancel="closeEditor"
      />
    </Modal>

    <!-- Script Viewer Modal -->
    <Modal v-model="showViewerModal" :title="viewingScript?.name" size="large">
      <ScriptViewer
        :script="viewingScript"
        @edit="editFromViewer"
        @execute="executeFromViewer"
        @close="showViewerModal = false"
      />
    </Modal>

    <!-- Execute Script Modal -->
    <Modal v-model="showExecuteModal" :title="`Execute: ${executingScript?.name}`">
      <ScriptExecutor
        :script="executingScript"
        @start="handleStartExecution"
        @cancel="showExecuteModal = false"
      />
    </Modal>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="showDeleteModal"
      title="Delete Script"
      message="Are you sure you want to delete this script? This action cannot be undone."
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup>
const { $toast } = useNuxtApp()
const searchQuery = ref('')
const projectFilter = ref('')
const statusFilter = ref('')
const showCreateModal = ref(false)
const showEditorModal = ref(false)
const showViewerModal = ref(false)
const showExecuteModal = ref(false)
const showDeleteModal = ref(false)
const editingScript = ref(null)
const viewingScript = ref(null)
const executingScript = ref(null)
const scriptToDelete = ref(null)

// Mock data
const projects = ref([
  { id: 1, name: 'E-commerce Platform' },
  { id: 2, name: 'Admin Dashboard' },
  { id: 3, name: 'Mobile App Web View' }
])

const scripts = ref([
  {
    id: 1,
    name: 'Login Flow Test',
    version: 3,
    projectId: 1,
    projectName: 'E-commerce Platform',
    status: 'ready',
    description: 'Tests user login functionality',
    successRate: 95,
    lastExecution: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 86400000),
    content: {
      steps: [
        { id: 1, type: 'navigate', url: 'https://example.com/login' },
        { id: 2, type: 'type', selector: '#username', value: '${username}' },
        { id: 3, type: 'type', selector: '#password', value: '${password}' },
        { id: 4, type: 'click', selector: '#login-button' }
      ],
      variables: ['username', 'password']
    }
  },
  {
    id: 2,
    name: 'Search Functionality',
    version: 2,
    projectId: 1,
    projectName: 'E-commerce Platform',
    status: 'ready',
    description: 'Tests search feature with various queries',
    successRate: 88,
    lastExecution: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 172800000),
    content: {
      steps: [
        { id: 1, type: 'navigate', url: 'https://example.com' },
        { id: 2, type: 'type', selector: '#search-input', value: '${search_term}' },
        { id: 3, type: 'click', selector: '#search-button' },
        { id: 4, type: 'assert', selector: '.search-results', assertion: 'visible' }
      ],
      variables: ['search_term']
    }
  },
  {
    id: 3,
    name: 'User Registration',
    version: 1,
    projectId: 2,
    projectName: 'Admin Dashboard',
    status: 'draft',
    description: 'Tests user registration process',
    successRate: 0,
    lastExecution: null,
    updatedAt: new Date(Date.now() - 3600000),
    content: {
      steps: [],
      variables: []
    }
  }
])

const filteredScripts = computed(() => {
  let result = scripts.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    )
  }

  if (projectFilter.value) {
    result = result.filter(s => s.projectId === projectFilter.value)
  }

  if (statusFilter.value) {
    result = result.filter(s => s.status === statusFilter.value)
  }

  return result
})

const getStatusClass = (status) => {
  const statusClasses = {
    draft: 'status-warning',
    ready: 'status-success',
    archived: 'status-pending'
  }
  return statusClasses[status] || 'status-pending'
}

const getSuccessRateColor = (rate) => {
  if (rate >= 90) return 'bg-success-500'
  if (rate >= 70) return 'bg-warning-500'
  return 'bg-error-500'
}

const formatDate = (date) => {
  if (!date) return 'Never'
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

const viewScript = (script) => {
  viewingScript.value = script
  showViewerModal.value = true
}

const editScript = (script) => {
  editingScript.value = { ...script }
  showEditorModal.value = true
}

const executeScript = (script) => {
  executingScript.value = script
  showExecuteModal.value = true
}

const editFromViewer = () => {
  editingScript.value = { ...viewingScript.value }
  showViewerModal.value = false
  showEditorModal.value = true
}

const executeFromViewer = () => {
  executingScript.value = viewingScript.value
  showViewerModal.value = false
  showExecuteModal.value = true
}

const deleteScript = (script) => {
  scriptToDelete.value = script
  showDeleteModal.value = true
}

const handleSaveScript = async (scriptData) => {
  try {
    if (editingScript.value) {
      const index = scripts.value.findIndex(s => s.id === editingScript.value.id)
      if (index !== -1) {
        scripts.value[index] = { ...scripts.value[index], ...scriptData }
      }
      $toast.success('Script updated successfully')
    } else {
      const newScript = {
        id: Date.now(),
        ...scriptData,
        version: 1,
        successRate: 0,
        lastExecution: null,
        updatedAt: new Date()
      }
      scripts.value.unshift(newScript)
      $toast.success('Script created successfully')
    }
    closeEditor()
  } catch (error) {
    $toast.error('Failed to save script')
  }
}

const handleStartExecution = (executionConfig) => {
  // Start script execution
  $toast.success(`Started execution for ${executingScript.value.name}`)
  showExecuteModal.value = false
  // Navigate to execution results or show execution status
  navigateTo('/executions')
}

const confirmDelete = () => {
  scripts.value = scripts.value.filter(s => s.id !== scriptToDelete.value.id)
  $toast.success('Script deleted successfully')
  showDeleteModal.value = false
  scriptToDelete.value = null
}

const closeEditor = () => {
  showEditorModal.value = false
  editingScript.value = null
}
</script>