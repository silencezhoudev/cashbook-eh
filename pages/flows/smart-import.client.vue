<template>
  <div class="min-h-full bg-gray-100 dark:bg-gray-950 py-4 px-2 sm:px-3 lg:px-4">
    <FlowSmartImportDialog
      variant="page"
      @success-callback="handleSuccess"
      @close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import FlowSmartImportDialog from "@/components/dialog/FlowSmartImportDialog.vue";

definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

const handleClose = () => {
  navigateTo("/flows");
};

const handleSuccess = () => {
  handleClose();
};
</script>

