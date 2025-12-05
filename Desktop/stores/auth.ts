import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface User {
  id: string
  username: string
  email: string
  fullName?: string
  role: 'admin' | 'tester' | 'viewer'
  isActive: boolean
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const currentUser = computed(() => user.value)
  const authToken = computed(() => token.value)

  // Actions
  async function login(username: string, password: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      // Call Tauri command to login
      const response = await invoke('login', { username, password })

      if (response.success) {
        token.value = response.data.access_token
        refreshToken.value = response.data.refresh_token
        user.value = response.data.user

        // Store tokens in Tauri store for persistence
        await invoke('store_auth_tokens', {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token
        })

        return true
      } else {
        error.value = response.error || 'Login failed'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true

    try {
      // Call Tauri command to logout
      await invoke('logout')

      // Clear local state
      token.value = null
      refreshToken.value = null
      user.value = null
      error.value = null

      // Clear stored tokens
      await invoke('clear_auth_tokens')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed'
    } finally {
      isLoading.value = false
    }
  }

  async function refreshAuthToken(): Promise<boolean> {
    if (!refreshToken.value) return false

    try {
      const response = await invoke('refresh_token', {
        refreshToken: refreshToken.value
      })

      if (response.success) {
        token.value = response.data.access_token

        // Update stored token
        await invoke('store_auth_tokens', {
          accessToken: response.data.access_token,
          refreshToken: refreshToken.value
        })

        return true
      }

      return false
    } catch (err) {
      console.error('Token refresh failed:', err)
      return false
    }
  }

  async function loadStoredAuth(): Promise<void> {
    try {
      const stored = await invoke('load_auth_tokens')

      if (stored.access_token) {
        token.value = stored.access_token
        refreshToken.value = stored.refresh_token

        // Try to get user info with the token
        const userResponse = await invoke('get_current_user')
        if (userResponse.success) {
          user.value = userResponse.data
        }
      }
    } catch (err) {
      console.error('Failed to load stored auth:', err)
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // State
    token,
    refreshToken,
    user,
    isLoading,
    error,

    // Getters
    isAuthenticated,
    currentUser,
    authToken,

    // Actions
    login,
    logout,
    refreshAuthToken,
    loadStoredAuth,
    clearError
  }
})