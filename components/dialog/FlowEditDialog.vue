<template>
  <!-- 流水编辑对话框 -->
  <div
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
      <div class="p-2 md:p-4 space-y-2 max-h-[80vh] overflow-y-auto">
        <!-- 日期选择 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            日期
          </label>
          <UiDatePicker v-model="flowEdit.day" class="w-full" />
        </div>

        <!-- 流水类型 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            流水类型
          </label>
          <select
            v-model="flowEdit.flowType"
            @change="changeFlowTypes"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">请选择流水类型</option>
            <option
              v-for="type in flowTypeDialogOptions"
              :key="type"
              :value="type"
            >
              {{ type }}
            </option>
          </select>
        </div>

        <!-- 账户选择（收入/支出） -->
        <div v-if="showAccountField && !isTransferLike">
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            账户 <span class="text-gray-500 text-xs">(可选)</span>
          </label>
          <select
            v-model="flowEdit.accountId"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">不指定账户</option>
            <option
              v-for="account in accountList"
              :key="account.id"
              :value="account.id"
              :disabled="false"
            >
              {{ account.name }} ({{ account.type }})
            </option>
          </select>
        </div>

        <!-- 转账/借贷账户选择（双账户） -->
        <div v-if="isTransferLike && accountList.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              转出账户 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="flowEdit.fromAccountId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">请选择</option>
              <option
                v-for="account in accountList"
                :key="account.id"
                :value="account.id"
                :disabled="false"
              >
                {{ account.name }} ({{ account.type }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              转入账户 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="flowEdit.toAccountId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">请选择</option>
              <option
                v-for="account in accountList"
                :key="account.id"
                :value="account.id"
                :disabled="account.id === flowEdit.fromAccountId"
              >
                {{ account.name }} ({{ account.type }})
              </option>
            </select>
          </div>
        </div>

        <!-- 支出类型/收入类型 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ industryTypeLabel }}
          </label>
          <div class="relative">
            <input
              v-model="flowEdit.industryType"
              @input="
                (industryTypeSearchText = flowEdit.industryType),
                  (showIndustryTypeDropdown = true),
                  (industryActiveIndex = 0)
              "
              @focus="
                (showIndustryTypeDropdown = true), (industryActiveIndex = 0)
              "
              @blur="hideIndustryTypeDropdown"
              @keydown="onIndustryKeydown($event)"
              placeholder="输入或选择类型"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <!-- 下拉选项 -->
            <div
              v-if="
                showIndustryTypeDropdown &&
                filteredIndustryTypeOptions.length > 0
              "
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              <div
                v-for="(item, index) in filteredIndustryTypeOptions"
                :key="item"
                @mousedown="selectIndustryType(item)"
                :class="[
                  'px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-white',
                  index === industryActiveIndex
                    ? 'bg-gray-100 dark:bg-gray-600'
                    : '',
                ]"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 支付方式/收款方式 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            {{ payTypeLabel }}
          </label>
          <div class="relative">
            <input
              v-model="flowEdit.payType"
              @input="
                (payTypeSearchText = flowEdit.payType),
                  (showPayTypeDropdown = true),
                  (payTypeActiveIndex = 0)
              "
              @focus="(showPayTypeDropdown = true), (payTypeActiveIndex = 0)"
              @blur="hidePayTypeDropdown"
              @keydown="onPayTypeKeydown($event)"
              placeholder="输入或选择支付方式"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <!-- 下拉选项 -->
            <div
              v-if="showPayTypeDropdown && filteredPayTypeOptions.length > 0"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              <div
                v-for="(item, index) in filteredPayTypeOptions"
                :key="item"
                @mousedown="selectPayType(item)"
                :class="[
                  'px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-white',
                  index === payTypeActiveIndex
                    ? 'bg-gray-100 dark:bg-gray-600'
                    : '',
                ]"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 金额 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            金额
          </label>
          <input
            v-model="flowEdit.money"
            type="number"
            step="0.01"
            placeholder="请输入金额"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- 流水归属 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            流水归属
          </label>
          <div class="relative">
            <input
              v-model="flowEdit.attribution"
              @input="
                (attributionSearchText = flowEdit.attribution),
                  (showAttributionDropdown = true),
                  (attributionActiveIndex = 0)
              "
              @focus="
                (showAttributionDropdown = true), (attributionActiveIndex = 0)
              "
              @blur="hideAttributionDropdown"
              @keydown="onAttributionKeydown($event)"
              placeholder="输入或选择归属"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <!-- 下拉选项 -->
            <div
              v-if="showAttributionDropdown && attributionList.length > 0"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              <div
                v-for="(item, index) in filteredAttributionList"
                :key="item"
                @mousedown="selectAttribution(item)"
                :class="[
                  'px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-white',
                  index === attributionActiveIndex
                    ? 'bg-gray-100 dark:bg-gray-600'
                    : '',
                ]"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 流水名称 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            流水名称
          </label>
          <div class="relative">
            <input
              v-model="flowEdit.name"
              @input="
                (nameSearchText = flowEdit.name),
                  (showNameDropdown = true),
                  (nameActiveIndex = 0)
              "
              @focus="(showNameDropdown = true), (nameActiveIndex = 0)"
              @blur="hideNameDropdown"
              @keydown="onNameKeydown($event)"
              placeholder="输入或选择名称"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <!-- 下拉选项 -->
            <div
              v-if="showNameDropdown && nameList.length > 0"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
            >
              <div
                v-for="(item, index) in filteredNameList"
                :key="item"
                @mousedown="selectName(item)"
                :class="[
                  'px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-white line-clamp-1',
                  index === nameActiveIndex
                    ? 'bg-gray-100 dark:bg-gray-600'
                    : '',
                ]"
              >
                {{ item }}
              </div>
            </div>
          </div>
        </div>

        <!-- 借贷相关字段 -->
        <div v-if="showLoanFields" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              借贷类型 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="flowEdit.loanType"
              @change="onLoanTypeChange"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">请选择借贷类型</option>
              <option value="借入">借入</option>
              <option value="借出">借出</option>
              <option value="收款">收款</option>
              <option value="还款">还款</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              借贷对象 <span class="text-gray-500 text-xs">(可选)</span>
            </label>
            <input
              v-model="flowEdit.counterparty"
              type="text"
              placeholder="请输入借贷对象（可选）"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- 备注 -->
        <div>
          <label
            class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
          >
            备注
          </label>
          <textarea
            v-model="flowEdit.description"
            rows="3"
            placeholder="请输入备注"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
        </div>
      </div>

      <!-- 不计收支（仅针对普通流水） -->
      <div v-if="!isTransferLike" class="flex items-center gap-2">
        <input id="notInOut" type="checkbox" class="h-4 w-4" v-model="notInOutChecked" @change="onToggleNotInOut" />
        <label for="notInOut" class="text-sm text-gray-700 dark:text-gray-300">不计收支</label>
      </div>

      <!-- 操作按钮 -->
      <div
        class="flex justify-center gap-3 p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <button
          @click="closeDialog"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          取消
        </button>
        <button
          @click="confirmForm(false)"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          确定
        </button>
        <button
          v-if="formTitle[0] === title"
          @click="confirmForm(true)"
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          确定并继续
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showFlowEditDialog } from "~/utils/flag";
import { onMounted, ref, computed, watch } from "vue";
import { getIndustryType, getPayType } from "~/utils/apis";
import { XMarkIcon } from "@heroicons/vue/24/outline";

