<template>
  <div class="chart-common-container">
    <div
      v-if="years.length > 0"
      class="relative w-full border-b border-gray-200 dark:border-gray-700 mb-2 h-12 md:mb-4"
    >
      <div v-if="years.length > 0" class="min-w-32 absolute right-0 top-0">
        <select
          v-model="filterYear"
          @change="filterYearChange"
          class="w-full px-2 py-1 md:px-3 md:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-md bg-white dark:bg-gray-700 text-green-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">全部年份</option>
          <option v-for="year in years" :key="year.value" :value="year.value">
            {{ year.title }}
          </option>
        </select>
      </div>
    </div>
    <div v-show="noData" :style="`width: ${width}; height: ${height};`">
      <h3 style="width: 100%; text-align: center; color: tomato">暂无数据</h3>
    </div>
    <div
      v-show="!noData"
      :id="chartId"
      class="chart-content"
      :style="`width: ${width}; height: ${height};`"
    ></div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { onMounted, ref } from "vue";
import type { CommonSelectOption } from "~/utils/model";
import { multiBookMonth } from "~/utils/analyticsApi";
import type { Book } from "~/utils/model";

interface Props {
  title: string;
  width: string;
  height: string;
  bookIds: string[];
  books: Book[];
}

const props = defineProps<Props>();

const chartId = ref(`multiBookMonthDiv-${Math.random().toString(36).substr(2, 9)}`);
const noData = ref(false);

const years = ref<CommonSelectOption[]>([]);
const allData = ref<any[]>([]);
const filterYear = ref(new Date().getFullYear().toString());

const filterYearChange = () => {
  // 重新渲染图表
  renderChart();
};

const optionRef = ref({
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "shadow",
    },
  },
  legend: {
    data: [] as string[],
  },
  toolbox: {
    feature: {},
  },
  xAxis: {
    name: "年月",
    type: "category",
    data: [] as string[],
  },
  yAxis: {
    name: "金额(元)",
    type: "value",
  },
  series: [] as any[],
});

let chartDiv: any;
let chart: echarts.ECharts;

const doQuery = async () => {
  if (props.bookIds.length === 0) {
    noData.value = true;
    return;
  }

  try {
    // 获取当前年份的开始和结束日期
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;
    
    const res = await multiBookMonth(props.bookIds, { startDate, endDate });
    
    if (!res || Object.keys(res).length === 0) {
      noData.value = true;
      return;
    }

    noData.value = false;
    
    // 处理多账本月度数据
    const months = Object.keys(res).sort();
    const bookSeriesMap = new Map<string, {income: number[], expense: number[], zero: number[]}>();
    
    // 初始化每个账本的数据系列
    props.bookIds.forEach(bookId => {
      bookSeriesMap.set(bookId, {
        income: new Array(months.length).fill(0),
        expense: new Array(months.length).fill(0),
        zero: new Array(months.length).fill(0)
      });
    });

    // 填充数据
    months.forEach((month, index) => {
      const monthData = res[month];
      Object.keys(monthData).forEach(bookId => {
        const bookData = monthData[bookId];
        const series = bookSeriesMap.get(bookId);
        if (series) {
          series.income[index] = Number(bookData.inSum).toFixed(2);
          series.expense[index] = Number(bookData.outSum).toFixed(2);
          series.zero[index] = Number(bookData.zeroSum).toFixed(2);
        }
      });
    });

    // 构建图表系列
    const series: any[] = [];
    const legendData: string[] = [];

    props.bookIds.forEach(bookId => {
      const book = props.books.find(b => b.bookId === bookId);
      if (!book) return;

      const seriesData = bookSeriesMap.get(bookId);
      if (!seriesData) return;

      // 收入系列
      series.push({
        name: `${book.bookName}-收入`,
        type: "bar",
        itemStyle: {
          color: book.color,
        },
        data: seriesData.income,
      });

      // 支出系列
      series.push({
        name: `${book.bookName}-支出`,
        type: "bar",
        itemStyle: {
          color: book.color,
        },
        data: seriesData.expense,
      });

      legendData.push(`${book.bookName}-收入`, `${book.bookName}-支出`);
    });

    // 更新图表配置
    optionRef.value.xAxis.data = months;
    optionRef.value.series = series;
    optionRef.value.legend.data = legendData;

    // 生成年份选项
    const monthYears: string[] = [];
    months.forEach(month => {
      monthYears.push(month.split("-")[0]);
    });
    const uniqueYears = Array.from(new Set(monthYears));
    years.value = uniqueYears.map(year => ({ title: year, value: year }));

    allData.value = months.map(month => ({ month, data: res[month] }));

    renderChart();
  } catch (error) {
    console.error('Failed to fetch multi-book month data:', error);
    noData.value = true;
  }
};

const renderChart = () => {
  if (!chart) return;

  let dataToRender = allData.value;
  
  if (filterYear.value) {
    dataToRender = allData.value.filter(item => 
      item.month.startsWith(filterYear.value)
    );
  }

  const months = dataToRender.map(item => item.month);
  const bookSeriesMap = new Map<string, {income: number[], expense: number[], zero: number[]}>();
  
  // 重新构建数据
  props.bookIds.forEach(bookId => {
    bookSeriesMap.set(bookId, {
      income: new Array(months.length).fill(0),
      expense: new Array(months.length).fill(0),
      zero: new Array(months.length).fill(0)
    });
  });

  dataToRender.forEach((item, index) => {
    const monthData = item.data;
    Object.keys(monthData).forEach(bookId => {
      const bookData = monthData[bookId];
      const series = bookSeriesMap.get(bookId);
      if (series) {
        series.income[index] = Number(bookData.inSum).toFixed(2);
        series.expense[index] = Number(bookData.outSum).toFixed(2);
        series.zero[index] = Number(bookData.zeroSum).toFixed(2);
      }
    });
  });

  // 构建图表系列
  const series: any[] = [];
  const legendData: string[] = [];

  props.bookIds.forEach(bookId => {
    const book = props.books.find(b => b.bookId === bookId);
    if (!book) return;

    const seriesData = bookSeriesMap.get(bookId);
    if (!seriesData) return;

    series.push({
      name: `${book.bookName}-收入`,
      type: "bar",
      itemStyle: {
        color: book.color,
      },
      data: seriesData.income,
    });

    series.push({
      name: `${book.bookName}-支出`,
      type: "bar",
      itemStyle: {
        color: book.color,
      },
      data: seriesData.expense,
    });

    legendData.push(`${book.bookName}-收入`, `${book.bookName}-支出`);
  });

  optionRef.value.xAxis.data = months;
  optionRef.value.series = series;
  optionRef.value.legend.data = legendData;

  chart.setOption(optionRef.value);
};

onMounted(() => {
  chartDiv = document.getElementById(chartId.value);
  const oldInstance = echarts.getInstanceByDom(chartDiv);
  if (oldInstance) {
    oldInstance.dispose();
  }
  chart = echarts.init(chartDiv);
  doQuery();
});
</script>

<style scoped>
.chart-content {
  padding: 10px;
}
</style>
