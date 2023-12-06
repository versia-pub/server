<template>
	<div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
		<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
			<form class="space-y-6" method="POST"
				:action="`/auth/login?redirect_uri=${redirect_uri}&response_type=${response_type}&client_id=${client_id}&scope=${scope}`">
				<div>
					<h1 class="font-bold text-2xl text-center tracking-tight">Login to your account</h1>
				</div>

				<div v-if="error && error !== 'undefined'" class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
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
					<div class="grid grid-cols-1 gap-4 w-full">
						<a v-for="provider of oauthProviders" :key="provider.id"
							:href="`/oauth/authorize-external?issuer=${provider.id}&redirect_uri=${redirect_uri}&response_type=${response_type}&clientId=${client_id}&scope=${scope}`"
							class="flex flex-row rounded ring-1 gap-2 p-2 ring-black/10 hover:shadow duration-200">
							<img :src="provider.icon" :alt="provider.name" class="w-8 h-8" />
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
	</div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import LoginInput from "./components/LoginInput.vue"
import { onMounted, ref } from 'vue';

const query = useRoute().query;

const redirect_uri = query.redirect_uri;
const response_type = query.response_type;
const client_id = query.client_id;
const scope = query.scope;
const error = decodeURIComponent(query.error as string);

const oauthProviders = ref<{
	name: string;
	icon: string;
	id: string
}[] | null>(null);

const getOauthProviders = async () => {
	const response = await fetch('/oauth/providers');
	return await response.json() as any;
}

onMounted(async () => {
	oauthProviders.value = await getOauthProviders();
})
</script>