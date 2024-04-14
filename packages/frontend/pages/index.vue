<template>
    <div class="bg-white">
        <div class="relative isolate px-6 pt-14 lg:px-8">
            <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
                aria-hidden="true">
                <div class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
                    style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
            </div>
            <div class="mx-auto max-w-lg py-32 sm:py-48 lg:py-56">
                <div class="hidden sm:mb-8 sm:flex sm:justify-center">
                    <div
                        class="relative rounded px-3 py-1 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                        You are using <a href="#" class="font-semibold text-indigo-600">Lysand {{ version }}</a>
                    </div>
                </div>
                <div class="text-center">
                    <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">Welcome to Lysand</h1>
                    <p class="mt-6 text-lg leading-8 text-gray-600">You can login to this server by pointing any
                        Mastodon
                        client at <strong class="font-bold">{{ config?.http.base_url }}</strong></p>
                    <div class="mt-10 flex items-center justify-center gap-6 md:flex-row flex-col">
                        <a href="https://github.com/lysand-org/lysand" target="_blank"
                            class="rounded-md w-full bg-indigo-600 ring-indigo-600 ring-2 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Read
                            the docs</a>
                        <a href="https://lysand.org" target="_blank"
                            class="rounded-md w-full ring-indigo-600 ring-2 bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-500 shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">About
                            the Lysand Protocol</a>
                    </div>

                    <p class="mt-6 text-lg leading-8 text-gray-600">Here are some recommended clients:</p>
                    <ul class="w-full flex flex-col gap-3 mt-4">
                        <li v-for="client of recommendedClients" :key="client.name" class="w-full">
                            <a :href="client.link"
                                class="rounded-sm ring-2 ring-black/10 px-4 py-2 w-full flex flex-row gap-3 items-center">
                                <img :src="client.icon" :alt="client.name" class="h-10 w-10" />
                                <div class="flex flex-col justify-between items-start">
                                    <h2 class="font-bold">{{ client.name }}</h2>
                                    <span class="underline text-purple-700">{{ client.link }}</span>
                                </div>
                            </a>
                        </li>
                    </ul>
                    <p class="mt-6 text-lg leading-8 text-gray-600">
                        Many other clients exist, but <strong class="font-bold">they have not been tested for
                            compatibility</strong>. Bug reports are nevertheless welcome.
                    </p>

                    <p class="mt-6 text-lg leading-8 text-gray-600">
                        Found a problem? Report it on <a href="https://github.com/lysand-org/lysand/issues/new/choose"
                            class="underline text-purple-700">the issue tracker</a>.
                    </p>
                </div>
            </div>
            <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
                aria-hidden="true">
                <div class="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
                    style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { recommendedClients } from "../constants";
// @ts-ignore
const version = __VERSION__;
const config = await useConfig();

useServerSeoMeta({
    title: "Welcome to Lysand!",
});
</script>