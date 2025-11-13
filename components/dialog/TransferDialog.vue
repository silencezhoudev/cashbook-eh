<template>
  <!-- 转账对话框 -->
  <div
    v-if="showDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
    style="z-index: 999"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-auto"
      @click.stop
    >
      <!-- 标题栏 -->
      <div
        class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          账户转账
        </h3>
        <button
          @click="closeDialog"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- 表单内容 -->
      <div class="p-4 space-y-4">
        <!-- 转出账户 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转出账户 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="transferForm.fromAccountId"
            @change="updateFromAccountBalance"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择转出账户</option>
            <option
              v-for="account in activeAccounts"
              :key="account.id"
              :value="account.id"
            >
              {{ account.name }} ({{ account.type }}) - ¥{{ account.balance.toFixed(2) }}
            </option>
          </select>
        </div>

        <!-- 转入账户 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转入账户 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="transferForm.toAccountId"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择转入账户</option>
            <option
              v-for="account in activeAccounts"
              :key="account.id"
              :value="account.id"
              :disabled="account.id === transferForm.fromAccountId"
            >
              {{ account.name }} ({{ account.type }})
            </option>
          </select>
        </div>

        <!-- 转账金额 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转账金额 <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
            <input
              v-model="transferForm.amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p v-if="fromAccountBalance !== null" class="text-xs text-gray-500 mt-1">
            可用余额: ¥{{ fromAccountBalance.toFixed(2) }}
          </p>
        </div>

        <!-- 转账日期 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转账日期
          </label>
          <input
            v-model="transferForm.day"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- 转账说明 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转账说明
          </label>
          <input
            v-model="transferForm.name"
            type="text"
            placeholder="请输入转账说明"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- 备注 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            备注
          </label>
          <textarea
            v-model="transferForm.description"
            rows="3"
            placeholder="请输入备注信息"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
        </div>
      </div>

      <!-- 按钮栏 -->
      <div
        class="flex justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          @click="closeDialog"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
        >
          取消
        </button>
        <button
          @click="executeTransfer"
          :disabled="!canTransfer"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          确认转账
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { Alert } from "~/utils/alert";

interface Props {
  showDialog: boolean;
  accounts: any[];
  successCallback?: () => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// 表单数据
const transferForm = ref({
  fromAccountId: null as number | null,
  toAccountId: null as number | null,
  amount: null as number | null,
  day: "",
  name: "",
  description: ""
});

// 转出账户余额
const fromAccountBalance = ref<number | null>(null);

// 计算属性
const activeAccounts = computed(() => {
  return props.accounts; // 所有账户都可用，不再按isActive筛选
});

const canTransfer = computed(() => {
  return transferForm.value.fromAccountId &&
         transferForm.value.toAccountId &&
         transferForm.value.amount &&
         transferForm.value.amount > 0 &&
         transferForm.value.fromAccountId !== transferForm.value.toAccountId;
});

// 监听转出账户变化
watch(() => transferForm.value.fromAccountId, (newAccountId) => {
  if (newAccountId) {
    const account = activeAccounts.value.find(acc => acc.id === newAccountId);
    fromAccountBalance.value = account ? account.balance : null;
  } else {
    fromAccountBalance.value = null;
  }
});

// 监听对话框显示状态
watch(() => props.showDialog, (show) => {
  if (show) {
    // 设置默认日期为今天
    transferForm.value.day = new Date().toISOString().split("T")[0];
  } else {
    resetForm();
  }
});

// 重置表单
const resetForm = () => {
  transferForm.value = {
    fromAccountId: null,
    toAccountId: null,
    amount: null,
    day: "",
    name: "",
    description: ""
  };
  fromAccountBalance.value = null;
};

// 更新转出账户余额显示
const updateFromAccountBalance = () => {
  if (transferForm.value.fromAccountId) {
    const account = activeAccounts.value.find(acc => acc.id === transferForm.value.fromAccountId);
    fromAccountBalance.value = account ? account.balance : null;
  }
};

// 执行转账
const executeTransfer = async () => {
  if (!canTransfer.value) {
    Alert.error("请填写完整的转账信息");
    return;
  }

  if (fromAccountBalance.value !== null && transferForm.value.amount! > fromAccountBalance.value) {
    Alert.error("转出账户余额不足");
    return;
  }

  try {
    await doApi.post("api/entry/transfer/add", {
      bookId: localStorage.getItem("bookId"),
      fromAccountId: transferForm.value.fromAccountId,
      toAccountId: transferForm.value.toAccountId,
      amount: transferForm.value.amount,
      day: transferForm.value.day,
      name: transferForm.value.name || "账户转账",
      description: transferForm.value.description
    });
    
    Alert.success("转账成功");
    closeDialog();
    props.successCallback?.();
  } catch (error) {
    console.error("转账失败:", error);
    Alert.error("转账失败");
  }
};

// 关闭对话框
const closeDialog = () => {
  resetForm();
  emit("close");
};
</script>
