<template></template>

<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});
onMounted(() => {
  navigateTo("/calendar");
});
</script>

<style scoped></style>
