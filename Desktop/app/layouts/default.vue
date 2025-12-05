<template>
  <div class="h-screen flex">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-900 text-white flex flex-col">
      <!-- Logo -->
      <div class="p-6 border-b border-gray-700">
        <h1 class="text-xl font-bold text-blue-400">UITrace</h1>
        <p class="text-sm text-gray-400 mt-1">UI Automation Platform</p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4">
        <ul class="space-y-2">
          <li>
            <NuxtLink
              to="/"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/' }"
            >
              <Icon name="heroicons:home" class="w-5 h-5 mr-3" />
              Dashboard
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/scripts"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/scripts' }"
            >
              <Icon name="heroicons:code-bracket" class="w-5 h-5 mr-3" />
              Scripts
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/recorder"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/recorder' }"
            >
              <Icon name="heroicons:video-camera" class="w-5 h-5 mr-3" />
              Recorder
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/executions"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/executions' }"
            >
              <Icon name="heroicons:play" class="w-5 h-5 mr-3" />
              Executions
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/data"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/data' }"
            >
              <Icon name="heroicons:table-cells" class="w-5 h-5 mr-3" />
              Test Data
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/visual"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/visual' }"
            >
              <Icon name="heroicons:eye" class="w-5 h-5 mr-3" />
              Visual Testing
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/settings"
              class="flex items-center px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              :class="{ 'bg-blue-600': $route.path === '/settings' }"
            >
              <Icon name="heroicons:cog-6-tooth" class="w-5 h-5 mr-3" />
              Settings
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- User Info -->
      <div class="p-4 border-t border-gray-700">
        <div class="flex items-center">
          <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
            <Icon name="heroicons:user" class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ currentUser?.username || 'User' }}</p>
            <p class="text-xs text-gray-400 truncate">{{ currentUser?.role || 'tester' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">{{ pageTitle }}</h2>
            <p class="text-sm text-gray-600">{{ pageDescription }}</p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Global actions can go here -->
            <UButton
              v-if="isRecording"
              color="red"
              variant="solid"
              @click="stopRecording"
            >
              <Icon name="heroicons:stop" class="w-4 h-4 mr-2" />
              Stop Recording
            </UButton>
            <UButton
              v-else
              color="green"
              variant="solid"
              @click="startRecording"
            >
              <Icon name="heroicons:video-camera" class="w-4 h-4 mr-2" />
              Start Recording
            </UButton>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-auto bg-gray-50">
        <div class="p-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth'
import { useScriptsStore } from '~/stores/scripts'

// Get current user from auth store
const authStore = useAuthStore()
const scriptsStore = useScriptsStore()

const currentUser = computed(() => authStore.currentUser)

// Get page title and description from route meta
const route = useRoute()
const pageTitle = computed(() => route.meta.title || 'UITrace')
const pageDescription = computed(() => route.meta.description || 'UI Automation Testing Platform')

// Recording functions
const startRecording = () => {
  scriptsStore.startRecording()
}

const stopRecording = () => {
  scriptsStore.stopRecording()
}

const isRecording = computed(() => scriptsStore.isRecording)
</script>
