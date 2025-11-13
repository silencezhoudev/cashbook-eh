<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">转账记录</h3>
    </div>
    
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>
    
    <div v-else-if="transfers.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
      暂无转账记录
    </div>
    
    <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
      <div
        v-for="transfer in transfers"
        :key="transfer.id"
        class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <!-- 转账图标 -->
            <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ArrowPathIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            
            <!-- 转账信息 -->
            <div>
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ transfer.name || '账户转账' }}
              </h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ transfer.fromAccount.name }} → {{ transfer.toAccount.name }}
              </p>
              <p v-if="transfer.description" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {{ transfer.description }}
              </p>
            </div>
          </div>
          
          <!-- 金额和操作 -->
          <div class="flex items-center space-x-4">
            <div class="text-right">
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                ¥{{ transfer.amount.toFixed(2) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ transfer.day }}
              </p>
            </div>
            
            <!-- 操作按钮 -->
            <div class="flex items-center space-x-2">
              <button
                @click="$emit('deleteTransfer', transfer)"
                class="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="删除"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 查看更多 -->
    <div v-if="transfers.length > 0" class="px-4 py-3 border-t border-gray-200 dark:border-gray-600">
      <button class="w-full text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
        查看更多转账记录
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon, TrashIcon } from "@heroicons/vue/24/outline";

interface Props {
  transfers: any[];
  loading: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  deleteTransfer: [transfer: any];
}>();
</script>