// ESC键监听
useEscapeKey(() => {
  if (showFlowEditDialog.value) {
    closeDialog();
  }
}, showFlowEditDialog);

const { title, flow, successCallback } = defineProps([
  "title",
  "flow",
  "successCallback",
]);

// 表单弹窗标题选项
const formTitle = ["新增流水", "修改流水"];
const industryTypeLabel = ref("支出类型/收入类型");
const payTypeLabel = ref("支付方式/收款方式");
const flowTypeDialogOptions = ref(["支出", "收入", "转账", "借贷", "不计收支"]);

// 下拉框显示状态
const showIndustryTypeDropdown = ref(false);
const showPayTypeDropdown = ref(false);
const showAttributionDropdown = ref(false);
const showNameDropdown = ref(false);

// 支出类型/收入类型
const industryTypeOptions = ref<any[]>([]);
// 支付类型
const payTypeOptions = ref<any[]>([]);
const flowEdit = ref<Flow | any>({
  flowType: "",
  loanType: "",
  counterparty: "",
  relatedFlowId: null,
  fromAccountId: undefined,
  toAccountId: undefined,
  eliminate: 0,
});

// 计算是否显示借贷字段
const showLoanFields = computed(() => {
  return flowEdit.value.flowType === "借贷";
});

// 是否为转账/借贷类型
const isTransferLike = computed(() => {
  return flowEdit.value.flowType === "转账" || flowEdit.value.flowType === "借贷";
});

