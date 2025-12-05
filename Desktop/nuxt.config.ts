export default defineNuxtConfig({
	modules: [
		"@vueuse/nuxt",
		"@nuxt/ui",
		"@pinia/nuxt"
	],
	app: {
		head: {
			title: "UITrace - UI Automation Testing Platform",
			titleTemplate: "%s | UITrace",
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1"
		}
	},
	ssr: false,
	vite: {
		server: {
			hmr: {
				port: 3001
			}
		}
	},
	compatibilityDate: "2025-11-30"
});