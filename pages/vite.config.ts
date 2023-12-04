import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
	base: "/",
	build: {
		outDir: "../vite-dist",
	},
	// main.ts is in pages/ directory
	resolve: {
		alias: {
			vue: "vue/dist/vue.esm-bundler",
		},
	},
	server: {
		hmr: {
			clientPort: 5173,
		},
	},
	ssr: {
		noExternal: ["@prisma/client"],
	},
	plugins: [
		UnoCSS({
			mode: "vue-scoped",
		}),
		vue(),
	],
});
