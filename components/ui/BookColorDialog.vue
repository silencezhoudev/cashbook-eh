<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click="$emit('close')"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
      @click.stop
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          选择颜色
        </h3>
        <button
          @click="$emit('close')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <XMarkIcon class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          账本：{{ book?.bookName }}
        </p>
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full border-2 border-gray-300"
            :style="{ backgroundColor: selectedColor }"
          ></div>
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400">
            {{ selectedColor }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-3 mb-6">
        <button
          v-for="color in colors"
          :key="color"
          @click="selectColor(color)"
          class="w-12 h-12 rounded-lg border-2 transition-all hover:scale-110"
          :class="{
            'border-blue-500 ring-2 ring-blue-200': selectedColor === color,
            'border-gray-300 hover:border-gray-400': selectedColor !== color
          }"
          :style="{ backgroundColor: color }"
          :title="color"
        ></button>
      </div>

      <div class="flex gap-3">
        <button
          @click="$emit('close')"
          class="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          取消
        </button>
        <button
          @click="confirmColor"
          class="flex-1 px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import type { Book } from "~/utils/model";

interface Props {
  book: Book | null;
  colors: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
  'color-selected': [bookId: string, color: string];
}>();

const selectedColor = ref(props.book?.color || '#3B82F6');

const selectColor = (color: string) => {
  selectedColor.value = color;
};

const confirmColor = () => {
  if (props.book) {
    emit('color-selected', props.book.bookId, selectedColor.value);
  }
};
</script>
