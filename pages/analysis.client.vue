<template>
  <div class="w-full">
    <!-- 模式切换器 -->
    <div class="mb-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">数据分析</h2>
        <div class="flex items-center space-x-4">
          <!-- 年份筛选器 -->
          <div class="min-w-32">
            <select
              v-model="selectedYear"
              @change="onYearChange"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-md bg-white dark:bg-gray-700 text-green-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">全部年份</option>
              <option v-for="year in availableYears" :key="year" :value="year">
                {{ year }}年
              </option>
            </select>
          </div>
          
        </div>
      </div>
    </div>


    <!-- Content Area -->
    <div class="md:max-w-[80vw] mx-auto w-full mt-2">
      <!-- Desktop & Tablet: Chart Carousel -->
      <div class="w-full" v-if="!loading">
        <div
          class="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-2 md:p-4 mb-4"
        >
          <!-- Chart Container -->
          <div
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <CompatibleMonthlyAssetCumulativeChart
                ref="monthlyAssetChartRef"
                title="月度资产累计"
                width="100%"
                height="300px"
                :selectedYear="selectedYear"
              />
            </div>
            <div class="w-full">
              <SelectedMonthInOutBar title="当月收支柱状图" width="100%" height="320px" :selectedYear="selectedYear" @bar-click="onMonthBarClick" />
            </div>
          </div>
        </div>
        <div
          class="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-2 md:p-4 mb-4"
        >
          <!-- Chart Container -->
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-green-950 dark:text-white">
              支出分析
            </h3>
            <!-- 图表类型切换 -->
            <!-- <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                @click="expenseChartType = 'pie'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  expenseChartType === 'pie'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                ]"
              >
                饼图
              </button>
              <button
                @click="expenseChartType = 'bar'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  expenseChartType === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                ]"
              >
                柱图
              </button>
            </div> -->
          </div>

          <!-- 饼图展示 -->
          <div
            v-if="expenseChartType === 'pie'"
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <MultiBookCommonPie
                title="消费类型分析"
                width="100%"
                height="300px"
                groupBy="industryType"
                flowType="支出"
                seriesName="消费类型"
                :showLegend="true"
                queryField="industryType"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
                @category-selected="onCategorySelected"
              />
            </div>
            <div class="w-full">
              <IndustryTypeSecondaryPie
                title="消费类型详细分析"
                width="100%"
                height="300px"
                :selectedCategory="selectedIndustryCategory"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
                @secondary-category-clicked="onSecondaryCategoryClicked"
              />
            </div>
          </div>

          <!-- 柱图展示 -->
          <div
            v-if="expenseChartType === 'bar'"
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <MultiBookCommonBar
                title="消费类型分析"
                width="100%"
                height="300px"
                groupBy="industryType"
                flowType="支出"
                seriesName="消费类型"
                :showLegend="true"
                queryField="industryType"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
              />
            </div>
            <div class="w-full">
              <MultiBookCommonBar
                title="消费归属分析"
                width="100%"
                height="300px"
                groupBy="attribution"
                flowType="支出"
                seriesName="消费归属"
                :showLegend="true"
                queryField="attribution"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
              />
            </div>
          </div>
        </div>
        <div
          class="w-full bg-white dark:bg-gray-900 rounded-lg shadow p-2 md:p-4 mb-4"
        >
          <!-- Chart Container -->
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-green-950 dark:text-white">
              收入分析
            </h3>
            <!-- 图表类型切换 -->
            <!-- <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                @click="incomeChartType = 'pie'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  incomeChartType === 'pie'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                ]"
              >
                饼图
              </button>
              <button
                @click="incomeChartType = 'bar'"
                :class="[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  incomeChartType === 'bar'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                ]"
              >
                柱图
              </button>
            </div> -->
          </div>

          <!-- 饼图展示 -->
          <div
            v-if="incomeChartType === 'pie'"
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <MultiBookCommonPie
                title="收入类型分析"
                width="100%"
                height="300px"
                groupBy="industryType"
                flowType="收入"
                seriesName="收入类型"
                :showLegend="true"
                queryField="industryType"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
                @category-selected="onIncomeCategoryClick"
              />
            </div>
            <div class="w-full">
              <AccountDeltaPie
                title="账户余额增长（较年初）"
                width="100%"
                height="300px"
                :selectedYear="selectedYear"
                @account-click="onAccountSliceClick"
              />
            </div>
          </div>

          <!-- 柱图展示 -->
          <div
            v-if="incomeChartType === 'bar'"
            class="w-full flex flex-col md:flex-row justify-between md:space-x-4 space-y-4 md:space-y-0 rounded-md p-2"
          >
            <div class="w-full border-b md:border-b-0 md:border-r">
              <MultiBookCommonBar
                title="收入类型分析"
                width="100%"
                height="300px"
                groupBy="industryType"
                flowType="收入"
                seriesName="收入类型"
                :showLegend="true"
                queryField="industryType"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
              />
            </div>
            <div class="w-full">
              <MultiBookCommonBar
                title="收入归属分析"
                width="100%"
                height="300px"
                groupBy="attribution"
                flowType="收入"
                seriesName="收入归属"
                :showLegend="true"
                queryField="attribution"
                :startDay="getTimeRange().startDay"
                :endDay="getTimeRange().endDay"
                :bookIds="getAllBookIds"
                :books="bookState.books"
              />
            </div>
          </div>
        </div>
    </div>
  </div>

  <!-- 二级分类流水明细弹窗 -->
  <CategoryFlowsDialog
    :show="showCategoryDialog"
    :bookIds="getAllBookIds"
    :primaryCategory="selectedIndustryCategory"
    :secondaryCategory="selectedSecondaryCategory"
    :startDay="getTimeRange().startDay"
    :endDay="getTimeRange().endDay"
    @close="showCategoryDialog = false"
  />
  
  <!-- 账户流水明细弹窗（所有账本） -->
  <AccountFlowsDialog
    :show="showAccountFlowsDialog"
    :account="selectedAccountForDialog"
    :startDay="getTimeRange().startDay"
    :endDay="getTimeRange().endDay"
    @close="showAccountFlowsDialog = false"
  />

  <!-- 收入类型饼图点击弹出：多账本流水表 -->
  <IncomeFlowsDialog
    :show="showIncomeFlowTable"
    :bookIds="getAllBookIds"
    :industryType="selectedIncomeCategory"
    :startDay="getTimeRange().startDay"
    :endDay="getTimeRange().endDay"
    @close="showIncomeFlowTable = false"
  />

  <!-- 当月收支柱状图柱子点击弹窗 -->
  <CategoryFlowsDialog
    :show="showMonthBarCategoryDialog"
    :bookIds="getAllBookIds"
    :primaryCategory="selectedMonthBarCategory"
    :secondaryCategory="''"
    :startDay="selectedMonthBarStartDay"
    :endDay="selectedMonthBarEndDay"
    :flowType="selectedMonthBarType"
    :books="bookState.books"
    :actualIndustryTypes="selectedMonthBarActualIndustryTypes"
    :actualBookNames="selectedMonthBarActualBookNames"
    @close="showMonthBarCategoryDialog = false"
  />
  </div>
