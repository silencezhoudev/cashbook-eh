<template>
  <div class="w-full">
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
import { onMounted, ref, watch } from "vue";
import { dateFormater } from "@/utils/common";
import { multiBookDailyChart } from "~/utils/analyticsApi";
import type { Book } from "~/utils/model";

interface Props {
  title: string;
  width: string;
  height: string;
  bookIds: string[];
  books: Book[];
}

const props = defineProps<Props>();

const chartId = ref(`multiBookLineDiv-${Math.random().toString(36).substr(2, 9)}`);
const noData = ref(false);

const optionRef = ref({
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "cross",
    },
  },
  legend: {
    data: [] as string[],
  },
  toolbox: {
    feature: {},
  },
  dataZoom: [
    {
      type: "inside",
      start: 80,
      end: 100,
    },
    {
      start: 80,
      end: 100,
    },
  ],
  xAxis: {
    name: "日期",
    type: "category",
    data: [] as string[],
  },
  yAxis: {
    name: "金额(元)",
    show: true,
    type: "value",
    min: "0.00",
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
    // 获取当前月份的开始和结束日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() 返回 0-11，需要加1
    const startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;
    
    const res = await multiBookDailyChart(props.bookIds, { startDate, endDate });
    
    if (!res || res.length === 0) {
      noData.value = true;
      return;
    }

    noData.value = false;
    
    // 处理多账本数据
    const bookDataMap = new Map<string, Map<string, {inSum: number, outSum: number, zeroSum: number}>>();
    
    // 初始化数据结构
    props.bookIds.forEach(bookId => {
      bookDataMap.set(bookId, new Map());
    });

    // 填充数据
    res.forEach((item: any) => {
      const { day, bookId, inSum, outSum, zeroSum } = item;
      if (bookDataMap.has(bookId)) {
        bookDataMap.get(bookId)!.set(day, { inSum, outSum, zeroSum });
      }
    });

    // 获取所有日期
    const allDays = new Set<string>();
    bookDataMap.forEach(dayMap => {
      dayMap.forEach((_, day) => allDays.add(day));
    });
    
    const xAxisData = Array.from(allDays).sort();

    // 为每个账本创建系列
    const series: any[] = [];
    const legendData: string[] = [];

    props.bookIds.forEach(bookId => {
      const book = props.books.find(b => b.bookId === bookId);
      if (!book) return;

      const dayMap = bookDataMap.get(bookId);
      if (!dayMap) return;

      // 收入系列
      const incomeData = xAxisData.map(day => {
        const data = dayMap.get(day);
        return data ? Number(data.inSum).toFixed(2) : '0';
      });

      // 支出系列
      const expenseData = xAxisData.map(day => {
        const data = dayMap.get(day);
        return data ? Number(data.outSum).toFixed(2) : '0';
      });

      // 添加收入系列
      series.push({
        name: `${book.bookName}-收入`,
        type: "line",
        symbol: "circle",
        symbolSize: 4,
        itemStyle: {
          color: book.color,
        },
        data: incomeData,
      });

      // 添加支出系列
      series.push({
        name: `${book.bookName}-支出`,
        type: "line",
        symbol: "circle",
        symbolSize: 4,
        itemStyle: {
          color: book.color,
        },
        lineStyle: {
          type: 'dashed'
        },
        data: expenseData,
      });

      legendData.push(`${book.bookName}-收入`, `${book.bookName}-支出`);
    });

    // 更新图表配置
    optionRef.value.xAxis.data = xAxisData;
    optionRef.value.series = series;
    optionRef.value.legend.data = legendData;

    chart.setOption(optionRef.value);
  } catch (error) {
    console.error('Failed to fetch multi-book data:', error);
    noData.value = true;
  }
};

// 监听账本选择变化
watch(() => props.bookIds, () => {
  doQuery();
}, { deep: true });

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
