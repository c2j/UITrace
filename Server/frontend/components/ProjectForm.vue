<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Project Name
      </label>
      <input
        v-model="formData.name"
        type="text"
        required
        class="input"
        placeholder="Enter project name"
      >
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Slug
      </label>
      <input
        v-model="formData.slug"
        type="text"
        required
        class="input"
        placeholder="project-slug"
        pattern="[a-z0-9-]+"
        title="Only lowercase letters, numbers, and hyphens allowed"
      >
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Description
      </label>
      <textarea
        v-model="formData.description"
        rows="4"
        class="input"
        placeholder="Describe your project"
      ></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Data Retention (days)
      </label>
      <select v-model="formData.retentionDays" class="input">
        <option :value="30">30 days</option>
        <option :value="90">90 days</option>
        <option :value="180">180 days</option>
        <option :value="365">1 year</option>
        <option :value="730">2 years</option>
        <option :value="0">Forever</option>
      </select>
    </div>

    <div class="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button type="button" @click="$emit('cancel')" class="btn btn-secondary">
        Cancel
      </button>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        <span v-if="loading">
          <Icon name="carbon:circle-dash" class="h-4 w-4 animate-spin mr-2" />
          Saving...
        </span>
        <span v-else>
          {{ project ? 'Update' : 'Create' }} Project
        </span>
      </button>
    </div>
  </form>
</template>

<script setup>
const props = defineProps({
  project: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['submit', 'cancel'])

const loading = ref(false)
const formData = ref({
  name: '',
  slug: '',
  description: '',
  retentionDays: 365
})

// Initialize form data
if (props.project) {
  formData.value = { ...props.project }
}

// Auto-generate slug from name
watch(() => formData.value.name, (newName) => {
  if (!props.project && newName) {
    formData.value.slug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
})

const handleSubmit = async () => {
  loading.value = true
  try {
    await emit('submit', formData.value)
  } finally {
    loading.value = false
  }
}
</script>