const nameList = ref<string[]>([]);
const getNames = async () => {
  const res = await doApi.post<string[]>("api/entry/flow/getNames", {
    bookId: localStorage.getItem("bookId"),
  });
  nameList.value = res;
};
getNames();

const attributionList = ref<string[]>([]);
const getAttributions = async () => {
  const res = await doApi.post<string[]>("api/entry/flow/getAttributions", {
    bookId: localStorage.getItem("bookId"),
  });
  attributionList.value = res;
};
getAttributions();

// 账户相关
const showAccountField = ref(false);
const accountList = ref<any[]>([]);

// 获取账户列表
const getAccounts = async () => {
  try {
    const res = await doApi.post<any[]>("api/entry/account/list", {
      includeInactive: false
    });
    if (res && res.length > 0) {
      showAccountField.value = true;
      accountList.value = res;
      // 如果是转账编辑，且预填的账户不在启用列表中，提醒用户先启用
      if (flowEdit.value.flowType === "转账") {
        const fromId = flowEdit.value.fromAccountId;
        const toId = flowEdit.value.toAccountId;
        if (fromId && !accountList.value.some((a) => a.id === fromId)) {
          Alert.info("所选转出账户已被禁用，请先到账户管理启用后再编辑转账");
        }
        if (toId && !accountList.value.some((a) => a.id === toId)) {
          Alert.info("所选转入账户已被禁用，请先到账户管理启用后再编辑转账");
        }
      }
    }
  } catch (error) {
    // 如果账户功能未启用，静默失败，不影响现有功能
    console.log("账户功能未启用");
  }
};

onMounted(() => {
  // console.log("flow", flow);
  if (flow) {
    flowEdit.value = { ...flow };
    // 兼容：当仅有 account 对象时，回填 accountId
    if (!flowEdit.value.accountId && (flow as any).account && (flow as any).account.id) {
      flowEdit.value.accountId = (flow as any).account.id;
    }
    
    // 处理借贷类型的预填充
    if (flowEdit.value.attribution === '借贷' || flowEdit.value.flowType === '借贷' || flowEdit.value.loanType) {
      // 借贷类型时强制使用借贷流水类型
      flowEdit.value.flowType = '借贷';
      // 预填充借贷相关字段
      if (!flowEdit.value.loanType && (flow as any).loanType) {
        flowEdit.value.loanType = (flow as any).loanType;
      }
      if (!flowEdit.value.counterparty && (flow as any).counterparty) {
        flowEdit.value.counterparty = (flow as any).counterparty;
      }
    }
    
    // 兼容：转账编辑时，回填 fromAccountId / toAccountId
    if (flowEdit.value.flowType === "转账" || flowEdit.value.flowType === "借贷") {
      if (!flowEdit.value.fromAccountId) {
        if ((flow as any).fromAccount && (flow as any).fromAccount.id) {
          flowEdit.value.fromAccountId = (flow as any).fromAccount.id;
        } else if ((flow as any).originalTransfer && (flow as any).originalTransfer.fromAccountId) {
          flowEdit.value.fromAccountId = (flow as any).originalTransfer.fromAccountId;
        }
      }
      if (!flowEdit.value.toAccountId) {
        if ((flow as any).toAccount && (flow as any).toAccount.id) {
          flowEdit.value.toAccountId = (flow as any).toAccount.id;
        } else if ((flow as any).originalTransfer && (flow as any).originalTransfer.toAccountId) {
          flowEdit.value.toAccountId = (flow as any).originalTransfer.toAccountId;
        }
      }
    }
    if (flowEdit.value.day) {
      flowEdit.value.day = flowEdit.value.day;
    }
  }
  if (formTitle[0] === title) {
    const day =
      (flow && (flow as any).day) || new Date().toISOString().split("T")[0];
    flowEdit.value = { flowType: "", day } as any;
  }
  // 清除 id，避免新增逻辑走更新分支
  if (formTitle[0] === title && (flowEdit.value as any).id) {
    delete (flowEdit.value as any).id;
  }
  // 根据当前 flowType 联动标签与选项
  changeFlowTypes();
  
  // 获取账户列表
  getAccounts();

  // 初始化不计收支开关
  notInOutChecked.value = Number(flowEdit.value.eliminate || 0) === 1;
});

// 每次打开弹窗时，根据标题判定并重置表单，避免误把新增识别为修改

