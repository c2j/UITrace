export const useAuth = () => {
  const { $auth } = useNuxtApp()

  const user = computed(() => {
    return useState('auth.user').value
  })

  const isLoggedIn = computed(() => {
    return !!useCookie('auth.token').value && !!user.value
  })

  const login = async (credentials: { email: string; password: string; remember_me?: boolean }) => {
    try {
      const response = await $auth.loginWith('local', credentials)
      return response
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await $auth.logout()
      await navigateTo('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const initAuth = () => {
    if (process.client) {
      const token = useCookie('auth.token').value
      if (token && !user.value) {
        // Fetch user data with existing token
        $fetch(`${useRuntimeConfig().public.apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).then((response) => {
          useState('auth.user', () => response.user)
        }).catch(() => {
          // Token is invalid, clear it
          useCookie('auth.token').value = null
          useCookie('auth.refreshToken').value = null
        })
      }
    }
  }

  return {
    user,
    isLoggedIn,
    login,
    logout,
    initAuth
  }
}