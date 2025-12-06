export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const auth = {
    async loginWith(strategy: string, data: any) {
      const response = await $fetch(`${config.public.apiBase}/auth/login`, {
        method: 'POST',
        body: {
          strategy,
          ...data
        }
      })

      // Store tokens
      if (response.access_token) {
        useCookie('auth.token', {
          default: () => null,
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 // 1 hour
        }).value = response.access_token

        if (response.refresh_token) {
          useCookie('auth.refreshToken', {
            default: () => null,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
          }).value = response.refresh_token
        }

        // Store user info
        useState('auth.user', () => response.user)
      }

      return response
    },

    async logout() {
      try {
        const refreshToken = useCookie('auth.refreshToken').value
        if (refreshToken) {
          await $fetch(`${config.public.apiBase}/auth/logout`, {
            method: 'POST',
            body: {
              refresh_token: refreshToken
            }
          })
        }
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        // Clear tokens and user state
        useCookie('auth.token').value = null
        useCookie('auth.refreshToken').value = null
        useState('auth.user', () => null)
      }
    },

    async refreshTokens() {
      const refreshToken = useCookie('auth.refreshToken').value
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await $fetch(`${config.public.apiBase}/auth/refresh`, {
        method: 'POST',
        body: {
          refresh_token: refreshToken
        }
      })

      if (response.access_token) {
        useCookie('auth.token').value = response.access_token
      }

      return response
    },

    getUser() {
      return useState('auth.user')
    },

    isLoggedIn() {
      return !!useCookie('auth.token').value
    },

    initAuth() {
      const token = useCookie('auth.token').value
      if (token) {
        // Validate token and fetch user if needed
        // This would typically involve a request to validate the token
        return true
      }
      return false
    }
  }

  nuxtApp.provide('auth', auth)

  // Auto-refresh token
  let refreshTimer: NodeJS.Timeout | null = null

  const setupTokenRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
    }

    refreshTimer = setInterval(async () => {
      const token = useCookie('auth.token').value
      if (token && auth.isLoggedIn()) {
        try {
          await auth.refreshTokens()
        } catch (error) {
          console.error('Token refresh failed:', error)
          await auth.logout()
          navigateTo('/login')
        }
      }
    }, 50 * 60 * 1000) // Refresh every 50 minutes
  }

  // Setup on client
  if (process.client) {
    setupTokenRefresh()
  }

  // Clean up on app unmount
  onUnmounted(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
    }
  })
})