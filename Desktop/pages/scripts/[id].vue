<template>
  <div class="h-screen flex flex-col">
    <ScriptEditor
      :script-id="scriptId"
      @save="handleSave"
      @cancel="handleCancel"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
// Route
const route = useRoute()
const router = useRouter()

const scriptId = computed(() => route.params.id as string)

// Handlers
const handleSave = (script: any) => {
  // Navigate back to scripts list
  navigateTo('/scripts')
}

const handleCancel = () => {
  // Navigate back to scripts list
  navigateTo('/scripts')
}

const handleChange = (script: any) => {
  // Handle script changes if needed
  console.log('Script changed:', script)
}

// Page meta
definePageMeta({
  title: 'Edit Script',
  description: 'Edit test script'
})
</script>