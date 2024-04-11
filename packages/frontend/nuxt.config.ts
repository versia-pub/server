// import { loadConfig } from "c12";
import pkg from "../../package.json";
// import { defaultConfig } from "config-manager/config.type";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    modules: ["@nuxtjs/seo", "@nuxtjs/tailwindcss", "@vueuse/nuxt"],
    app: {
        head: {
            link: [
                {
                    rel: "icon",
                    href: "/favicon.png",
                    type: "image/png",
                },
            ],
            htmlAttrs: { lang: "en-us" },
        },
    },
    nitro: {
        compressPublicAssets: {
            gzip: false,
            brotli: false,
        },
        preset: "bun",
        minify: true,
        prerender: {
            failOnError: true,
        },
    },
    devServer: {
        port: 5173,
    },
    schemaOrg: {
        enabled: false,
    },
    ogImage: {
        enabled: false,
    },
    vite: {
        define: {
            __VERSION__: JSON.stringify(pkg.version),
        },
        server: {
            hmr: {
                clientPort: 5173,
            },
        },
    },
    runtimeConfig: {
        public: {
            language: "en-US",
            titleSeparator: "·",
            siteName: "Lysand",
            trailingSlash: true,
        },
    },
    site: {
        url: "https://social.lysand.org",
    },
});