</template>

<script setup lang="ts">
import {
  TagIcon,
  CreditCardIcon,
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
} from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useBookState } from "~/composables/useBookState";
import { doApi } from "~/utils/api";
import CompatibleMonthlyAssetCumulativeChart from "~/components/charts/CompatibleMonthlyAssetCumulativeChart.vue";
import CompatibleMonthBar from "~/components/charts/CompatibleMonthBar.vue";
import SelectedMonthInOutBar from "~/components/charts/SelectedMonthInOutBar.vue";
import CompatibleCommonPie from "~/components/charts/CompatibleCommonPie.vue";
import CompatibleCommonBar from "~/components/charts/CompatibleCommonBar.vue";
import MultiBookCommonPie from "~/components/charts/MultiBookCommonPie.vue";
import MultiBookCommonBar from "~/components/charts/MultiBookCommonBar.vue";
import IndustryTypeSecondaryPie from "~/components/charts/IndustryTypeSecondaryPie.vue";
import AccountDeltaPie from "~/components/charts/AccountDeltaPie.vue";
import AccountFlowsDialog from "~/components/dialog/AccountFlowsDialog.vue";
import CategoryFlowsDialog from "~/components/dialog/CategoryFlowsDialog.vue";
import IncomeFlowsDialog from "~/components/dialog/IncomeFlowsDialog.vue";
import DatasFlowTable from "~/components/datas/FlowTable.vue";

