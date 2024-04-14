<template>
    <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 relative">
        <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            aria-hidden="true">
            <div class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
                style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
        </div>
        <div id="code" v-html="code">
        </div>
    </div>
</template>

<script setup lang="ts">
import { getHighlighterCore } from "shiki/core";
import getWasm from "shiki/wasm";
import { useRoute } from "vue-router";

const config = await useConfig();

if (!config) {
    throw new Error("Config not found");
}

const route = useRoute();

const url = process.client ? config.http.base_url : config.http.url;

const username = (route.params.username as string).replace("@", "");

const id = await fetch(new URL(`/api/v1/accounts/search?q=${username}`, url), {
    headers: {
        Accept: "application/json",
    },
})
    .then((res) => res.json())
    .catch(() => null);

let data = null;

if (id && id.length > 0) {
    data = await fetch(new URL(`/api/v1/accounts/${id[0].id}`, url), {
        headers: {
            Accept: "application/json",
        },
    })
        .then((res) => res.json())
        .catch(() => ({
            error: "Failed to fetch user (it probably doesn't exist)",
        }));
}

const highlighter = await getHighlighterCore({
    themes: [import("shiki/themes/rose-pine.mjs")],
    langs: [import("shiki/langs/json.mjs")],
    loadWasm: getWasm,
});

const code = highlighter.codeToHtml(JSON.stringify(data, null, 4), {
    lang: "json",
    theme: "rose-pine",
});
</script>

<style lang="postcss">
pre:has(code) {
    word-wrap: normal;
    background: transparent;
    -webkit-hyphens: none;
    hyphens: none;
    -moz-tab-size: 4;
    -o-tab-size: 4;
    tab-size: 4;
    white-space: pre;
    word-break: normal;
    word-spacing: normal;
    overflow-x: auto;
    @apply ring-1 ring-white/10 mt-4 bg-white/5 px-4 py-3 rounded;
}

pre code {
    @apply block p-0;
}
</style>