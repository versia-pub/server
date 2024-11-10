import taskLists from "@hackmd/markdown-it-task-lists";
import implicitFigures from "markdown-it-image-figures";
import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Versia Server Docs",
    lang: "en-US",
    description: "Documentation for Versia Server APIs",
    markdown: {
        config: (md): void => {
            md.use(implicitFigures, {
                figcaption: "alt",
                copyAttrs: "^class$",
            });

            md.use(taskLists);

            md.use(tabsMarkdownPlugin);
        },
        math: true,
    },
    cleanUrls: true,
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: "Home", link: "/" },
            {
                text: "Versia Protocol",
                link: "https://versia.pub",
                target: "_blank",
            },
        ],

        sidebar: [
            {
                text: "Setup",
                items: [
                    {
                        text: "Installation",
                        link: "/setup/installation",
                    },
                    {
                        text: "Database",
                        link: "/setup/database",
                    },
                ],
            },
            {
                text: "CLI",
                link: "/cli",
            },
            {
                text: "API",
                items: [
                    {
                        text: "Emojis",
                        link: "/api/emojis",
                    },
                    {
                        text: "Roles",
                        link: "/api/roles",
                    },
                    {
                        text: "Challenges",
                        link: "/api/challenges",
                    },
                    {
                        text: "SSO",
                        link: "/api/sso",
                    },
                    {
                        text: "Mastodon Extensions",
                        link: "/api/mastodon",
                    },
                ],
            },
            {
                text: "Frontend",
                items: [
                    {
                        text: "Authentication",
                        link: "/frontend/auth",
                    },
                    {
                        text: "Routes",
                        link: "/frontend/routes",
                    },
                ],
            },
        ],

        socialLinks: [
            { icon: "github", link: "https://github.com/versia-pub/server" },
        ],

        search: {
            provider: "local",
        },

        logo: "https://cdn.versia.pub/branding/icon.svg",
    },
    head: [["link", { rel: "icon", href: "/favicon.png", type: "image/png" }]],
    titleTemplate: ":title • Versia Server Docs",
});
