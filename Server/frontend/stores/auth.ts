export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    token: null as string | null,
    refreshToken: null as string | null,
    loading: false,
    error: null as string | null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    userRole: (state) => state.user?.role || 'viewer'
  },

  actions: {
    async login(credentials: { email: string; password: string }) {
      this.loading = true
      this.error = null

      try {
        const { $auth } = useNuxtApp()
        const response = await $auth.loginWith('local', credentials)

        this.token = response.access_token
        this.refreshToken = response.refresh_token
        this.user = response.user

        // Persist in cookies
        const authToken = useCookie('auth.token')
        const authRefreshToken = useCookie('auth.refreshToken')

        authToken.value = response.access_token
        authRefreshToken.value = response.refresh_token

        return response
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Login failed'
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        const { $auth } = useNuxtApp()
        await $auth.logout()
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.user = null
        this.token = null
        this.refreshToken = null

        // Clear cookies
        const authToken = useCookie('auth.token')
        const authRefreshToken = useCookie('auth.refreshToken')

        authToken.value = null
        authRefreshToken.value = null

        await navigateTo('/login')
      }
    },

    async refreshTokens() {
      if (!this.refreshToken) {
        throw new Error('No refresh token')
      }

      try {
        const response = await $fetch('/auth/refresh', {
          baseURL: useRuntimeConfig().public.apiBase,
          method: 'POST',
          body: {
            refresh_token: this.refreshToken
          }
        })

        this.token = response.access_token
        useCookie('auth.token').value = response.access_token

        return response
      } catch (error) {
        await this.logout()
        throw error
      }
    },

    async fetchUser() {
      if (!this.token) return

      try {
        const response = await $fetch('/auth/me', {
          baseURL: useRuntimeConfig().public.apiBase,
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        })

        this.user = response.user
      } catch (error) {
        await this.logout()
      }
    },

    initAuth() {
      const token = useCookie('auth.token').value
      const refreshToken = useCookie('auth.refreshToken').value

      if (token) {
        this.token = token
        this.refreshToken = refreshToken
        this.fetchUser()
      }
    }
  }
})