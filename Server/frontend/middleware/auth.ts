export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useAuth()

  // Allow access to login page without authentication
  if (to.path === '/login') {
    if (isLoggedIn.value) {
      return navigateTo('/')
    }
    return
  }

  // Protect all other routes
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})