// 修改FlowType后联动
const changeFlowTypes = () => {
  if (flowEdit.value.flowType === "支出") {
    industryTypeLabel.value = "支出类型";
    payTypeLabel.value = "支付方式";
  } else if (flowEdit.value.flowType === "收入") {
    industryTypeLabel.value = "收入类型";
    payTypeLabel.value = "收款方式";
  } else if (flowEdit.value.flowType === "转账") {
    industryTypeLabel.value = "转账";
    payTypeLabel.value = "转账";
    flowEdit.value.industryType = "转账";
    flowEdit.value.payType = "转账";
  } else if (flowEdit.value.flowType === "借贷") {
    industryTypeLabel.value = "支出类型/收入类型";
    payTypeLabel.value = "支付方式/收款方式";
    // 借贷类型不自动设置 industryType 和 payType，让用户选择
    if (!flowEdit.value.industryType) {
      flowEdit.value.industryType = "";
    }
    if (!flowEdit.value.payType) {
      flowEdit.value.payType = "";
    }
  } else {
    industryTypeLabel.value = "支出类型/收入类型";
    payTypeLabel.value = "支付方式/收款方式";
  }

  // 为借贷类型提供专门的选项
  if (flowEdit.value.flowType === "借贷") {
    // 借贷类型不显示在支出/收入类型中，只在专门的借贷类型字段中显示
    industryTypeOptions.value = [];
    payTypeOptions.value = ["现金", "银行转账", "支付宝", "微信", "信用卡", "其他"];
  } else {
    getIndustryType(flowEdit.value.flowType || "").then((data) => {
      industryTypeOptions.value = data.map((d) => {
        return d.industryType;
      });
    });
    getPayType(flowEdit.value.flowType || "").then((data) => {
      payTypeOptions.value = data.map((d) => {
        return d.payType;
      });
    });
  }
};
changeFlowTypes();

// 不计收支处理（仅标记 eliminate，不改变 flowType 以保留余额方向）
const notInOutChecked = ref(false);
const onToggleNotInOut = () => {
  flowEdit.value.eliminate = notInOutChecked.value ? 1 : 0;
};

// 借贷类型变化处理
const onLoanTypeChange = () => {
  // 借贷类型不需要同步到支出/收入类型，保持独立
  // 这里可以添加其他逻辑，比如根据借贷类型调整其他字段
};

// 添加筛选相关的响应式变量
const industryTypeSearchText = ref("");
const payTypeSearchText = ref("");

// 计算属性：筛选后的选项
const filteredIndustryTypeOptions = computed(() => {
  if (!industryTypeSearchText.value) {
    return industryTypeOptions.value;
  }
  return industryTypeOptions.value.filter((item) =>
    item.toLowerCase().includes(industryTypeSearchText.value.toLowerCase())
  );
});

const filteredPayTypeOptions = computed(() => {
  if (!payTypeSearchText.value) {
    return payTypeOptions.value;
  }
  return payTypeOptions.value.filter((item) =>
    item.toLowerCase().includes(payTypeSearchText.value.toLowerCase())
  );
});

// 归属与名称的前端过滤
const attributionSearchText = ref("");
const nameSearchText = ref("");

const filteredAttributionList = computed(() => {
  if (!attributionSearchText.value) return attributionList.value;
  return attributionList.value.filter((item) =>
    item.toLowerCase().includes(attributionSearchText.value.toLowerCase())
  );
});

const filteredNameList = computed(() => {
  if (!nameSearchText.value) return nameList.value;
  return nameList.value.filter((item) =>
    item.toLowerCase().includes(nameSearchText.value.toLowerCase())
  );
});

// 键盘导航：活动索引（响应式）
const industryActiveIndex = ref(0);
const payTypeActiveIndex = ref(0);
const attributionActiveIndex = ref(0);
const nameActiveIndex = ref(0);

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return -1;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
};

