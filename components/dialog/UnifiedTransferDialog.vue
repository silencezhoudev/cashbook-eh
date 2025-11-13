<template>
  <div
    v-if="showDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
    style="z-index: 999"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-auto"
      @click.stop
    >
      <div
        class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ dialogTitle }}
        </h3>
        <button
          @click="closeDialog"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转账类型 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="transferForm.transferType"
            @change="onTransferTypeChange"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择转账类型</option>
            <option value="transfer">转账</option>
            <option value="loan">借贷</option>
          </select>
        </div>

        <div v-if="transferForm.transferType === 'loan'">
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            借贷类型 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="transferForm.loanType"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择借贷类型</option>
            <option value="借入">借入</option>
            <option value="借出">借出</option>
            <option value="收款">收款</option>
            <option value="还款">还款</option>
          </select>
        </div>

        <div v-if="transferForm.transferType === 'loan'">
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            借贷对象 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="transferForm.counterparty"
            type="text"
            placeholder="请输入借贷对象"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

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

        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            转账说明
          </label>
          <input
            v-model="transferForm.name"
            type="text"
            :placeholder="transferForm.transferType === 'loan' ? '请输入借贷说明' : '请输入转账说明'"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

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
          确认{{ transferForm.transferType === 'loan' ? '借贷' : '转账' }}
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

const transferForm = ref({
  transferType: "",
  loanType: "",
  counterparty: "",
  fromAccountId: null as number | null,
  toAccountId: null as number | null,
  amount: null as number | null,
  day: "",
  name: "",
  description: ""
});

const fromAccountBalance = ref<number | null>(null);

const activeAccounts = computed(() => {
  return props.accounts;
});

const dialogTitle = computed(() => {
  if (transferForm.value.transferType === 'loan') {
    return '借贷记录';
  }
  return '账户转账';
});

const canTransfer = computed(() => {
  const basicCheck = transferForm.value.fromAccountId &&
                     transferForm.value.toAccountId &&
                     transferForm.value.amount &&
                     transferForm.value.amount > 0 &&
                     transferForm.value.fromAccountId !== transferForm.value.toAccountId;

  if (transferForm.value.transferType === 'loan') {
    return basicCheck && 
           transferForm.value.loanType && 
           transferForm.value.counterparty;
  }

  return basicCheck;
});

const onTransferTypeChange = () => {
  transferForm.value.loanType = "";
  transferForm.value.counterparty = "";
};

watch(() => transferForm.value.fromAccountId, (newAccountId) => {
  if (newAccountId) {
    const account = activeAccounts.value.find(acc => acc.id === newAccountId);
    fromAccountBalance.value = account ? account.balance : null;
  } else {
    fromAccountBalance.value = null;
  }
});

watch(() => props.showDialog, (show) => {
  if (show) {
    transferForm.value.day = new Date().toISOString().split("T")[0];
  } else {
    resetForm();
  }
});

const resetForm = () => {
  transferForm.value = {
    transferType: "",
    loanType: "",
    counterparty: "",
    fromAccountId: null,
    toAccountId: null,
    amount: null,
    day: "",
    name: "",
    description: ""
  };
  fromAccountBalance.value = null;
};

const updateFromAccountBalance = () => {
  if (transferForm.value.fromAccountId) {
    const account = activeAccounts.value.find(acc => acc.id === transferForm.value.fromAccountId);
    fromAccountBalance.value = account ? account.balance : null;
  }
};

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
    await doApi.post("api/entry/unified-transfer/add", {
      bookId: localStorage.getItem("bookId"),
      transferType: transferForm.value.transferType,
      fromAccountId: transferForm.value.fromAccountId,
      toAccountId: transferForm.value.toAccountId,
      amount: transferForm.value.amount,
      day: transferForm.value.day,
      name: transferForm.value.name,
      description: transferForm.value.description,
      loanType: transferForm.value.loanType,
      counterparty: transferForm.value.counterparty
    });
    
    Alert.success(transferForm.value.transferType === 'loan' ? "借贷记录创建成功" : "转账成功");
    closeDialog();
    props.successCallback?.();
  } catch (error) {
    console.error("转账失败:", error);
    Alert.error("转账失败");
  }
};

const closeDialog = () => {
  resetForm();
  emit("close");
};
</script>
