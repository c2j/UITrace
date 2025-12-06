<template>
  <div>
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Manage your test automation projects</p>
      </div>
      <button @click="showCreateModal = true" class="btn btn-primary">
        <Icon name="carbon:add" class="h-5 w-5 mr-2" />
        New Project
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search projects..."
            class="input"
          >
        </div>
        <select v-model="statusFilter" class="input w-[180px]">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select v-model="sortBy" class="input w-[180px]">
          <option value="name">Sort by Name</option>
          <option value="created_at">Sort by Created</option>
          <option value="updated_at">Sort by Updated</option>
        </select>
      </div>
    </div>

    <!-- Projects Grid -->
    <div v-if="loading" class="text-center py-12">
      <Icon name="carbon:circle-dash" class="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
      <p class="text-gray-600 dark:text-gray-400">Loading projects...</p>
    </div>

    <div v-else-if="filteredProjects.length === 0" class="text-center py-12">
      <Icon name="carbon:folder-off" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p class="text-gray-600 dark:text-gray-400">No projects found</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
        @edit="handleEditProject"
        @delete="handleDeleteProject"
      />
    </div>

    <!-- Create/Edit Modal -->
    <Modal v-model="showCreateModal" title="Create New Project">
      <ProjectForm
        :project="editingProject"
        @submit="handleSubmitProject"
        @cancel="closeModal"
      />
    </Modal>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model="showDeleteModal"
      title="Delete Project"
      message="Are you sure you want to delete this project? This action cannot be undone."
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup>
const { $toast } = useNuxtApp()
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const sortBy = ref('name')
const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const editingProject = ref(null)
const projectToDelete = ref(null)

// Mock data
const projects = ref([
  {
    id: 1,
    name: 'E-commerce Platform',
    slug: 'ecommerce',
    description: 'End-to-end testing for online shopping platform',
    status: 'active',
    team: 'QA Team',
    scriptCount: 24,
    lastExecution: new Date(Date.now() - 86400000),
    createdAt: new Date(Date.now() - 2592000000),
    retentionDays: 365
  },
  {
    id: 2,
    name: 'Admin Dashboard',
    slug: 'admin-dashboard',
    description: 'Administrative interface testing',
    status: 'active',
    team: 'QA Team',
    scriptCount: 18,
    lastExecution: new Date(Date.now() - 3600000),
    createdAt: new Date(Date.now() - 5184000000),
    retentionDays: 180
  },
  {
    id: 3,
    name: 'Mobile App Web View',
    slug: 'mobile-webview',
    description: 'Mobile application web component testing',
    status: 'inactive',
    team: 'Mobile Team',
    scriptCount: 12,
    lastExecution: new Date(Date.now() - 604800000),
    createdAt: new Date(Date.now() - 7776000000),
    retentionDays: 90
  }
])

const filteredProjects = computed(() => {
  let result = projects.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    )
  }

  // Apply status filter
  if (statusFilter.value) {
    result = result.filter(p => p.status === statusFilter.value)
  }

  // Apply sorting
  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'created_at':
        return b.createdAt - a.createdAt
      case 'updated_at':
        return b.lastExecution - a.lastExecution
      default:
        return 0
    }
  })

  return result
})

const handleEditProject = (project) => {
  editingProject.value = { ...project }
  showCreateModal.value = true
}

const handleDeleteProject = (project) => {
  projectToDelete.value = project
  showDeleteModal.value = true
}

const handleSubmitProject = async (projectData) => {
  try {
    if (editingProject.value) {
      // Update existing project
      const index = projects.value.findIndex(p => p.id === editingProject.value.id)
      if (index !== -1) {
        projects.value[index] = { ...projects.value[index], ...projectData }
      }
      $toast.success('Project updated successfully')
    } else {
      // Create new project
      const newProject = {
        id: Date.now(),
        ...projectData,
        scriptCount: 0,
        status: 'active',
        createdAt: new Date(),
        lastExecution: null
      }
      projects.value.unshift(newProject)
      $toast.success('Project created successfully')
    }
    closeModal()
  } catch (error) {
    $toast.error('Failed to save project')
  }
}

const confirmDelete = async () => {
  try {
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value.id)
    $toast.success('Project deleted successfully')
    showDeleteModal.value = false
    projectToDelete.value = null
  } catch (error) {
    $toast.error('Failed to delete project')
  }
}

const closeModal = () => {
  showCreateModal.value = false
  editingProject.value = null
}

onMounted(async () => {
  loading.value = true
  try {
    // Fetch actual projects from API
    // const response = await $fetch('/api/projects')
    // projects.value = response
  } catch (error) {
    $toast.error('Failed to load projects')
  } finally {
    loading.value = false
  }
})
</script>