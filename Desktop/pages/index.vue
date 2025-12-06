<template>
  <div class="space-y-6">
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to UITrace</h1>
      <p class="text-gray-600">UI Automation Testing Platform</p>
      <div class="mt-4 p-4 bg-green-50 rounded-lg">
        <p class="text-green-800"><Icon name="heroicons:check-circle" class="w-5 h-5 inline mr-2" />
        UITrace platform is successfully running! Development environment is active.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Page meta
definePageMeta({
  title: 'Dashboard',
  description: 'UITrace platform dashboard'
})
</script>