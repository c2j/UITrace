import { vClickOutside } from '~/utils/directives'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('click-outside', vClickOutside)
})