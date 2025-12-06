<template>
  <div class="card hover:shadow-lg transition-shadow duration-200">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center">
        <div :class="['p-3 rounded-md', getStatusBgColor(project.status)]">
          <Icon name="carbon:folder" :class="['h-6 w-6', getStatusTextColor(project.status)]" />
        </div>
        <div class="ml-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ project.name }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ project.team }}</p>
        </div>
      </div>
      <div class="flex space-x-1">
        <button
          @click="$emit('edit', project)"
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon name="carbon:edit" class="h-4 w-4" />
        </button>
        <button
          @click="$emit('delete', project)"
          class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <Icon name="carbon:trash-can" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
      {{ project.description }}
    </p>

    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center space-x-4">
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="carbon:script" class="h-4 w-4 mr-1" />
          {{ project.scriptCount }} scripts
        </div>
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="carbon:data-vis-1" class="h-4 w-4 mr-1" />
          {{ project.retentionDays }} days
        </div>
      </div>
      <span class="status-badge" :class="getStatusClass(project.status)">
        {{ project.status }}
      </span>
    </div>

    <div v-if="project.lastExecution" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500 dark:text-gray-400">Last execution</span>
        <span class="text-gray-900 dark:text-white">{{ formatDate(project.lastExecution) }}</span>
      </div>
    </div>

    <div class="mt-6 flex space-x-3">
      <NuxtLink :to="`/projects/${project.id}`" class="btn btn-secondary flex-1 text-center">
        View Details
      </NuxtLink>
      <NuxtLink :to="`/projects/${project.id}/scripts`" class="btn btn-primary flex-1 text-center">
        Manage Scripts
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
defineProps({
  project: {
    type: Object,
    required: true
  }
})

defineEmits(['edit', 'delete'])

const getStatusClass = (status) => {
  const statusClasses = {
    active: 'status-success',
    inactive: 'status-pending',
    archived: 'status-warning'
  }
  return statusClasses[status] || 'status-pending'
}

const getStatusBgColor = (status) => {
  const colors = {
    active: 'bg-success-100 dark:bg-success-900',
    inactive: 'bg-gray-100 dark:bg-gray-700',
    archived: 'bg-warning-100 dark:bg-warning-900'
  }
  return colors[status] || 'bg-gray-100 dark:bg-gray-700'
}

const getStatusTextColor = (status) => {
  const colors = {
    active: 'text-success-600 dark:text-success-400',
    inactive: 'text-gray-600 dark:text-gray-400',
    archived: 'text-warning-600 dark:text-warning-400'
  }
  return colors[status] || 'text-gray-600 dark:text-gray-400'
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
</script>