const onIndustryKeydown = (e: KeyboardEvent) => {
  const list = filteredIndustryTypeOptions.value;
  if (
    !showIndustryTypeDropdown.value &&
    (e.key === "ArrowDown" || e.key === "ArrowUp")
  ) {
    showIndustryTypeDropdown.value = true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    industryActiveIndex.value = clampIndex(
      industryActiveIndex.value + 1,
      list.length
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    industryActiveIndex.value = clampIndex(
      industryActiveIndex.value - 1,
      list.length
    );
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (
      industryActiveIndex.value >= 0 &&
      industryActiveIndex.value < list.length
    ) {
      selectIndustryType(list[industryActiveIndex.value]);
    }
  } else if (e.key === "Escape") {
    showIndustryTypeDropdown.value = false;
  }
};

const onPayTypeKeydown = (e: KeyboardEvent) => {
  const list = filteredPayTypeOptions.value;
  if (
    !showPayTypeDropdown.value &&
    (e.key === "ArrowDown" || e.key === "ArrowUp")
  ) {
    showPayTypeDropdown.value = true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    payTypeActiveIndex.value = clampIndex(
      payTypeActiveIndex.value + 1,
      list.length
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    payTypeActiveIndex.value = clampIndex(
      payTypeActiveIndex.value - 1,
      list.length
    );
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (
      payTypeActiveIndex.value >= 0 &&
      payTypeActiveIndex.value < list.length
    ) {
      selectPayType(list[payTypeActiveIndex.value]);
    }
  } else if (e.key === "Escape") {
    showPayTypeDropdown.value = false;
  }
};

const onAttributionKeydown = (e: KeyboardEvent) => {
  const list = attributionList.value;
  if (
    !showAttributionDropdown.value &&
    (e.key === "ArrowDown" || e.key === "ArrowUp")
  ) {
    showAttributionDropdown.value = true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    attributionActiveIndex.value = clampIndex(
      attributionActiveIndex.value + 1,
      list.length
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    attributionActiveIndex.value = clampIndex(
      attributionActiveIndex.value - 1,
      list.length
    );
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (
      attributionActiveIndex.value >= 0 &&
      attributionActiveIndex.value < list.length
    ) {
      selectAttribution(list[attributionActiveIndex.value]);
    }
  } else if (e.key === "Escape") {
    showAttributionDropdown.value = false;
  }
};

const onNameKeydown = (e: KeyboardEvent) => {
  const list = nameList.value;
  if (
    !showNameDropdown.value &&
    (e.key === "ArrowDown" || e.key === "ArrowUp")
  ) {
    showNameDropdown.value = true;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    nameActiveIndex.value = clampIndex(nameActiveIndex.value + 1, list.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    nameActiveIndex.value = clampIndex(nameActiveIndex.value - 1, list.length);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (nameActiveIndex.value >= 0 && nameActiveIndex.value < list.length) {
      selectName(list[nameActiveIndex.value]);
    }
  } else if (e.key === "Escape") {
    showNameDropdown.value = false;
  }
};

// 下拉框处理方法
const hideIndustryTypeDropdown = () => {
  setTimeout(() => {
    showIndustryTypeDropdown.value = false;
  }, 200);
};

const hidePayTypeDropdown = () => {
  setTimeout(() => {
    showPayTypeDropdown.value = false;
  }, 200);
};

const hideAttributionDropdown = () => {
  setTimeout(() => {
    showAttributionDropdown.value = false;
  }, 200);
};

const hideNameDropdown = () => {
  setTimeout(() => {
    showNameDropdown.value = false;
  }, 200);
};

const selectIndustryType = (item: string) => {
  flowEdit.value.industryType = item;
  showIndustryTypeDropdown.value = false;
};

const selectPayType = (item: string) => {
  flowEdit.value.payType = item;
  showPayTypeDropdown.value = false;
};

const selectAttribution = (item: string) => {
  flowEdit.value.attribution = item;
  showAttributionDropdown.value = false;
};

const selectName = (item: string) => {
  flowEdit.value.name = item;
  showNameDropdown.value = false;
};

// 提交表单（新增或修改）
const confirmForm = async (again: boolean) => {
  if (!flowEdit.value.flowType || !flowEdit.value.money) {
    Alert.error("请填写必要信息");
    return;
  }
  if (isTransferLike.value) {
    if (!flowEdit.value.fromAccountId || !flowEdit.value.toAccountId || flowEdit.value.fromAccountId === flowEdit.value.toAccountId) {
      Alert.error("请选择两个不同的账户");
      return;
    }
    // 借贷类型需要验证借贷类型（借贷对象可选）
    if (flowEdit.value.flowType === "借贷") {
      if (!flowEdit.value.loanType) {
        Alert.error("请选择借贷类型");
        return;
      }
      // 借贷对象现在是可选的，不需要强制验证
    }
  } else {
    if (!flowEdit.value.accountId) {
      Alert.error("请选择账户");
      return;
    }
  }
  if (flowEdit.value.id) {
    // 修改
    updateOne();
  } else {
    // 新增
    createOne(again);
  }
};

// 创建
const createOne = (again: boolean) => {
  const day = flowEdit.value.day || new Date().toISOString().split("T")[0];
  if (isTransferLike.value) {
    // 使用统一的转账API
    const transferType = flowEdit.value.flowType === "借贷" ? "loan" : "transfer";
    
    doApi
      .post("api/entry/unified-transfer/add", {
        bookId: localStorage.getItem("bookId"),
        transferType: transferType,
        fromAccountId: flowEdit.value.fromAccountId,
        toAccountId: flowEdit.value.toAccountId,
        amount: Number(flowEdit.value.money),
        day,
        name: flowEdit.value.name || (transferType === 'loan' ? '借贷' : '账户转账'),
        description: flowEdit.value.description,
        loanType: flowEdit.value.loanType,
        counterparty: flowEdit.value.counterparty
      })
      .then(() => {
        successCallback({} as any);
        Alert.success("新增成功!");
        showFlowEditDialog.value = again;
        if (again) {
          flowEdit.value.money = undefined;
          flowEdit.value.name = undefined;
          flowEdit.value.description = undefined;
        }
      })
      .catch((err) => {
        console.error(err);
        Alert.error("新增出现异常");
      });
  } else {
    doApi
      .post<Flow>("api/entry/flow/add", {
        bookId: localStorage.getItem("bookId") || "",
        day,
        flowType: flowEdit.value.flowType,
        industryType: flowEdit.value.industryType,
        payType: flowEdit.value.payType,
        name: flowEdit.value.name,
        money: Number(flowEdit.value.money),
        description: flowEdit.value.description,
        attribution: flowEdit.value.attribution,
        invoice: flowEdit.value.invoice,
        accountId: flowEdit.value.accountId || null,
        eliminate: Number(flowEdit.value.eliminate || 0),
      })
      .then((res) => {
        if (res.id) {
          successCallback(res);
          Alert.success("新增成功!");
          showFlowEditDialog.value = again;
          if (again) {
            flowEdit.value.money = undefined;
            flowEdit.value.name = undefined;
            flowEdit.value.description = undefined;
          }
        }
      })
      .catch(() => {
        Alert.error("新增出现异常");
      });
  }
};

// 更新
const updateOne = () => {
  if (!flowEdit.value.id) {
    Alert.error("请选择要修改的数据");
    return;
  }
  if (isTransferLike.value) {
    // 转账编辑：使用后端转账更新（删除后重建）
    const transferId = (flowEdit.value as any).transferId || (flowEdit.value as any).originalTransfer?.id;
    if (!transferId) {
      Alert.error("未找到转账记录ID");
      return;
    }
    doApi
      .post("api/entry/transfer/update", {
        id: transferId,
        bookId: localStorage.getItem("bookId") || "",
        fromAccountId: flowEdit.value.fromAccountId,
        toAccountId: flowEdit.value.toAccountId,
        amount: Number(flowEdit.value.money),
        day: flowEdit.value.day || new Date().toISOString().split("T")[0],
        name: flowEdit.value.name,
        description: flowEdit.value.description,
      })
      .then(() => {
        successCallback({} as any);
        Alert.success("更新成功!");
        showFlowEditDialog.value = false;
      })
      .catch((err) => {
        console.log(err);
        Alert.error("更新出现异常" + err.message);
      });
  } else {
    doApi
      .post<Flow>("api/entry/flow/update", {
        id: flowEdit.value.id,
        day: flowEdit.value.day || new Date().toISOString().split("T")[0],
        bookId: localStorage.getItem("bookId") || "",
        flowType: flowEdit.value.flowType,
        industryType: flowEdit.value.industryType,
        money: Number(flowEdit.value.money),
        payType: flowEdit.value.payType,
        name: flowEdit.value.name,
        description: flowEdit.value.description,
        attribution: flowEdit.value.attribution,
        invoice: flowEdit.value.invoice,
        // 新增账户字段
        accountId: flowEdit.value.accountId || null,
        eliminate: Number(flowEdit.value.eliminate || 0),
      })
      .then((res) => {
        if (res.id) {
          successCallback(res);
          Alert.success("更新成功!");
          showFlowEditDialog.value = false;
          
          // 触发图表刷新事件
          window.dispatchEvent(new CustomEvent('flow-updated', { 
            detail: { flowId: res.id, action: 'update' } 
          }));
        }
      })
      .catch((err) => {
        console.log(err);
        Alert.error("更新出现异常" + err.message);
      });
  }
};

const closeDialog = () => {
  showFlowEditDialog.value = false;
};
</script>
