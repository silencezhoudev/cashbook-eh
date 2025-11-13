<template>
  <div class="bg-gray-50 dark:bg-gray-900 p-0 md:p-4">
    <!-- Header Section -->
    <div class="max-w-7xl mx-auto">
      <!-- Summary Cards -->
      <div
        class="grid grid-cols-3 gap-2 md:gap-4 mb-4 mx-2 md:mx-0 mt-4 md:mt-0"
      >
        <!-- Income Card -->
        <div
          class="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-lg p-2 md:p-4 border border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105"
          @click="clickDay('', '收入')"
        >
          <div class="flex items-center flex-row space-x-2">
            <div class="flex-shrink-0 mb-0">
              <div
                class="w-8 h-8 md:w-12 md:h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center"
              >
                <ArrowTrendingUpIcon
                  class="w-4 h-4 md:w-6 md:h-6 text-green-700 dark:text-green-300"
                />
              </div>
            </div>
            <div class="md:ml-4 text-center md:text-left">
              <p
                class="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                总收入
              </p>
              <p
                class="text-sm md:text-2xl font-bold text-green-700 dark:text-green-300"
              >
                {{ getInMonth().toFixed(2) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Expense Card -->
        <div
          class="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-lg p-2 md:p-4 border border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105"
          @click="clickDay('', '支出')"
        >
          <div class="flex items-center flex-row space-x-2">
            <div class="flex-shrink-0 mb-0">
              <div
                class="w-8 h-8 md:w-12 md:h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center"
              >
                <ArrowTrendingDownIcon
                  class="w-4 h-4 md:w-6 md:h-6 text-red-700 dark:text-red-300"
                />
              </div>
            </div>
            <div class="md:ml-4 text-center md:text-left">
              <p
                class="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                总支出
              </p>
              <p
                class="text-sm md:text-2xl font-bold text-red-700 dark:text-red-300"
              >
                {{ getOutMonth().toFixed(2) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Balance Card -->
        <div
          class="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl shadow-lg p-2 md:p-4 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center flex-row space-x-2">
            <div class="flex-shrink-0 mb-0">
              <div
                class="w-8 h-8 md:w-12 md:h-12 rounded-lg flex items-center justify-center"
                :class="
                  balance >= 0
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'bg-orange-100 dark:bg-orange-900'
                "
              >
                <ScaleIcon
                  class="w-4 h-4 md:w-6 md:h-6"
                  :class="
                    balance >= 0
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-orange-700 dark:text-orange-300'
                  "
                />
              </div>
            </div>
            <div class="md:ml-4 text-center md:text-left">
              <p
                class="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                结余
              </p>
              <p
                class="text-sm md:text-2xl font-bold"
                :class="
                  balance >= 0
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-orange-700 dark:text-orange-300'
                "
              >
                {{ balance.toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Calendar -->
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full"
        :class="
          isMobile
            ? 'rounded-lg shadow-md'
            : 'rounded-xl shadow-lg overflow-hidden'
        "
      >
        <!-- Desktop Calendar -->
        <div v-if="!isMobile" class="w-full">
          <DesktopCalendar
            :current-date="nowDate"
            :income-data="inDayCount"
            :expense-data="outDayCount"
            @add-flow="handleDesktopAddFlow"
            @click-day="clickDay"
            @month-change="handleDesktopMonthChange"
            @show-analysis="showMonthAnalysis"
            @show-book-selection="showBookSelectionDialog = true"
          @show-flows="showAllFlows"
          />
        </div>

        <!-- Mobile Calendar -->
        <div v-else class="p-0">
          <MobileCalendar
            :current-date="nowDate"
            :income-data="inDayCount"
            :expense-data="outDayCount"
            @add-flow="handleMobileAddFlow"
            @click-day="clickDay"
            @month-change="handleMobileMonthChange"
            @show-analysis="showMonthAnalysis"
            @show-book-selection="showBookSelectionDialog = true"
          @show-flows="showAllFlows"
          />
        </div>
      </div>
    </div>

    <!-- Month Analysis Dialog -->
    <div
      v-if="monthAnalysisDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50"
      @click="monthAnalysisDialog = false"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full"
        @click.stop
      >
        <div
          class="flex items-center justify-between p-2 md:p-6 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <ChartBarIcon class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ monthTitle }} 流水分析
            </h3>
          </div>
          <button
            @click="monthAnalysisDialog = false"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div class="p-2 md:p-4 max-h-[70vh] overflow-y-auto">
          <DatasMonthAnalysis :data="monthAnalysisData" />
        </div>
      </div>
    </div>

    <!-- Flow Table Dialog -->
    <div
      v-if="showFlowTable && flowTableQuery"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50"
      @click="closeFlowTable"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[80vh] overflow-hidden"
        @click.stop
      >
        <div
          class="flex items-center justify-between p-2 md:p-3 border-b border-gray-200 dark:border-gray-700"
        >
          <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">
            {{ flowTableQuery.startDay }} - {{ flowTableQuery.endDay }} - {{ flowTableQuery.flowType || '全部流水' }}
          </h2>
          <button
            @click="closeFlowTable"
            class="md:px-3 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-xs md:font-sm"
          >
            关闭
          </button>
        </div>

        <div class="p-2 md:p-4 overflow-y-auto">
          <DatasFlowTable
            ref="flowTableRef"
            :query="flowTableQuery"
            v-if="showFlowTable"
            @edit-item="editItem"
            :actions="true"
          />
        </div>
      </div>
    </div>

    <!-- Add Flow Dialog -->
    <FlowEditDialog
      v-if="showFlowEditDialog"
      :title="dialogFormTitle"
      :flow="selectedFlow"
      :success-callback="addFlowSuccess"
    />

    <!-- Book Selection Dialog -->
    <div
      v-if="showBookSelectionDialog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50"
      @click="showBookSelectionDialog = false"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full"
        @click.stop
      >
        <div
          class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            选择显示的账本
          </h3>
          <button
            @click="showBookSelectionDialog = false"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div class="p-4 max-h-96 overflow-y-auto">
          <div class="space-y-3">
            <div
              v-for="book in availableBooks"
              :key="book.bookId"
              class="flex items-center space-x-3"
            >
              <input
                :id="`book-${book.bookId}`"
                v-model="selectedBookIds"
                :value="book.bookId"
                type="checkbox"
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                :for="`book-${book.bookId}`"
                class="flex items-center cursor-pointer"
              >
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ book.bookName }}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            @click="showBookSelectionDialog = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
          >
            取消
          </button>
          <button
            @click="applyBookSelection"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  ChartBarIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/vue/24/outline";

import FlowEditDialog from "~/components/dialog/FlowEditDialog.vue";
import MobileCalendar from "~/components/ui/MobileCalendar.vue";
import DesktopCalendar from "~/components/ui/DesktopCalendar.vue";
import DatasFlowTable from "~/components/datas/FlowTable.vue";
import { showFlowEditDialog } from "~/utils/flag";
import { daily, getBooksWithColors, multiBookDaily } from "~/utils/apis";
import { dateFormater } from "~/utils/common";
import { doApi } from "~/utils/api";
import type { CommonChartQuery, MonthAnalysis, FlowQuery, Flow, Book, MultiBookCalendarData } from "~/utils/model";

definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

// 编辑相关
const selectedFlow = ref<Flow | any>({});
const dialogFormTitle = ref("新增流水");
const formTitle = ["新增流水", "修改流水"];
const flowTableRef = ref();

const editItem = (item: any) => {
  dialogFormTitle.value = formTitle[1];
  selectedFlow.value = item;
  showFlowEditDialog.value = true;
};

// Theme detection
const isDark = ref(false);

// Responsive detection
const isMobile = ref(false);

// Current date and navigation
const nowDate = ref(new Date());

// Calendar data (removed as now handled by components)

// Data storage
const outMonthCount = ref<Record<string, number>>({});
const outDayCount = ref<Record<string, number>>({});
const inMonthCount = ref<Record<string, number>>({});
const inDayCount = ref<Record<string, number>>({});
const zeroMonthCount = ref<Record<string, number>>({});
const zeroDayCount = ref<Record<string, number>>({});

// Dialog states
const monthAnalysisDialog = ref(false);
const showFlowTable = ref(false);
const monthTitle = ref("");
const showBookSelectionDialog = ref(false);

// Book selection states
const availableBooks = ref<Book[]>([]);
const selectedBookIds = ref<string[]>([]);
const multiBookData = ref<MultiBookCalendarData>({});
const monthAnalysisData = ref<MonthAnalysis>({
  month: "",
  outSum: "0",
  inSum: "0",
  zeroSum: "0",
  maxInType: "",
  maxInTypeSum: "0",
  maxOutType: "",
  maxOutTypeSum: "0",
  maxOut: {} as Flow,
  maxIn: {} as Flow,
  maxZero: {} as Flow,
});

const flowTableQuery = ref<FlowQuery | null>(null);

const buildFlowQuery = (
  startDay: string,
  endDay: string,
  flowType = ""
): FlowQuery => ({
  pageNum: 1,
  pageSize: 100,
  startDay,
  endDay,
  flowType,
  bookId: null,
  selectedBookIds: [...selectedBookIds.value],
});

const openFlowTable = (params: FlowQuery) => {
  flowTableQuery.value = { ...params };
  showFlowTable.value = true;
};

const closeFlowTable = () => {
  showFlowTable.value = false;
  flowTableQuery.value = null;
};

// Computed properties
const balance = computed(() => getInMonth() - getOutMonth());

// Methods
const doQuery = async (param: CommonChartQuery) => {
  return await daily(param);
};

const getInMonth = (): number => {
  const title = dayToMonth(nowDate.value);
  return Number(inMonthCount.value[title] || 0);
};

const getOutMonth = (): number => {
  const title = dayToMonth(nowDate.value);
  return Number(outMonthCount.value[title] || 0);
};

const getZeroMonth = (): number => {
  const title = dayToMonth(nowDate.value);
  return Number(zeroMonthCount.value[title] || 0);
};

// Helper methods moved to components
const dayToMonth = (day: string | Date): string => {
  const date = new Date(day);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString();
  return `${year} 年 ${month} 月`;
};

// getExpenseClass method moved to components

// changeDate method moved to component handlers

const clickDay = (day: string, flowType?: string) => {
  if (day === "") {
    const startDay = dateFormater(
      "YYYY-MM-dd",
      new Date(nowDate.value.getFullYear(), nowDate.value.getMonth(), 1)
    );
    const endDay = dateFormater(
      "YYYY-MM-dd",
      new Date(nowDate.value.getFullYear(), nowDate.value.getMonth() + 1, 0)
    );
    openFlowTable(buildFlowQuery(startDay, endDay, flowType || ""));
    return;
  }

  openFlowTable(buildFlowQuery(day, day, flowType || ""));
};

const showAllFlows = () => {
  const startDay = dateFormater(
    "YYYY-MM-dd",
    new Date(nowDate.value.getFullYear(), nowDate.value.getMonth(), 1)
  );
  const endDay = dateFormater(
    "YYYY-MM-dd",
    new Date(nowDate.value.getFullYear(), nowDate.value.getMonth() + 1, 0)
  );
  openFlowTable(buildFlowQuery(startDay, endDay));
};

// addFlow method moved to component handlers

const handleMobileAddFlow = (date: any) => {
  dialogFormTitle.value = formTitle[0];
  selectedFlow.value = { day: date.dateString };
  showFlowEditDialog.value = true;
};

const handleDesktopAddFlow = (date: any) => {
  dialogFormTitle.value = formTitle[0];
  selectedFlow.value = { day: date.dateString };
  showFlowEditDialog.value = true;
};

const handleMobileMonthChange = (date: Date) => {
  nowDate.value = date;
  fetchMultiBookData();
};

const handleDesktopMonthChange = (date: Date) => {
  nowDate.value = date;
  fetchMultiBookData();
};

const addFlowSuccess = (flow: Flow) => {
  if (flow.flowType === "不计收支") return;
  
  fetchMultiBookData();

  // 刷新 FlowTable 数据
  if (showFlowTable.value && flowTableRef.value && flowTableRef.value.refresh) {
    flowTableRef.value.refresh();
  }
};


const showMonthAnalysis = (month: string) => {
  let monthParam = month
    .replace("年", "-")
    .replace("月", "")
    .replaceAll(" ", "");

  monthTitle.value = month;
  if (monthParam.split("-")[1] && monthParam.split("-")[1].length === 1) {
    monthParam = monthParam.split("-")[0] + "-0" + monthParam.split("-")[1];
  }

  // 始终使用多账本模式，传递选中的账本ID列表
  const requestData = {
    month: monthParam,
    selectedBookIds: selectedBookIds.value,
  };

  doApi
    .post<MonthAnalysis>("api/entry/analytics/monthAnalysis", requestData)
    .then((res) => {
      monthAnalysisData.value = res;
      monthAnalysisDialog.value = true;
    })
    .catch((err) => {
      console.log(err);
    });
};

const initQuery = () => {
  inMonthCount.value = {};
  inDayCount.value = {};
  outMonthCount.value = {};
  outDayCount.value = {};
  zeroMonthCount.value = {};
  zeroDayCount.value = {};

  doQuery({}).then((res) => {
    if (res.length === 0) {
      return;
    }

    res.forEach((data) => {
      const month = dayToMonth(data.type);

      // Update day totals
      outDayCount.value[data.type] = data.outSum;
      inDayCount.value[data.type] = data.inSum;
      zeroDayCount.value[data.type] = data.zeroSum || 0;

      // Update month totals
      const outCount = outMonthCount.value[month] || 0;
      outMonthCount.value[month] = outCount + Number(data.outSum);

      const inCount = inMonthCount.value[month] || 0;
      inMonthCount.value[month] = inCount + Number(data.inSum);

      const zeroCount = zeroMonthCount.value[month] || 0;
      zeroMonthCount.value[month] = zeroCount + Number(data.zeroSum || 0);
    });
  });
};

// 获取账本列表
const fetchBooks = async () => {
  try {
    const books = await getBooksWithColors();
    availableBooks.value = books || [];
    // 默认选中所有账本
    selectedBookIds.value = books?.map(book => book.bookId) || [];
  } catch (error) {
    console.error('Failed to fetch books:', error);
  }
};

// 应用账本选择
const applyBookSelection = async () => {
  if (selectedBookIds.value.length === 0) {
    alert('请至少选择一个账本');
    return;
  }

  // 始终使用多账本模式获取数据
  await fetchMultiBookData();
  
  showBookSelectionDialog.value = false;
};

// 获取多账本数据
const fetchMultiBookData = async () => {
  try {
    const startDate = new Date(nowDate.value.getFullYear(), nowDate.value.getMonth(), 1);
    const endDate = new Date(nowDate.value.getFullYear(), nowDate.value.getMonth() + 1, 0);
    
    const data = await multiBookDaily(selectedBookIds.value, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    multiBookData.value = data;
    
    // 将多账本数据转换为单账本格式，用于日历显示
    convertMultiBookToSingleBook();
  } catch (error) {
    console.error('Failed to fetch multi-book data:', error);
  }
};

// 将多账本数据转换为单账本格式
const convertMultiBookToSingleBook = () => {
  // 重置数据
  inMonthCount.value = {};
  inDayCount.value = {};
  outMonthCount.value = {};
  outDayCount.value = {};
  zeroMonthCount.value = {};
  zeroDayCount.value = {};

  // 遍历多账本数据，按日期汇总
  Object.entries(multiBookData.value).forEach(([date, bookData]) => {
    let dayIncome = 0;
    let dayExpense = 0;
    let dayZero = 0;

    // 汇总该日期所有选中账本的数据
    Object.values(bookData).forEach((bookFlow: any) => {
      dayIncome += bookFlow.income || 0;
      dayExpense += bookFlow.expense || 0;
      dayZero += bookFlow.zero || 0;
    });

    // 更新日数据
    inDayCount.value[date] = dayIncome;
    outDayCount.value[date] = dayExpense;
    zeroDayCount.value[date] = dayZero;

    // 更新月数据
    const month = dayToMonth(date);
    outMonthCount.value[month] = (outMonthCount.value[month] || 0) + dayExpense;
    inMonthCount.value[month] = (inMonthCount.value[month] || 0) + dayIncome;
    zeroMonthCount.value[month] = (zeroMonthCount.value[month] || 0) + dayZero;
  });
};

// Theme detection
const checkTheme = () => {
  isDark.value = document.documentElement.classList.contains("dark");
};

// Responsive detection
const updateResponsive = () => {
  if (typeof window !== "undefined") {
    isMobile.value = window.innerWidth < 1024;
  }
};

onMounted(async () => {
  checkTheme();
  updateResponsive();
  await fetchBooks(); // 获取账本列表
  // 使用多账本模式初始化数据
  await fetchMultiBookData();

  // Watch for theme changes
  const themeObserver = new MutationObserver(checkTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Watch for screen size changes
  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateResponsive);
  }

  return () => {
    themeObserver.disconnect();
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", updateResponsive);
    }
  };
});
</script>

<style scoped>
/* 自定义日历样式 */
</style>
