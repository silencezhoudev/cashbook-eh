<template>
  <div class="p-2 md:p-4 bg-gray-50 dark:bg-green-950/20 min-h-full">
    <!-- 页面标题和操作栏 -->
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
        账户管理
      </h1>
      <div class="flex gap-2">
        <button
          @click="openAddAccountDialog"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <PlusIcon class="w-4 h-4 inline mr-1" />
          添加账户
        </button>
        <button
          @click="openTransferDialog"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <ArrowPathIcon class="w-4 h-4 inline mr-1" />
          转账
        </button>
        <button
          @click="recalcBalances"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-md text-sm font-medium transition-colors"
        >
          校准余额
        </button>
      </div>
    </div>

    <!-- 账户总览 -->
    <AccountOverview :accounts="accounts" :loading="loading" />

    <!-- 账户列表 -->
    <AccountList
      :accounts="accounts"
      :loading="loading"
      @edit-account="editAccount"
      @delete-account="deleteAccount"
      @toggle-hidden="toggleAccountHidden"
      @toggle-include-in-total="toggleIncludeInTotal"
      @view-flows="viewAccountFlows"
    />


    <!-- 添加/编辑账户对话框 -->
    <AccountEditDialog
      v-if="showAccountDialog"
      :show-dialog="showAccountDialog"
      :title="accountDialogTitle"
      :account="selectedAccount"
      :success-callback="refreshAccounts"
      @close="closeAccountDialog"
    />

    <!-- 转账对话框 -->
    <TransferDialog
      v-if="showTransferDialog"
      :accounts="accounts"
      :success-callback="refreshData"
      @close="closeTransferDialog"
    />

    <!-- 账户流水记录对话框 -->
    <AccountFlowsDialog
      :show="showFlowsDialog"
      :account="selectedAccount"
      @close="closeFlowsDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { PlusIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import AccountOverview from "@/components/accounts/AccountOverview.vue";
import AccountList from "@/components/accounts/AccountList.vue";
import AccountEditDialog from "@/components/dialog/AccountEditDialog.vue";
import TransferDialog from "@/components/dialog/TransferDialog.vue";
import AccountFlowsDialog from "@/components/dialog/AccountFlowsDialog.vue";
import { Alert } from "~/utils/alert";
import { Confirm } from "~/utils/confirm";
import { useBookState } from "~/composables/useBookState";

definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

// 数据状态
const accounts = ref<any[]>([]);
const loading = ref(false);

// 对话框状态
const showAccountDialog = ref(false);
const showTransferDialog = ref(false);
const showFlowsDialog = ref(false);
const selectedAccount = ref<any>({});
const accountDialogTitle = ref("添加账户");

// 账本状态（账户页不再按账本过滤，仅保留以兼容其他操作）
const { getEffectiveBookId } = useBookState();

// 获取账户列表
const getAccounts = async () => {
  loading.value = true;
  try {
    const res = await doApi.post<any[]>("api/entry/account/list", {
      includeHidden: true
    });
    accounts.value = res;
  } catch (error) {
    console.error("获取账户列表失败:", error);
    Alert.error("获取账户列表失败");
  } finally {
    loading.value = false;
  }
};


// 刷新数据
const refreshData = () => {
  getAccounts();
};

const refreshAccounts = () => {
  getAccounts();
};

// 校准余额：调用维护接口并刷新
const recalcBalances = async () => {
  try {
    loading.value = true;
    const res = await doApi.post("api/entry/maintenance/recalc-balances", {});
    Alert.success(`余额校准完成：${res?.updated || 0}/${res?.total || 0}`);
    await getAccounts();
  } catch (e) {
    Alert.error("余额校准失败");
  } finally {
    loading.value = false;
  }
};

// 打开添加账户对话框
const openAddAccountDialog = () => {
  accountDialogTitle.value = "添加账户";
  selectedAccount.value = {};
  showAccountDialog.value = true;
};

// 编辑账户
const editAccount = (account: any) => {
  accountDialogTitle.value = "编辑账户";
  selectedAccount.value = { ...account };
  showAccountDialog.value = true;
};

// 删除账户
const deleteAccount = (account: any) => {
  Confirm.open({
    title: "删除确认",
    content: `确定删除账户 "${account.name}" 吗？删除后相关流水记录将保留。`,
    confirm: async () => {
      try {
        await doApi.post("api/entry/account/del", {
          id: account.id
        });
        Alert.success("删除成功");
        refreshAccounts();
      } catch (error) {
        Alert.error("删除失败");
      }
    }
  });
};

// 切换账户隐藏状态
const toggleAccountHidden = async (account: any) => {
  try {
    await doApi.post("api/entry/account/update", {
      id: account.id,
      isHidden: !account.isHidden
    });
    Alert.success(account.isHidden ? "账户已显示" : "账户已隐藏");
    refreshAccounts();
  } catch (error) {
    Alert.error("操作失败");
  }
};

// 切换计入总资产状态
const toggleIncludeInTotal = async (account: any) => {
  try {
    await doApi.post("api/entry/account/update", {
      id: account.id,
      includeInTotal: !account.includeInTotal
    });
    Alert.success(account.includeInTotal ? "已从总资产中移除" : "已计入总资产");
    refreshAccounts();
  } catch (error) {
    Alert.error("操作失败");
  }
};

// 打开转账对话框
const openTransferDialog = () => {
  if (accounts.value.length < 2) {
    Alert.error("至少需要两个账户才能进行转账");
    return;
  }
  showTransferDialog.value = true;
};


// 关闭对话框
const closeAccountDialog = () => {
  showAccountDialog.value = false;
  selectedAccount.value = {};
};

const closeTransferDialog = () => {
  showTransferDialog.value = false;
};

// 查看账户流水记录
const viewAccountFlows = (account: any) => {
  console.log("查看账户流水记录:", {
    account: account
  });
  selectedAccount.value = account;
  showFlowsDialog.value = true;
};

// 关闭流水记录对话框
const closeFlowsDialog = () => {
  showFlowsDialog.value = false;
  selectedAccount.value = {};
};

// 初始化
onMounted(() => {
  refreshData();
});
</script>
