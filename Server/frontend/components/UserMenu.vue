<template>
  <div class="relative" v-click-outside="closeMenu">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
    >
      <img
        v-if="user?.avatar_url"
        :src="user.avatar_url"
        :alt="user?.username"
        class="h-8 w-8 rounded-full"
      >
      <div v-else class="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
        <span class="text-white font-medium">{{ initials }}</span>
      </div>
      <Icon name="carbon:chevron-down" class="ml-2 h-4 w-4 text-gray-400" />
    </button>

    <!-- Dropdown menu -->
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 focus:outline-none"
      >
        <div class="px-4 py-3">
          <p class="text-sm text-gray-900 dark:text-white">Signed in as</p>
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user?.email }}</p>
        </div>
        <div class="py-1">
          <NuxtLink
            to="/profile"
            class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="closeMenu"
          >
            <Icon name="carbon:user" class="mr-2 h-4 w-4 inline" />
            Your Profile
          </NuxtLink>
          <NuxtLink
            to="/settings"
            class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="closeMenu"
          >
            <Icon name="carbon:settings" class="mr-2 h-4 w-4 inline" />
            Settings
          </NuxtLink>
          <button
            @click="handleLogout"
            class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Icon name="carbon:logout" class="mr-2 h-4 w-4 inline" />
            Sign out
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
const { $toast } = useNuxtApp()
const { user } = useAuth()
const isOpen = ref(false)

const initials = computed(() => {
  if (!user.value?.username) return 'U'
  return user.value.username
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const closeMenu = () => {
  isOpen.value = false
}

const handleLogout = async () => {
  try {
    await $auth.logout()
    $toast.success('Logged out successfully')
    await navigateTo('/login')
  } catch (error) {
    $toast.error('Failed to logout')
  }
  closeMenu()
}
</script>