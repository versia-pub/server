<template>
    <div class="flex items-center justify-between">
        <label for="password" class="block text-sm font-medium leading-6 text-gray-900">{{ label }}</label>
    </div>
    <div class="mt-2">
        <input v-bind="$attrs" @input="checkValid" :class="['block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6',
            (isInvalid || error) && 'invalid:!ring-red-600 invalid:ring-2']">
        <span v-if="isInvalid || error" class="mt-1 text-xs text-red-600">{{ error ? error : `${label} is invalid` }}</span>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
    label: string;
    error?: string;
}>();

const isInvalid = ref(false);

const checkValid = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.checkValidity()) {
        isInvalid.value = false;
    } else {
        isInvalid.value = true;
    }
};
</script>