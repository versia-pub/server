<script setup>
// Import Tailwind style reset
import '@unocss/reset/tailwind-compat.css'
</script>

<template>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>