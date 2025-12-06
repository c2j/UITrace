export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ request, options }) {
      // Add auth header
      const token = useCookie('auth.token').value
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        // Token expired or invalid
        useCookie('auth.token').value = null
        useCookie('auth.refreshToken').value = null
        nuxtApp.$router.push('/login')
      }
    }
  })

  return {
    provide: {
      api
    }
  }
})