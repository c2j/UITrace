<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Test Executions</h1>
      <p class="text-gray-600">Execute recorded test scripts with fault-tolerant execution</p>
    </div>

    <!-- Script Selection -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Select Script</h2>
      <div class="flex gap-4">
        <button
          @click="loadSampleScript"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Load Sample Script
        </button>
        <button
          @click="loadFromScriptEditor"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Load from Script Editor
        </button>
      </div>
      <div v-if="selectedScript" class="mt-4 p-4 bg-green-50 rounded-lg">
        <p class="text-green-800">✓ Script loaded: {{ selectedScript.name }}</p>
      </div>
    </div>

    <!-- Execution Monitor -->
    <ExecutionMonitor
      v-if="selectedScript"
      :script="selectedScript"
    />

    <!-- No Script Message -->
    <div v-else class="bg-white rounded-lg shadow p-6 text-center">
      <Icon name="heroicons:play-circle" class="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Script Selected</h3>
      <p class="text-gray-600">Please load a test script to begin execution.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ExecutionMonitor from '~/src-ui/components/ExecutionMonitor.vue'

// State
const selectedScript = ref(null)

// Methods
const loadSampleScript = async () => {
  try {
    const script = await import('~/tests/sample-login-journey.json')
    selectedScript.value = script.default
  } catch (error) {
    console.error('Failed to load sample script:', error)
  }
}

const loadFromScriptEditor = () => {
  // This would typically get the current script from the ScriptEditor component
  // For now, we'll load the sample script
  loadSampleScript()
}
</script>

<script>
// Page meta
definePageMeta({
  title: 'Test Executions',
  description: 'Execute recorded test scripts with fault-tolerant execution'
})
</script>
