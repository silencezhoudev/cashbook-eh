<template>
  <div class="relative">
    <!-- 筛选按钮 -->
    <button
      @click="toggleFilter"
      class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      :class="{ 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': isFilterActive }"
    >
      <FunnelIcon class="w-3 h-3" />
      <span v-if="isFilterActive" class="text-xs">({{ activeFilterCount }})</span>
    </button>

    <!-- 筛选面板 -->
    <div
      v-if="showFilter"
      class="absolute top-full left-0 z-50 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
    >
      <div class="p-3">
        <!-- 关键字搜索 -->
        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            关键字搜索
          </label>
          <input
            :value="localKeywordFilter"
            @input="localKeywordFilter = ($event.target as HTMLInputElement).value; onKeywordChange()"
            type="text"
            placeholder="输入关键字..."
            class="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <!-- 复选框列表 -->
        <div class="mb-3">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择值
          </label>
          <div class="max-h-48 overflow-y-auto space-y-1">
            <!-- 全选/全不选 -->
            <div class="flex items-center gap-2 p-1 border-b border-gray-200 dark:border-gray-600">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @change="toggleSelectAll"
                class="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span class="text-xs text-gray-600 dark:text-gray-400">
                {{ isAllSelected ? '全不选' : '全选' }}
              </span>
            </div>

            <!-- 选项列表 -->
            <div
              v-for="option in filteredOptions"
              :key="option.value"
              class="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
            >
              <input
                type="checkbox"
                :checked="selectedValues.includes(option.value)"
                @change="toggleSelection(option.value)"
                class="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span class="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate">
                {{ option.label }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                ({{ option.count }})
              </span>
            </div>

            <!-- 无数据提示 -->
            <div
              v-if="filteredOptions.length === 0"
              class="text-xs text-gray-500 dark:text-gray-400 text-center py-2"
            >
              暂无数据
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <button
            @click="clearFilter"
            class="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            清空
          </button>
          <button
            @click="applyFilter"
            class="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { FunnelIcon } from '@heroicons/vue/24/outline';

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface Props {
  columnKey: string;
  options: FilterOption[];
  selectedValues: string[];
  keywordFilter: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:selectedValues': [values: string[]];
  'update:keywordFilter': [keyword: string];
  'apply': [filter: { selectedValues: string[]; keywordFilter: string }];
}>();

// 本地状态
const showFilter = ref(false);
const localSelectedValues = ref<string[]>([...props.selectedValues]);
const localKeywordFilter = ref(props.keywordFilter);

// 计算属性
const isFilterActive = computed(() => {
  return localSelectedValues.value.length > 0 || localKeywordFilter.value.trim() !== '';
});

const activeFilterCount = computed(() => {
  let count = localSelectedValues.value.length;
  if (localKeywordFilter.value.trim() !== '') count++;
  return count;
});

const filteredOptions = computed(() => {
  let options = props.options;
  
  // 关键字过滤
  if (localKeywordFilter.value.trim() !== '') {
    const keyword = localKeywordFilter.value.toLowerCase();
    options = options.filter(option => 
      option.label.toLowerCase().includes(keyword) ||
      option.value.toLowerCase().includes(keyword)
    );
  }
  
  return options;
});

const isAllSelected = computed(() => {
  return filteredOptions.value.length > 0 && 
         filteredOptions.value.every(option => localSelectedValues.value.includes(option.value));
});

const isIndeterminate = computed(() => {
  const selectedCount = filteredOptions.value.filter(option => 
    localSelectedValues.value.includes(option.value)
  ).length;
  return selectedCount > 0 && selectedCount < filteredOptions.value.length;
});

// 方法
const toggleFilter = () => {
  showFilter.value = !showFilter.value;
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消选择所有过滤后的选项
    filteredOptions.value.forEach(option => {
      const index = localSelectedValues.value.indexOf(option.value);
      if (index > -1) {
        localSelectedValues.value.splice(index, 1);
      }
    });
  } else {
    // 选择所有过滤后的选项
    filteredOptions.value.forEach(option => {
      if (!localSelectedValues.value.includes(option.value)) {
        localSelectedValues.value.push(option.value);
      }
    });
  }
  
  // 立即应用筛选并关闭弹框
  applyFilter();
};

const toggleSelection = (value: string) => {
  const index = localSelectedValues.value.indexOf(value);
  if (index > -1) {
    localSelectedValues.value.splice(index, 1);
  } else {
    localSelectedValues.value.push(value);
  }
  
  // 立即应用筛选并关闭弹框
  applyFilter();
};

const clearFilter = () => {
  localSelectedValues.value = [];
  localKeywordFilter.value = '';
};

const applyFilter = () => {
  // 先更新本地状态
  localSelectedValues.value = [...localSelectedValues.value];
  localKeywordFilter.value = localKeywordFilter.value;
  
  // 发出事件通知父组件
  emit('update:selectedValues', [...localSelectedValues.value]);
  emit('update:keywordFilter', localKeywordFilter.value);
  emit('apply', {
    selectedValues: [...localSelectedValues.value],
    keywordFilter: localKeywordFilter.value
  });
  
  // 隐藏筛选弹窗
  showFilter.value = false;
};

const onKeywordChange = () => {
  // 关键字变化时实时更新
  emit('update:keywordFilter', localKeywordFilter.value);
};

// 监听外部变化
watch(() => props.selectedValues, (newValues) => {
  localSelectedValues.value = [...newValues];
}, { deep: true });

watch(() => props.keywordFilter, (newKeyword) => {
  localKeywordFilter.value = newKeyword;
});

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.relative')) {
    showFilter.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* 自定义滚动条 */
.max-h-48::-webkit-scrollbar {
  width: 4px;
}

.max-h-48::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-700;
}

.max-h-48::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.max-h-48::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}
</style>
