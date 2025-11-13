<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ account?.name }} - 流水记录
        </h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- 统计信息 -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">总记录数</p>
              <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ total }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">总流入</p>
              <p class="text-xl font-semibold text-green-600">{{ totalIn.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">总流出</p>
              <p class="text-xl font-semibold text-red-600">{{ totalOut.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">净流入</p>
              <p class="text-xl font-semibold" :class="netInflow >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ netInflow.toFixed(2) }}
              </p>
            </div>
          </div>
        </div>

        <!-- 流水表格 -->
        <div class="flex-1 overflow-auto">
          <FlowsTable
            :flows="flows"
            :selected-items="[]"
            :is-all-selected="false"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            :total-pages="totalPages"
            :page-numbers="[]"
            :loading="loading"
            :account-id="account?.id"
            :initial-balance="account?.balance || 0"
            @toggle-select-all="() => {}"
            @toggle-select-item="() => {}"
            @edit-item="() => {}"
            @edit-transfer="() => {}"
            @delete-item="() => {}"
            @change-page="changePage"
            @change-page-size="changePageSize"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import FlowsTable from "@/components/flows/FlowsTable.vue";
import { Alert } from "~/utils/alert";
import { doApi } from "~/utils/api";

interface Props {
  show: boolean;
  account: any;
  startDay?: string;
  endDay?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// 数据状态
const flows = ref<any[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(100);
const total = ref(0);
const totalPages = ref(0);
const totalIn = ref(0);
const totalOut = ref(0);

// 计算净流入
const netInflow = computed(() => {
  return totalIn.value - totalOut.value;
});

// 获取账户流水记录
const getAccountFlows = async () => {
  if (!props.account?.id) {
    console.log("缺少必要参数:", { accountId: props.account?.id });
    return;
  }
  
  console.log("开始获取账户流水记录:", {
    accountId: props.account.id,
    pageNum: currentPage.value,
    pageSize: pageSize.value
  });
  
  loading.value = true;
  try {
    const requestData = {
      accountId: props.account.id,
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      ...(props.startDay ? { startDay: props.startDay } : {}),
      ...(props.endDay ? { endDay: props.endDay } : {}),
    };
    
    console.log("发送API请求:", requestData);
    const res = await doApi.post("api/entry/flow/page", requestData);
    console.log("API响应:", res);
    
    // 检查响应格式，支持两种格式：res.d 或直接 res
    const responseData = res?.d || res;
    
    if (responseData && (responseData.data !== undefined || responseData.total !== undefined)) {
      flows.value = responseData.data || [];
      total.value = responseData.total || 0;
      totalPages.value = responseData.pages || 0;
      totalIn.value = responseData.totalIn || 0;
      totalOut.value = responseData.totalOut || 0;
      
      console.log("处理后的数据:", {
        flowsCount: flows.value.length,
        total: total.value,
        totalPages: totalPages.value,
        totalIn: totalIn.value,
        totalOut: totalOut.value
      });
    } else {
      console.log("API响应格式异常:", res);
    }
  } catch (error) {
    console.error("获取账户流水记录失败:", error);
    Alert.error("获取账户流水记录失败");
  } finally {
    loading.value = false;
  }
};

// 分页处理
const changePage = (page: number) => {
  currentPage.value = page;
  getAccountFlows();
};

const changePageSize = (size: string) => {
  pageSize.value = Number(size);
  currentPage.value = 1;
  getAccountFlows();
};

// 关闭对话框
const close = () => {
  emit("close");
};

// 监听对话框显示状态
watch(() => props.show, (newShow) => {
  if (newShow && props.account?.id) {
    currentPage.value = 1;
    getAccountFlows();
  }
});

// 监听账户变化
watch(() => props.account?.id, () => {
  if (props.show && props.account?.id) {
    currentPage.value = 1;
    getAccountFlows();
  }
});
</script>