const { bookState, init } = useBookState();

// 图表组件引用
const monthlyAssetChartRef = ref();

// 监听流水更新事件
const handleFlowUpdate = () => {
  console.log('检测到流水更新，刷新图表数据');
  // 刷新月度资产累计图表
  if (monthlyAssetChartRef.value && monthlyAssetChartRef.value.refresh) {
    monthlyAssetChartRef.value.refresh();
  }
};

// 计算属性：获取所有账本ID（用于收入分析）
const getAllBookIds = computed(() => {
  // 总账本分析模式下，返回所有账本ID
  return bookState.value.books.map(book => book.bookId);
});

const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1200
);

// 图表类型切换状态
const expenseChartType = ref<"pie" | "bar">("pie");
const incomeChartType = ref<"pie" | "bar">("pie");

// 选中的消费类型分类
const selectedIndustryCategory = ref<string>("");
const selectedSecondaryCategory = ref<string>("");
const showCategoryDialog = ref(false);
const showAccountFlowsDialog = ref(false);
const selectedAccountForDialog = ref<any>(null);
const showIncomeFlowTable = ref(false);
const selectedIncomeCategory = ref<string>("");

// 年份筛选相关状态
const selectedYear = ref(new Date().getFullYear().toString());
const availableYears = ref<string[]>([]);

// 计算年份范围
const getYearRange = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year++) {
    years.push(year.toString());
  }
  return years;
};

// 年份变化处理
const onYearChange = () => {
  console.log('年份变化:', selectedYear.value);
  // 触发月度资产累计图表刷新
  if (monthlyAssetChartRef.value && monthlyAssetChartRef.value.refresh) {
    monthlyAssetChartRef.value.refresh();
  }
};

// 消费类型选择处理
const onCategorySelected = (category: string) => {
  // 仅更新右侧饼图所需的一级分类，不弹窗
  selectedIndustryCategory.value = category;
  selectedSecondaryCategory.value = "";
};

// 二级分类点击，打开明细弹窗
const onSecondaryCategoryClicked = (primaryCategory: string, secondaryCategory: string) => {
  selectedIndustryCategory.value = primaryCategory;
  selectedSecondaryCategory.value = secondaryCategory;
  showCategoryDialog.value = true;
};

// 账户扇区点击，打开账户流水明细（所有账本）
const onAccountSliceClick = (payload: { accountId: number; accountName: string }) => {
  selectedAccountForDialog.value = { id: payload.accountId, name: payload.accountName };
  showAccountFlowsDialog.value = true;
};

// 收入类型饼图扇区点击，打开跨账本流水表（flowType=收入 & industryType=所选）
const onIncomeCategoryClick = (category: string) => {
  selectedIncomeCategory.value = category;
  showIncomeFlowTable.value = true;
};

// 当月收支柱状图柱子点击弹窗
const showMonthBarCategoryDialog = ref(false);
const selectedMonthBarCategory = ref("");
const selectedMonthBarType = ref("");
const selectedMonthBarMonth = ref("");
const selectedMonthBarActualIndustryTypes = ref<string[] | undefined>(undefined);
const selectedMonthBarActualBookNames = ref<string[] | undefined>(undefined);

const onMonthBarClick = (data: { flowType: string; category: string; month: string; actualIndustryTypes?: string[]; actualBookNames?: string[] }) => {
  selectedMonthBarCategory.value = data.category;
  selectedMonthBarType.value = data.flowType;
  selectedMonthBarMonth.value = data.month;
  selectedMonthBarActualIndustryTypes.value = data.actualIndustryTypes;
  selectedMonthBarActualBookNames.value = data.actualBookNames;
  showMonthBarCategoryDialog.value = true;
};

const selectedMonthBarStartDay = computed(() =>
  selectedMonthBarMonth.value ? `${selectedMonthBarMonth.value}-01` : ''
);
const selectedMonthBarEndDay = computed(() =>
  selectedMonthBarMonth.value ? `${selectedMonthBarMonth.value}-31` : ''
);

// 获取当前月的起止日
const currentMonth = computed(() => {
  const now = new Date();
  const month = now.getMonth() + 1;
  return `${selectedYear.value || now.getFullYear()}-${month.toString().padStart(2, '0')}`;
});
const currentMonthStartDay = computed(() => `${currentMonth.value}-01`);
const currentMonthEndDay = computed(() => `${currentMonth.value}-31`);

