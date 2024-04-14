<template>
    <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 relative">
        <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            aria-hidden="true">
            <div class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
                style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
        </div>
        <div v-if="instanceInfo.registrations" class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
            <form ref="form" class="space-y-6" method="POST" action="" @submit.prevent="registerUser">
                <div>
                    <h1 class="font-bold text-2xl text-center tracking-tight">Register for an account</h1>
                </div>

                <div>
                    <LoginInput label="Email" id="email" name="email" type="email" autocomplete="email" required />
                </div>

                <div v-if="errors['email']" v-for="error of errors['email']"
                    class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
                    <h3 class="font-bold">An error occured:</h3>
                    <p>{{ error.description }}</p>
                </div>

                <div>
                    <LoginInput label="Username" id="username" name="username" type="text" autocomplete="username"
                        required />
                </div>

                <div v-if="errors['username']" v-for="error of errors['username']"
                    class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
                    <h3 class="font-bold">An error occured:</h3>
                    <p>{{ error.description }}</p>
                </div>

                <div>
                    <LoginInput label="Password" id="password" name="password" type="password" autocomplete="" required
                        :spellcheck="false" :error="!passwordsMatch ? `Passwords dont match` : ``" :value="password1"
                        @input="password1 = $event.target.value" />
                </div>

                <div v-if="errors['password']" v-for="error of errors['password']"
                    class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
                    <h3 class="font-bold">An error occured:</h3>
                    <p>{{ error.description }}</p>
                </div>

                <div>
                    <LoginInput label="Confirm password" id="password2" name="password2" type="password" autocomplete=""
                        required :spellcheck="false" :error="!passwordsMatch ? `Passwords dont match` : ``"
                        :value="password2" @input="password2 = $event.target.value" />
                </div>

                <div>
                    <label for="comment" class="block text-sm font-medium leading-6 text-gray-900">Why do you want to
                        join?</label>
                    <div class="mt-2">
                        <textarea rows="4" required :value="reason" @input="reason = ($event.target as any).value"
                            name="comment" id="comment"
                            class="block w-full rounded-md px-2 border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                    </div>
                </div>

                <div v-if="errors['reason']" v-for="error of errors['reason']"
                    class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
                    <h3 class="font-bold">An error occured:</h3>
                    <p>{{ error.description }}</p>
                </div>

                <div class="">
                    <input type="checkbox" :value="tosAccepted"
                        @input="tosAccepted = Boolean(($event.target as any).value)"
                        class="rounded mr-1 align-middle mb-0.5" /> <span class="text-sm">I agree to the
                        terms and
                        conditions
                        of this
                        server, available <a class="underline font-bold" target="_blank"
                            :href="instanceInfo.tos_url">here</a></span>
                </div>

                <div v-if="errors['agreement']" v-for="error of errors['agreement']"
                    class="rounded bg-purple-100 ring-1 ring-purple-800 py-2 px-4">
                    <h3 class="font-bold">An error occured:</h3>
                    <p>{{ error.description }}</p>
                </div>

                <div>
                    <button type="submit" :disabled="!passwordsMatch || !tosAccepted"
                        class="flex w-full justify-center disabled:opacity-50 disabled:hover:shadow-none rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:shadow-lg duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Sign
                        in</button>
                </div>
            </form>
        </div>
        <div v-else>
            <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center">Registrations are
                disabled
            </h1>
            <p class="mt-6 text-lg leading-8 text-gray-600 text-center">Ask this instance's admin to enable them in
                config!
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { APIInstance } from "../../../../types/entities/instance";
import LoginInput from "../../components/LoginInput.vue";

const config = await useConfig();

if (!config) {
    throw new Error("Config not found");
}

const url = process.client ? config.http.base_url : config.http.url;

const instanceInfo = (await fetch(new URL("/api/v1/instance", url)).then(
    (data) => data.json(),
)) as APIInstance & {
    tos_url: string;
};

const errors = ref<{
    [key: string]: {
        error: string;
        description: string;
    }[];
}>({});

const password1 = ref<string>("");
const password2 = ref<string>("");
const tosAccepted = ref<boolean>(false);
const reason = ref<string>("");

const passwordsMatch = computed(() => password1.value === password2.value);

const registerUser = (e: Event) => {
    e.preventDefault();
    const formData = new FormData();

    const target = e.target as unknown as Record<string, HTMLInputElement>;

    formData.append("email", target.email.value);
    formData.append("password", target.password.value);
    formData.append("username", target.username.value);
    formData.append("reason", reason.value);
    formData.append("locale", "en");
    formData.append("agreement", "true");

    fetch("/api/v1/accounts", {
        method: "POST",
        body: formData,
    })
        .then(async (res) => {
            if (res.status === 422) {
                errors.value = (
                    (await res.json()) as Record<
                        string,
                        {
                            [key: string]: {
                                error: string;
                                description: string;
                            }[];
                        }
                    >
                ).details;
                console.log(errors.value);
            } else {
                // @ts-ignore
                window.location.href = "/register/success";
            }
        })
        .catch(async (err) => {
            console.error(err);
        });
};
</script>