<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">账户列表</h3>
    </div>
    
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>
    
    <div v-else-if="accounts.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
      暂无账户
    </div>
    
    <div v-else class="space-y-6">
      <!-- 启用账户：按类型分组显示 -->
      <div
        v-for="typeGroup in groupedActiveAccounts"
        :key="`active-${typeGroup.type}`"
        class="space-y-3"
      >
        <!-- 类型标题（整行可点击展开/收起） -->
        <div
          class="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors border border-transparent"
          :class="[
            isGroupExpanded(typeGroup.type)
              ? 'bg-gray-50 dark:bg-gray-700/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
          ]"
          @click="toggleGroupCollapse(typeGroup.type)"
        >
          <div class="flex items-center space-x-2">
            <component :is="isGroupExpanded(typeGroup.type) ? ChevronDownIcon : ChevronRightIcon" class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: getTypeColor(typeGroup.type) }"
            ></div>
            <h3
              :class="[
                'text-lg font-semibold',
                isGroupExpanded(typeGroup.type)
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-800 dark:text-gray-200'
              ]"
            >
              {{ typeGroup.type }}
            </h3>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-3">
            <span>{{ typeGroup.accounts.length }} 个账户</span>
            <span class="hidden md:inline">合计：¥{{ (typeGroup.totalBalance || 0).toFixed(2) }}</span>
          </div>
        </div>
        
        <!-- 该类型下的账户列表 -->
        <div v-show="isGroupExpanded(typeGroup.type)" class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div
            v-for="account in typeGroup.accounts"
            :key="account.id"
            class="bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-600"
            @click="$emit('viewFlows', account)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <!-- 账户图标 -->
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  :style="{ backgroundColor: getAccountColor(account.id) }"
                >
                  {{ account.name.charAt(0) }}
                </div>
                
                <!-- 账户信息 -->
                <div>
                  <div class="flex items-center space-x-2">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ account.name }}
                    </h4>
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        !account.isHidden
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      ]"
                    >
                      {{ !account.isHidden ? '显示' : '隐藏' }}
                    </span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ account.currency }}
                    </p>
                    <!-- 计入总资产复选框 -->
                    <label class="flex items-center space-x-1 cursor-pointer" @click.stop>
                      <input
                        type="checkbox"
                        :checked="account.includeInTotal !== false"
                        @change="$emit('toggleIncludeInTotal', account)"
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span class="text-xs text-gray-600 dark:text-gray-400">计入总资产</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <!-- 余额和操作 -->
              <div class="flex items-center space-x-4">
                <div class="text-right">
                  <p class="text-lg font-semibold text-gray-900 dark:text-white">
                    ¥{{ account.balance.toFixed(2) }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    余额
                  </p>
                </div>
                
                <!-- 操作按钮 -->
                <div class="flex items-center space-x-2" @click.stop>
                  <button
                    @click="$emit('editAccount', account)"
                    class="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="编辑"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  
                  <button
                    @click="$emit('toggleHidden', account)"
                    :class="[
                      'p-2 rounded transition-colors',
                      !account.isHidden
                        ? 'text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                        : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                    ]"
                    :title="!account.isHidden ? '隐藏' : '显示'"
                  >
                    <component :is="!account.isHidden ? EyeSlashIcon : EyeIcon" class="h-4 w-4" />
                  </button>
                  
                  <button
                    @click="$emit('deleteAccount', account)"
                    class="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="删除"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 统计信息 -->
            <div v-if="account.flowStats" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>流水记录: {{ getTotalFlowCount(account.flowStats, account.transferStats) }} 条</span>
                <span>创建时间: {{ formatDate(account.createDate) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 隐藏账户（可折叠） -->
      <div v-if="hiddenCount > 0" class="space-y-3">
        <div
          class="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors"
          :class="showHidden ? 'bg-gray-50 dark:bg-gray-700/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'"
          @click="showHidden = !showHidden"
        >
          <div class="flex items-center space-x-2">
            <component :is="showHidden ? ChevronDownIcon : ChevronRightIcon" class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: '#6B7280' }"></div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              隐藏账户
            </h3>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-3">
            <span>{{ hiddenCount }} 个账户</span>
          </div>
        </div>

        <div v-show="showHidden" class="space-y-3">
          <div
            v-for="typeGroup in groupedHiddenAccounts"
            :key="`hidden-${typeGroup.type}`"
            class="space-y-3"
          >
            <div class="flex items-center space-x-3">
              <div class="flex items-center space-x-2">
                <div
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: getTypeColor(typeGroup.type) }"
                ></div>
                <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {{ typeGroup.type }}
                </h3>
              </div>
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-600"></div>
              <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
                <span>{{ typeGroup.accounts.length }} 个账户</span>
                <span>合计：¥{{ (typeGroup.totalBalance || 0).toFixed(2) }}</span>
              </div>
            </div>

            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
              <div
                v-for="account in typeGroup.accounts"
                :key="account.id"
                class="bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-600 opacity-80"
                @click="$emit('viewFlows', account)"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      :style="{ backgroundColor: getAccountColor(account.id) }"
                    >
                      {{ account.name.charAt(0) }}
                    </div>
                    <div>
                      <div class="flex items-center space-x-2">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ account.name }}
                        </h4>
                        <span
                          class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        >
                          隐藏
                        </span>
                      </div>
                      <div class="flex items-center space-x-3">
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ account.currency }}
                        </p>
                        <!-- 计入总资产复选框 -->
                        <label class="flex items-center space-x-1 cursor-pointer" @click.stop>
                          <input
                            type="checkbox"
                            :checked="account.includeInTotal !== false"
                            @change="$emit('toggleIncludeInTotal', account)"
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span class="text-xs text-gray-600 dark:text-gray-400">计入总资产</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center space-x-4">
                    <div class="text-right">
                      <p class="text-lg font-semibold text-gray-900 dark:text-white">
                        ¥{{ account.balance.toFixed(2) }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">余额</p>
                    </div>
                    <div class="flex items-center space-x-2" @click.stop>
                      <button
                        @click="$emit('editAccount', account)"
                        class="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="编辑"
                      >
                        <PencilIcon class="h-4 w-4" />
                      </button>
                      <button
                        @click="$emit('toggleHidden', account)"
                        class="p-2 rounded transition-colors text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                        title="显示"
                      >
                        <EyeIcon class="h-4 w-4" />
                      </button>
                      <button
                        @click="$emit('deleteAccount', account)"
                        class="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="删除"
                      >
                        <TrashIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="account.flowStats" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>流水记录: {{ getTotalFlowCount(account.flowStats, account.transferStats) }} 条</span>
                    <span>创建时间: {{ formatDate(account.createDate) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/vue/24/outline";

interface Props {
  accounts: any[];
  loading: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  editAccount: [account: any];
  deleteAccount: [account: any];
  toggleHidden: [account: any];
  toggleIncludeInTotal: [account: any];
  viewFlows: [account: any];
}>();

// 折叠状态：所有分组默认展开
const showHidden = ref(false);
const expandedGroups = ref<Set<string>>(new Set());

// 工具：将账户数组按类型分组
const groupByType = (list: any[]) => {
  const groups = new Map();
  
  // 定义账户类型顺序
  const typeOrder = ['现金', '银行卡', '电子钱包', '投资账户', '信用卡', '其他'];
  
  list.forEach(account => {
    const type = account.type || '其他';
    if (!groups.has(type)) {
      groups.set(type, {
        type,
        accounts: [],
        totalBalance: 0
      });
    }
    const group = groups.get(type);
    group.accounts.push(account);
    group.totalBalance += Number(account.balance || 0);
  });
  
  // 输出时按总余额倒序排序
  return Array.from(groups.values()).sort((a: any, b: any) => b.totalBalance - a.totalBalance);
};

// 显示账户分组
const groupedActiveAccounts = computed(() => {
  const visibleList = props.accounts.filter(a => !a.isHidden);
  return groupByType(visibleList);
});

// 隐藏账户分组与计数
const groupedHiddenAccounts = computed(() => {
  const hiddenList = props.accounts.filter(a => a.isHidden);
  return groupByType(hiddenList);
});

const hiddenCount = computed(() => props.accounts.filter(a => a.isHidden).length);

// 折叠控制方法
const toggleGroupCollapse = (type: string) => {
  if (expandedGroups.value.has(type)) {
    // 如果分组在收起列表中，点击后移除（展开）
    expandedGroups.value.delete(type);
  } else {
    // 如果分组不在收起列表中，点击后添加（收起）
    expandedGroups.value.add(type);
  }
};

const isGroupExpanded = (type: string) => {
  // 如果分组已经被手动收起，则返回false；否则默认展开
  return !expandedGroups.value.has(type);
};

// 生成账户颜色
const getAccountColor = (accountId: number) => {
  const colors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
  ];
  return colors[accountId % colors.length];
};

// 生成类型颜色
const getTypeColor = (type: string) => {
  const typeColors: { [key: string]: string } = {
    '现金': '#10B981',      // 绿色
    '银行卡': '#3B82F6',    // 蓝色
    '电子钱包': '#F59E0B',  // 黄色
    '投资账户': '#8B5CF6',  // 紫色
    '信用卡': '#EF4444',    // 红色
    '其他': '#6B7280'       // 灰色
  };
  return typeColors[type] || '#6B7280';
};

// 计算总流水数量（包括流水和转账）
const getTotalFlowCount = (flowStats: any[], transferStats: any[] = []) => {
  const flowCount = flowStats ? flowStats.reduce((sum, stat) => sum + stat._count.id, 0) : 0;
  const transferCount = transferStats ? transferStats.reduce((sum, stat) => sum + stat._count.id, 0) : 0;
  return flowCount + transferCount;
};

// 格式化日期
const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN');
};
</script>
