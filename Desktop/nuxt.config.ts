export default defineNuxtConfig({
	modules: [
		"@vueuse/nuxt",
		// "@nuxt/ui", // 暂时禁用，因为需要 Nuxt 4+
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
	devtools: {
		enabled: false // 禁用开发工具以减少文件监视
	},
	typescript: {
		// 暂时禁用类型检查以避免配置文件错误
		typeCheck: false,
		strict: false
	},
	vite: {
		server: {
			hmr: {
				port: 3001
			}
		},
		watch: {
			ignored: ['**/target/**', '**/.git/**', '**/.nuxt/**']
		}
	},
	compatibilityDate: "2025-11-30"
});