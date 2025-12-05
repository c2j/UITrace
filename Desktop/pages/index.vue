<template>
  <div class="space-y-6">
    <!-- Welcome Section -->
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to UITrace</h1>
      <p class="text-gray-600">Your comprehensive UI automation testing platform</p>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <UCard @click="navigateTo('/recorder')" class="cursor-pointer hover:shadow-lg transition-shadow">
        <template #header>
          <div class="flex items-center">
            <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:video-camera" class="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 class="font-semibold">Record Test</h3>
              <p class="text-sm text-gray-600">Start recording user interactions</p>
            </div>
          </div>
        </template>
      </UCard>

      <UCard @click="navigateTo('/scripts')" class="cursor-pointer hover:shadow-lg transition-shadow">
        <template #header>
          <div class="flex items-center">
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:code-bracket" class="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 class="font-semibold">Manage Scripts</h3>
              <p class="text-sm text-gray-600">View and edit test scripts</p>
            </div>
          </div>
        </template>
      </UCard>

      <UCard @click="navigateTo('/executions')" class="cursor-pointer hover:shadow-lg transition-shadow">
        <template #header>
          <div class="flex items-center">
            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:play" class="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 class="font-semibold">Run Tests</h3>
              <p class="text-sm text-gray-600">Execute test scripts</p>
            </div>
          </div>
        </template>
      </UCard>

      <UCard @click="navigateTo('/visual')" class="cursor-pointer hover:shadow-lg transition-shadow">
        <template #header>
          <div class="flex items-center">
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:eye" class="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 class="font-semibold">Visual Testing</h3>
              <p class="text-sm text-gray-600">Compare screenshots</p>
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Total Scripts</h3>
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Icon name="heroicons:document-text" class="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </template>
        <div class="text-3xl font-bold text-blue-600">{{ scriptCount }}</div>
        <p class="text-sm text-gray-600 mt-1">Active test scripts</p>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Recent Executions</h3>
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-600" />
            </div>
          </div>
        </template>
        <div class="text-3xl font-bold text-green-600">{{ recentExecutions }}</div>
        <p class="text-sm text-gray-600 mt-1">This week</p>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">Success Rate</h3>
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Icon name="heroicons:chart-bar" class="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </template>
        <div class="text-3xl font-bold text-purple-600">{{ successRate }}%</div>
        <p class="text-sm text-gray-600 mt-1">Last 30 days</p>
      </UCard>
    </div>

    <!-- Recent Scripts -->
    <UCard v-if="recentScripts.length > 0">
      <template #header>
        <h3 class="font-semibold">Recent Scripts</h3>
      </template>
      <div class="space-y-4">
        <div
          v-for="script in recentScripts"
          :key="script.id"
          class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <Icon name="heroicons:code-bracket" class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 class="font-medium">{{ script.name }}</h4>
              <p class="text-sm text-gray-600">{{ script.steps.length }} steps</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <UButton
              size="sm"
              color="green"
              @click="executeScript(script.id)"
            >
              Run
            </UButton>
            <UButton
              size="sm"
              color="gray"
              variant="ghost"
              @click="editScript(script.id)"
            >
              Edit
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup>
import { useScriptsStore } from '~/stores/scripts'

// Page meta
definePageMeta({
  title: 'Dashboard',
  description: 'UITrace Dashboard - Overview of your testing activities'
})

// Store
const scriptsStore = useScriptsStore()

// Computed properties
const scriptCount = computed(() => scriptsStore.scriptCount)
const recentScripts = computed(() => scriptsStore.scripts.slice(0, 5))
const recentExecutions = ref(12) // Placeholder
const successRate = ref(94) // Placeholder

// Functions
const executeScript = async (scriptId: string) => {
  try {
    await scriptsStore.executeScript(scriptId)
    // Show success notification
  } catch (error) {
    console.error('Failed to execute script:', error)
  }
}

const editScript = (scriptId: string) => {
  navigateTo(`/scripts/${scriptId}`)
}

// Load data on mount
onMounted(async () => {
  await scriptsStore.loadScripts()
})
</script>