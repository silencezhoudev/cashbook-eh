<template>
  <!-- 账户编辑对话框 -->
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
          {{ title }}
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
        <!-- 账户名称 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            账户名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="accountForm.name"
            type="text"
            placeholder="请输入账户名称"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- 账户类型 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            账户类型
          </label>
          <select
            v-model="accountForm.type"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="现金">现金</option>
            <option value="银行卡">银行卡</option>
            <option value="电子钱包">电子钱包</option>
            <option value="投资账户">投资账户</option>
            <option value="信用卡">信用卡</option>
            <option value="其他">其他</option>
          </select>
        </div>

        <!-- 初始余额 -->
        <div v-if="!accountForm.id">
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            初始余额
          </label>
          <input
            v-model="accountForm.balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- 货币类型 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            货币类型
          </label>
          <select
            v-model="accountForm.currency"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="CNY">人民币 (CNY)</option>
            <option value="USD">美元 (USD)</option>
            <option value="EUR">欧元 (EUR)</option>
            <option value="JPY">日元 (JPY)</option>
            <option value="HKD">港币 (HKD)</option>
          </select>
        </div>

        <!-- 账户状态 -->
        <div v-if="accountForm.id">
          <label class="flex items-center">
            <input
              v-model="accountForm.isHidden"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              隐藏账户
            </span>
          </label>
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
          @click="saveAccount"
          :disabled="!accountForm.name"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          {{ accountForm.id ? '更新' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { Alert } from "~/utils/alert";
import { doApi } from "~/utils/api";

interface Props {
  showDialog: boolean;
  title: string;
  account?: any;
  successCallback?: () => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// 表单数据
const accountForm = ref({
  id: null as number | null,
  name: "",
  type: "现金",
  balance: 0,
  currency: "CNY",
  isHidden: false
});

// 监听账户变化
watch(() => props.account, (newAccount) => {
  if (newAccount) {
    accountForm.value = {
      id: newAccount.id || null,
      name: newAccount.name || "",
      type: newAccount.type || "现金",
      balance: newAccount.balance || 0,
      currency: newAccount.currency || "CNY",
      isHidden: newAccount.isHidden === true
    };
  } else {
    resetForm();
  }
}, { immediate: true });

// 重置表单
const resetForm = () => {
  accountForm.value = {
    id: null,
    name: "",
    type: "现金",
    balance: 0,
    currency: "CNY",
    isHidden: false
  };
};

// 保存账户
const saveAccount = async () => {
  if (!accountForm.value.name.trim()) {
    Alert.error("请输入账户名称");
    return;
  }

  try {
    if (accountForm.value.id) {
      // 更新账户
      await doApi.post("api/entry/account/update", {
        id: accountForm.value.id,
        name: accountForm.value.name,
        type: accountForm.value.type,
        currency: accountForm.value.currency,
        isHidden: accountForm.value.isHidden
      });
      Alert.success("账户更新成功");
    } else {
      // 创建账户
      await doApi.post("api/entry/account/add", {
        name: accountForm.value.name,
        type: accountForm.value.type,
        balance: accountForm.value.balance,
        currency: accountForm.value.currency,
        isHidden: accountForm.value.isHidden
      });
      Alert.success("账户创建成功");
    }
    
    closeDialog();
    props.successCallback?.();
  } catch (error) {
    console.error("保存账户失败:", error);
    Alert.error("保存失败");
  }
};

// 关闭对话框
const closeDialog = () => {
  resetForm();
  emit("close");
};
</script>
