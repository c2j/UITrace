<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="showMobileSidebar"
      class="fixed inset-0 z-40 lg:hidden"
      @click="showMobileSidebar = false"
    >
      <div class="absolute inset-0 bg-gray-600 opacity-75"></div>
    </div>

    <!-- Sidebar -->
    <div
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <div class="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
        <NuxtLink to="/" class="flex items-center">
          <Icon name="carbon:bug" class="h-8 w-8 text-primary-600" />
          <span class="ml-2 text-xl font-bold text-gray-900 dark:text-white">UITrace</span>
        </NuxtLink>
        <button
          @click="showMobileSidebar = false"
          class="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon name="carbon:close" class="h-6 w-6" />
        </button>
      </div>

      <nav class="mt-6 px-3">
        <div class="space-y-1">
          <NuxtLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.to"
            class="group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
            :class="[
              $route.path === item.to
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            ]"
          >
            <Icon :name="item.icon" class="mr-3 h-5 w-5" />
            {{ item.name }}
          </NuxtLink>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 class="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div class="mt-3 space-y-1">
            <button
              @click="$router.push('/projects?create=true')"
              class="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Icon name="carbon:add-alt" class="mr-3 h-5 w-5" />
              New Project
            </button>
            <button
              @click="$router.push('/scripts?create=true')"
              class="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Icon name="carbon:document-add" class="mr-3 h-5 w-5" />
              New Script
            </button>
            <button
              @click="$router.push('/executions?run=true')"
              class="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Icon name="carbon:play" class="mr-3 h-5 w-5" />
              Run Script
            </button>
          </div>
        </div>
      </nav>
    </div>

    <!-- Main content -->
    <div class="lg:pl-64">
      <!-- Top bar -->
      <div class="sticky top-0 z-30 flex h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          @click="showMobileSidebar = true"
          class="lg:hidden px-4 text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon name="carbon:menu" class="h-6 w-6" />
        </button>

        <div class="flex-1 flex justify-between items-center px-4 lg:px-8">
          <!-- Breadcrumb -->
          <div class="hidden lg:flex lg:items-center">
            <nav class="flex" aria-label="Breadcrumb">
              <ol class="inline-flex items-center space-x-1 md:space-x-3">
                <li class="inline-flex items-center">
                  <NuxtLink
                    to="/"
                    class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    <Icon name="carbon:home" class="mr-2 h-4 w-4" />
                    Home
                  </NuxtLink>
                </li>
                <li v-for="(crumb, index) in breadcrumbs" :key="index">
                  <div class="flex items-center">
                    <Icon name="carbon:chevron-right" class="w-6 h-6 text-gray-400" />
                    <NuxtLink
                      :to="crumb.to"
                      class="ml-1 text-sm font-medium text-gray-700 hover:text-gray-900 md:ml-2 dark:text-gray-400 dark:hover:text-white"
                    >
                      {{ crumb.name }}
                    </NuxtLink>
                  </div>
                </li>
              </ol>
            </nav>
          </div>

          <!-- Right side buttons -->
          <div class="flex items-center space-x-4">
            <!-- Notifications -->
            <button class="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Icon name="carbon:notification" class="h-5 w-5" />
              <span class="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>

            <!-- Theme toggle -->
            <button
              @click="toggleColorMode"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Icon v-if="$colorMode.value === 'dark'" name="carbon:sun" class="h-5 w-5" />
              <Icon v-else name="carbon:moon" class="h-5 w-5" />
            </button>

            <!-- User menu -->
            <UserMenu />
          </div>
        </div>
      </div>

      <!-- Page content -->
      <main class="p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
const showMobileSidebar = ref(false)
const { $colorMode } = useNuxtApp()
const colorMode = useColorMode()

const navigation = [
  { name: 'Dashboard', to: '/', icon: 'carbon:dashboard' },
  { name: 'Projects', to: '/projects', icon: 'carbon:folder' },
  { name: 'Scripts', to: '/scripts', icon: 'carbon:script' },
  { name: 'Executions', to: '/executions', icon: 'carbon:chart-line-smooth' },
  { name: 'Reports', to: '/reports', icon: 'carbon:report' },
  { name: 'Settings', to: '/settings', icon: 'carbon:settings' }
]

const breadcrumbs = computed(() => {
  const path = useRoute().path
  const parts = path.split('/').filter(Boolean)
  const crumbs = []

  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    const name = part.charAt(0).toUpperCase() + part.slice(1)
    crumbs.push({ name, to: currentPath })
  }

  return crumbs
})

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Close mobile sidebar when route changes
watch(() => useRoute().path, () => {
  showMobileSidebar.value = false
})
</script>