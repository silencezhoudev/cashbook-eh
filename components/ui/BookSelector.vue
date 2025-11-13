<template>
  <div class="book-selector">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        选择账本
      </h3>
      <div class="flex gap-2">
        <button
          @click="selectAll"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          全选
        </button>
        <button
          @click="clearAll"
          class="px-3 py-1 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          清空
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="book in books"
        :key="book.id"
        class="book-item p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all cursor-pointer"
        :class="{
          'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20': selectedBooks.includes(book.bookId),
          'bg-white dark:bg-gray-800': !selectedBooks.includes(book.bookId)
        }"
        @click="toggleBook(book.bookId)"
      >
        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            :checked="selectedBooks.includes(book.bookId)"
            @change="toggleBook(book.bookId)"
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          
          <div
            class="w-6 h-6 rounded-full border-2 border-white shadow-sm"
            :style="{ backgroundColor: book.color }"
          ></div>
          
          <div class="flex-1">
            <h4 class="font-medium text-gray-900 dark:text-gray-100">
              {{ book.bookName }}
            </h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ book.bookId }}
            </p>
          </div>
          
          <button
            @click.stop="showColorPicker(book)"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="更改颜色"
          >
            <SwatchIcon class="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>

    <!-- 颜色选择器弹窗 -->
    <BookColorDialog
      v-if="showColorDialog"
      :book="selectedBook"
      :colors="predefinedColors"
      @close="showColorDialog = false"
      @color-selected="handleColorSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { SwatchIcon } from "@heroicons/vue/24/outline";
import BookColorDialog from "./BookColorDialog.vue";
import { getDefaultBookColors } from "~/server/utils/bookValidation";
import type { Book } from "~/utils/model";

interface Props {
  books: Book[];
  selectedBooks: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update-selection': [bookIds: string[]];
  'color-change': [bookId: string, color: string];
}>();

// 状态管理
const showColorDialog = ref(false);
const selectedBook = ref<Book | null>(null);
const predefinedColors = getDefaultBookColors();

// 方法
const toggleBook = (bookId: string) => {
  const newSelection = props.selectedBooks.includes(bookId)
    ? props.selectedBooks.filter(id => id !== bookId)
    : [...props.selectedBooks, bookId];
  
  emit('update-selection', newSelection);
};

const selectAll = () => {
  const allBookIds = props.books.map(book => book.bookId);
  emit('update-selection', allBookIds);
};

const clearAll = () => {
  emit('update-selection', []);
};

const showColorPicker = (book: Book) => {
  selectedBook.value = book;
  showColorDialog.value = true;
};

const handleColorSelected = (bookId: string, color: string) => {
  emit('color-change', bookId, color);
  showColorDialog.value = false;
};
</script>

<style scoped>
.book-item {
  transition: all 0.2s ease;
}

.book-item:hover {
  transform: translateY(-1px);
}
</style>
