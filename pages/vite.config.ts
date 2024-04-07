import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";
import pkg from "../package.json";

export default defineConfig({
    base: "/",
    build: {
        outDir: "./dist",
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
    define: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        __VERSION__: JSON.stringify(pkg.version),
    },
    ssr: {
        noExternal: ["@prisma/client"],
    },
    plugins: [
        UnoCSS({
            mode: "global",
        }),
        vue(),
    ],
});
