<template>
  <div class="book-import-component bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <!-- 功能介绍 -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        导入功能说明
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <DocumentArrowUpIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">支持格式</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">支持 Excel (.xlsx, .xls) 格式文件</p>
          </div>
        </div>
        
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircleIcon class="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">自动验证</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">导入前自动验证数据格式和完整性</p>
          </div>
        </div>
        
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
              <UserPlusIcon class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">智能账户</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">自动创建不存在的账户</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">数据导入</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">支持从挖财记账等应用导入历史数据</p>
      </div>
      <button
        @click="showImportDialog = true"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <DocumentArrowUpIcon class="h-5 w-5" />
        开始导入
      </button>
    </div>

    <!-- 导入历史 -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">导入历史</h3>
      
      <div v-if="importHistory.length === 0" class="text-center py-8">
        <DocumentArrowUpIcon class="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无导入记录</h4>
        <p class="text-gray-500 dark:text-gray-400 mb-4">开始您的第一次数据导入吧</p>
        <button
          @click="showImportDialog = true"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          开始导入
        </button>
      </div>
      
      <div v-else class="space-y-4">
        <div
          v-for="record in importHistory"
          :key="record.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div
                :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  record.status === 'success'
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
                ]"
              >
                <CheckCircleIcon
                  v-if="record.status === 'success'"
                  class="h-6 w-6 text-green-600 dark:text-green-400"
                />
                <XCircleIcon
                  v-else
                  class="h-6 w-6 text-red-600 dark:text-red-400"
                />
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ record.bookName }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ record.date }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                {{ record.flowCount }} 条流水
              </div>
              <div
                :class="[
                  'text-sm',
                  record.status === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                ]"
              >
                {{ record.status === 'success' ? '成功' : '失败' }}
              </div>
            </div>
          </div>
          
          <!-- 详细信息 -->
          <div v-if="record.details" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">成功导入:</span>
                <span class="ml-2 text-green-600 dark:text-green-400 font-medium">
                  {{ record.details.successCount }}
                </span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">导入失败:</span>
                <span class="ml-2 text-red-600 dark:text-red-400 font-medium">
                  {{ record.details.errorCount }}
                </span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">创建账户:</span>
                <span class="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                  {{ record.details.accountCount }}
                </span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">总行数:</span>
                <span class="ml-2 text-gray-900 dark:text-white font-medium">
                  {{ record.details.totalRows }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div
      v-if="showImportDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="showImportDialog = false"
    >
      <WacaiImportDialog
        @success-callback="onImportSuccess"
        @close="showImportDialog = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserPlusIcon,
} from '@heroicons/vue/24/outline';
import WacaiImportDialog from '~/components/dialog/WacaiImportDialog.vue';

// 响应式数据
const showImportDialog = ref(false);
const importHistory = ref<ImportRecord[]>([]);

// 导入记录接口
interface ImportRecord {
  id: string;
  date: string;
  bookName: string;
  flowCount: number;
  status: 'success' | 'error';
  details?: {
    successCount: number;
    errorCount: number;
    accountCount: number;
    totalRows: number;
  };
}

// 导入成功回调
const onImportSuccess = (result?: any) => {
  // 添加导入记录到历史
  const record: ImportRecord = {
    id: Date.now().toString(),
    date: new Date().toLocaleString(),
    bookName: result?.bookName || '未知账本',
    flowCount: result?.stats?.successCount || 0,
    status: 'success',
    details: result?.stats
  };
  
  importHistory.value.unshift(record);
  
  // 保存到本地存储
  saveImportHistory();
  
  // 关闭对话框
  showImportDialog.value = false;
};

// 保存导入历史到本地存储
const saveImportHistory = () => {
  try {
    localStorage.setItem('importHistory', JSON.stringify(importHistory.value));
  } catch (error) {
    console.error('保存导入历史失败:', error);
  }
};

// 从本地存储加载导入历史
const loadImportHistory = () => {
  try {
    // 首先尝试从新位置加载
    const saved = localStorage.getItem('importHistory');
    if (saved) {
      importHistory.value = JSON.parse(saved);
    } else {
      // 如果新位置没有数据，尝试从旧位置迁移
      // 检查是否有旧的导入历史数据需要迁移
      const oldSaved = localStorage.getItem('importHistory');
      if (oldSaved) {
        try {
          const oldData = JSON.parse(oldSaved);
          if (Array.isArray(oldData) && oldData.length > 0) {
            importHistory.value = oldData;
            // 保存到新位置（实际上位置相同，但确保数据完整性）
            saveImportHistory();
            console.log('导入历史数据迁移完成');
          }
        } catch (parseError) {
          console.error('解析旧导入历史数据失败:', parseError);
        }
      }
    }
  } catch (error) {
    console.error('加载导入历史失败:', error);
  }
};

// 组件挂载时加载数据
onMounted(() => {
  loadImportHistory();
});
</script>
