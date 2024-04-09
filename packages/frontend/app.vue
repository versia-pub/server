<template>
  <NuxtPage>
    <slot />
  </NuxtPage>
</template>

<script setup lang="ts">
useServerSeoMeta({
    titleTemplate: (titleChunk) => {
        return titleChunk ? `${titleChunk} · Lysand` : "Lysand";
    },
});
</script>