// 设置默认选中的消费类型（最大分类）
const setDefaultIndustryCategory = async () => {
  try {
    const response = await doApi.post("api/entry/analytics/multi-book-common", {
      bookIds: getAllBookIds.value,
      groupBy: "industryType",
      flowType: "支出",
      startDay: getTimeRange().startDay,
      endDay: getTimeRange().endDay,
    });
    
    if (response) {
      // 找到金额最大的分类
      let maxCategory = "";
      let maxAmount = 0;
      
      Object.entries(response).forEach(([category, categoryData]: [string, any]) => {
        let totalAmount = 0;
        Object.values(categoryData).forEach((bookData: any) => {
          totalAmount += bookData.outSum || 0;
        });
        
        if (totalAmount > maxAmount) {
          maxAmount = totalAmount;
          maxCategory = category;
        }
      });
      
      if (maxCategory) {
        selectedIndustryCategory.value = maxCategory;
      }
    }
  } catch (error) {
    console.error('Failed to set default industry category:', error);
  }
};

// 获取时间范围
const getTimeRange = () => {
  if (selectedYear.value && selectedYear.value !== "") {
    return {
      startDay: `${selectedYear.value}-01-01`,
      endDay: `${selectedYear.value}-12-31`
    };
  }
  return {};
};

// 轮播图相关状态
const currentCarouselIndex = ref(0);
const carouselCharts = [
  { name: "支出类型统计" },
  { name: "支付方式统计" },
  { name: "流水归属统计" },
  { name: "每日流水统计" },
  { name: "每月流水统计" },
];

// 响应式图表尺寸计算

// Mobile charts (horizontal scroll)
const mobileChartWidth = computed(() => "100%");
const mobileChartHeight = computed(() => "62vh");

// 窗口大小变化监听
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

// 移动端交互处理
const handleMobileFilter = (type: string) => {
  console.log(`Filter for ${type}`);
  // 这里可以实现具体的筛选逻辑
};

const handleMobileDetails = (type: string) => {
  console.log(`Details for ${type}`);
  // 这里可以实现跳转到详情页面的逻辑
  const chartMap: { [key: string]: number } = {
    industry: 0,
    payType: 1,
    attribution: 2,
    daily: 3,
    monthly: 4,
  };
  if (chartMap[type] !== undefined) {
    currentCarouselIndex.value = chartMap[type];
  }
};

// 轮播图导航函数 - 循环轮播
const prevChart = () => {
  if (currentCarouselIndex.value > 0) {
    currentCarouselIndex.value--;
  } else {
    // 从第一个跳到最后一个
    currentCarouselIndex.value = carouselCharts.length - 1;
  }
};

const nextChart = () => {
  if (currentCarouselIndex.value < carouselCharts.length - 1) {
    currentCarouselIndex.value++;
  } else {
    // 从最后一个跳到第一个
    currentCarouselIndex.value = 0;
  }
};

const goToChart = (index: number) => {
  currentCarouselIndex.value = index;
};

const loading = ref(true);


onMounted(async () => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
    // 监听流水更新事件
    window.addEventListener("flow-updated", handleFlowUpdate);
  }
  // 初始化年份列表
  availableYears.value = getYearRange();
  // 初始化账本状态
  await init();
  // 等待DOM完全渲染
  await nextTick();
  // 设置默认选中的消费类型
  await setDefaultIndustryCategory();
  loading.value = false;
});

onBeforeUnmount(() => {
  // 清理资源
  loading.value = true;
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
    // 移除流水更新事件监听
    window.removeEventListener("flow-updated", handleFlowUpdate);
  }
});
</script>

<style scoped>
/* 自定义样式 */
.max-w-7xl {
  max-width: 1280px;
}

/* 确保图表容器的响应式 */
:deep(.chart-common-container) {
  width: 100% !important;
}

/* 移动端水平滚动样式 */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: theme("colors.gray.300") transparent;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: theme("colors.gray.300");
  border-radius: 3px;
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: theme("colors.gray.600");
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}

/* 移动端卡片滚动动画 */
@media (max-width: 1024px) {
  .snap-x {
    scroll-behavior: smooth;
  }
}
</style>
