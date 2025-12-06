<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Sign in to UITrace
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Or
          <NuxtLink to="/register" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
            create a new account
          </NuxtLink>
        </p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="email" class="sr-only">Email address</label>
            <input
              id="email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              class="input rounded-t-md"
              placeholder="Email address"
            >
          </div>
          <div>
            <label for="password" class="sr-only">Password</label>
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="input rounded-b-md"
              placeholder="Password"
            >
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <input
              id="remember-me"
              v-model="rememberMe"
              name="remember-me"
              type="checkbox"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            >
            <label for="remember-me" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Remember me
            </label>
          </div>

          <div class="text-sm">
            <a href="#" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              Forgot your password?
            </a>
          </div>
        </div>

        <div>
          <button type="submit" :disabled="loading" class="btn btn-primary w-full">
            <span v-if="loading">Signing in...</span>
            <span v-else>Sign in</span>
          </button>
        </div>

        <div v-if="error" class="text-red-600 dark:text-red-400 text-sm text-center">
          {{ error }}
        </div>
      </form>

      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">Or continue with</span>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-3 gap-3">
          <button class="btn btn-secondary">
            <Icon name="simple-icons:google" class="h-5 w-5" />
            <span class="sr-only">Sign in with Google</span>
          </button>
          <button class="btn btn-secondary">
            <Icon name="simple-icons:github" class="h-5 w-5" />
            <span class="sr-only">Sign in with GitHub</span>
          </button>
          <button class="btn btn-secondary">
            <Icon name="simple-icons:microsoft" class="h-5 w-5" />
            <span class="sr-only">Sign in with Microsoft</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
  auth: false
})

const email = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const error = ref('')

const { $toast } = useNuxtApp()

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    await $auth.loginWith('local', {
      data: {
        email: email.value,
        password: password.value,
        remember_me: rememberMe.value
      }
    })

    $toast.success('Successfully logged in!')
    await navigateTo('/')
  } catch (err) {
    error.value = err.response?.data?.message || 'Login failed. Please try again.'
    $toast.error(error.value)
  } finally {
    loading.value = false
  }
}
</script>