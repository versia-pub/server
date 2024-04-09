<template>
	<div class="flex min-h-screen relative flex-col justify-center px-6 py-12 lg:px-8">
		<div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
			aria-hidden="true">
			<div class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
				style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
		</div>
		<div v-if="validUrlParameters" class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" method="POST"
				:action="`/api/auth/login?redirect_uri=${redirect_uri}&response_type=${response_type}&client_id=${client_id}&scope=${scope}`">
				<div>
					<h1 class="font-bold text-2xl text-center tracking-tight">Login to your account</h1>
				</div>

				<div v-if="error && error !== 'undefined'"
					class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
					<h3 class="font-bold">An error occured:</h3>
					<p>{{ error }}</p>
				</div>

				<div>
					<LoginInput label="Email" id="email" name="email" type="email" autocomplete="email" required />
				</div>

				<div>
					<LoginInput label="Password" id="password" name="password" type="password"
						autocomplete="current-password" required />
				</div>

				<div v-if="oauthProviders && oauthProviders.length > 0" class="w-full flex flex-col gap-3">
					<h2 class="text-sm text-gray-700">Or sign in with</h2>
					<div class="grid grid-cols-2 gap-4 w-full">
						<a v-for="provider of oauthProviders" :key="provider.id"
							:href="`/oauth/authorize-external?issuer=${provider.id}&redirect_uri=${redirect_uri}&response_type=${response_type}&clientId=${client_id}&scope=${scope}`"
							class="flex flex-row justify-center rounded ring-1 gap-2 p-2 ring-black/10 hover:shadow duration-200">
							<img :src="provider.icon" :alt="provider.name" class="w-6 h-6" />
							<div class="flex flex-col gap-0 justify-center">
								<h3 class="font-bold">{{ provider.name }}</h3>
							</div>
						</a>
					</div>
				</div>

				<div>
					<button type="submit"
						class="flex w-full justify-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:shadow-lg duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Sign
						in</button>
				</div>
			</form>
		</div>
		<div v-else class="mx-auto max-w-md">
			<h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">Invalid access
				parameters
			</h1>
			<p class="mt-6 text-lg leading-8 text-gray-600">This page should be accessed 
				through a valid OAuth2 authorization request. Please use a <strong class="font-bold">Mastodon API</strong> client to access this page.
			</p>
			<p class="mt-6 text-lg leading-8 text-gray-600">Here are some recommended clients:</p>
			<ul class="w-full flex flex-col gap-3 mt-4">
				<li v-for="client of recommendedClients" :key="client.name" class="w-full">
					<a :href="client.link" class="rounded-sm ring-2 ring-black/10 px-4 py-2 w-full flex flex-row gap-3 items-center">
						<img :src="client.icon" :alt="client.name" class="h-10 w-10" />
						<div class="flex flex-col justify-between items-start">
							<h2 class="font-bold">{{ client.name }}</h2>
                        	<span class="underline text-purple-700">{{ client.link }}</span>
						</div>
					</a>
				</li>
			</ul>
			<p class="mt-6 text-lg leading-8 text-gray-600">
				Many other clients exist, but <strong class="font-bold">they have not been tested for compatibility</strong>. Bug reports are nevertheless welcome.
			</p>

			<p class="mt-6 text-lg leading-8 text-gray-600">
				Found a problem? Report it on <a href="https://github.com/lysand-org/lysand/issues/new/choose" class="underline text-purple-700">the issue tracker</a>.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import LoginInput from "../../components/LoginInput.vue";
import { recommendedClients } from "../../constants";

const query = useRoute().query;

const redirect_uri = query.redirect_uri;
const response_type = query.response_type;
const client_id = query.client_id;
const scope = query.scope;
const error = decodeURIComponent(query.error as string);

const validUrlParameters = redirect_uri && response_type && client_id && scope;

const oauthProviders = ref<
    | {
          name: string;
          icon: string;
          id: string;
      }[]
    | null
>(null);

const getOauthProviders = async () => {
    const response = await fetch("/oauth/providers");
    return await response.json();
};

onMounted(async () => {
    oauthProviders.value = await getOauthProviders();
});
</script>