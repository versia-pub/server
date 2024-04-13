<script setup lang="ts">
import { EButton, ETailwind } from "vue-email";
import tailwindConfig from "~/tailwind.config";

defineProps<{
    name: string;
}>();
</script>

<template>
    <ETailwind :config="tailwindConfig">
        <EButton href="https://example.com" class="bg-primary px-3 py-2 font-medium leading-4 text-white">
            Click me
        </EButton>
    </ETailwind>
</template>