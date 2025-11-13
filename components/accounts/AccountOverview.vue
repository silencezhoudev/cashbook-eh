<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      账户总览
    </h2>
    
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>
    
    <div v-else class="space-y-4">
      <!-- 总资产 -->
      <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-green-100 text-sm">总资产</p>
            <p class="text-2xl font-bold">{{ totalBalance.toFixed(2) }}</p>
          </div>
          <div class="text-right">
            <p class="text-green-100 text-sm">账户数量</p>
            <p class="text-xl font-semibold">{{ activeAccountsCount }}</p>
          </div>
        </div>
      </div>
      
      <!-- 账户类型统计 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="type in accountTypeStats"
          :key="type.type"
          class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ type.type }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                ¥{{ type.totalBalance.toFixed(2) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ type.count }}个</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 余额分布图表 -->
      <div class="mt-4">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          余额分布
        </h3>
        <div class="space-y-2">
          <div
            v-for="account in topAccounts"
            :key="account.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-2">
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: getAccountColor(account.id) }"
              ></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ account.name }}
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  class="h-2 rounded-full"
                  :style="{
                    backgroundColor: getAccountColor(account.id),
                    width: `${(account.balance / totalBalance) * 100}%`
                  }"
                ></div>
              </div>
              <span class="text-sm font-medium text-gray-900 dark:text-white w-20 text-right">
                ¥{{ account.balance.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  accounts: any[];
  loading: boolean;
}

const props = defineProps<Props>();

// 计算总余额
const totalBalance = computed(() => {
  return props.accounts
    .filter(account => account.includeInTotal !== false)
    .reduce((sum, account) => sum + (account.balance || 0), 0);
});

// 计算活跃账户数量
const activeAccountsCount = computed(() => {
  return props.accounts.length;
});

// 按类型统计账户
const accountTypeStats = computed(() => {
  const typeMap = new Map();
  
  props.accounts
    .filter(account => account.includeInTotal !== false)
    .forEach(account => {
      const type = account.type || "其他";
      if (!typeMap.has(type)) {
        typeMap.set(type, {
          type,
          totalBalance: 0,
          count: 0
        });
      }
      const stats = typeMap.get(type);
      stats.totalBalance += account.balance || 0;
      stats.count += 1;
    });
  
  return Array.from(typeMap.values()).sort((a, b) => b.totalBalance - a.totalBalance);
});

// 获取余额前5的账户
const topAccounts = computed(() => {
  return props.accounts
    .filter(account => account.includeInTotal !== false)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, 5);
});

// 生成账户颜色
const getAccountColor = (accountId: number) => {
  const colors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
  ];
  return colors[accountId % colors.length];
};
</script>
