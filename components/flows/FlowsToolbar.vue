<template>
  <div
    class="flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 mb-2 md:mb-4"
  >
    <!-- 第一行：主要操作按钮 - 桌面端水平排列，手机端垂直堆叠 -->
    <div class="flex flex-col md:flex-row md:justify-between gap-2">
      <div class="flex flex-wrap gap-2">
        <button
          @click="$emit('openImportExport')"
          class="flex-1 md:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <CloudArrowDownIcon class="w-4 h-4" />
          <span class="hidden sm:inline">导入导出</span>
          <span class="sm:hidden">导入</span>
        </button>
        <button
          @click="$emit('autoMerge')"
          class="flex-1 md:flex-none px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <AdjustmentsHorizontalIcon class="w-4 h-4" />
          <span class="hidden sm:inline">自助平账</span>
          <span class="sm:hidden">平账</span>
        </button>
        <button
          @click="$emit('autoDeduplication')"
          class="flex-1 md:flex-none px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <DocumentDuplicateIcon class="w-4 h-4" />
          <span class="hidden sm:inline">自助去重</span>
          <span class="sm:hidden">去重</span>
        </button>
        <button
          @click="$emit('createNew')"
          class="flex-1 md:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <PlusIcon class="w-4 h-4" />
          新增
        </button>
        <!--
        <button
          @click="$emit('openTransfer')"
          class="flex-1 md:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <ArrowPathIcon class="w-4 h-4" />
          转账
        </button>
        -->
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <!-- 批量操作 - 有选中项时显示 -->
        <div v-if="selectedCount > 0" class="flex gap-2">
          <button
            @click="$emit('deleteSelected')"
            class="flex-1 sm:flex-none px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <TrashIcon class="w-4 h-4" />
            <span class="hidden sm:inline">删除选中({{ selectedCount }})</span>
            <span class="sm:hidden">删除({{ selectedCount }})</span>
          </button>
          <button
            @click="$emit('batchChangeType')"
            class="flex-1 sm:flex-none px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <PencilSquareIcon class="w-4 h-4" />
            <span class="hidden sm:inline">类型修改({{ selectedCount }})</span>
            <span class="sm:hidden">修改({{ selectedCount }})</span>
          </button>
          <button
            @click="$emit('batchMoveToBook')"
            class="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ArrowPathIcon class="w-4 h-4" />
            <span class="hidden sm:inline">移动到账本({{ selectedCount }})</span>
            <span class="sm:hidden">移动({{ selectedCount }})</span>
          </button>
        </div>

        <!-- 关键字搜索（全局，跨账本） + 筛选操作 -->
        <div class="flex gap-2 items-stretch sm:items-center w-full sm:w-auto">
          <div class="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <input
              v-model="keyword"
              type="text"
              placeholder="关键字搜索（跨所有账本）... 回车搜索"
              class="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-green-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
              @keyup.enter="emitKeywordSearch"
            />
            <button
              @click="emitKeywordSearch"
              class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              搜索
            </button>
            <button
              v-if="keyword"
              @click="clearKeyword"
              class="px-3 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded text-sm font-medium"
            >
              清空
            </button>
          </div>
          
          <!-- 原筛选与重置按钮 -->
          <button
            @click="$emit('openSearch')"
            class="flex-1 sm:flex-none px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <FunnelIcon class="w-4 h-4" />
            筛选
          </button>
          <button
            @click="$emit('resetQuery')"
            class="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ArrowPathIcon class="w-4 h-4" />
            重置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CloudArrowDownIcon,
  AdjustmentsHorizontalIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilSquareIcon,
} from "@heroicons/vue/24/outline";

interface Props {
  selectedCount: number;
}

defineProps<Props>();

const emit = defineEmits<{
  openImportExport: [];
  autoMerge: [];
  autoDeduplication: [];
  createNew: [];
  openTransfer: [];
  deleteSelected: [];
  batchChangeType: [];
  openSearch: [];
  resetQuery: [];
  keywordSearch: [keyword: string];
  clearKeyword: [];
  batchMoveToBook: [];
}>();

const keyword = ref("");

const emitKeywordSearch = () => {
  emit("keywordSearch", keyword.value.trim());
};

const clearKeyword = () => {
  keyword.value = "";
  emit("clearKeyword");
};
</script>
