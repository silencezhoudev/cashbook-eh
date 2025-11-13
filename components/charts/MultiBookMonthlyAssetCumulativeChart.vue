<template>
  <div class="">
    <div
      class="w-full border-b border-gray-200 dark:border-gray-700 md:h-12 mb-4"
    >
      <div v-if="title">
        <div class="flex items-center justify-center gap-2">
          <h4
            class="text-lg text-center font-semibold text-green-950 dark:text-white my-2"
          >
            {{ title }}
          </h4>
          <div class="chart-info-tooltip relative inline-flex items-center">
            <InformationCircleIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-help" />
            <div class="chart-info-content">
              统计计入总资产账户的净资产增长，仅计算收支（收入-支出），不包括账户间转账和借贷
            </div>
          </div>
        </div>
        <!-- 年度增长金额显示（仅在单年份模式下显示） -->
        <div v-if="Object.keys(yearlyGrowthData).length > 0 && selectedYear && selectedYear !== ''" class="text-center mb-2">
          <div class="flex flex-wrap justify-center gap-4 text-sm">
            <div v-for="book in books.filter(b => bookIds.includes(b.bookId))" :key="book.bookId" class="flex items-center">
              <div class="w-3 h-3 rounded-full mr-2" :style="{ backgroundColor: book.color }"></div>
              <span class="text-gray-600 dark:text-gray-400">{{ book.bookName }}：</span>
              <span 
                :class="[
                  'font-bold',
                  yearlyGrowthData[book.bookId] >= 0 ? 'text-green-600' : 'text-red-600'
                ]"
              >
                {{ yearlyGrowthData[book.bookId] >= 0 ? '+' : '' }}{{ formatCurrency(yearlyGrowthData[book.bookId]) }}
              </span>
            </div>
          </div>
        </div>
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
import { onMounted, ref, computed, watch } from "vue";
import { doApi } from "~/utils/api";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

interface Props {
  title: string;
  width: string;
  height: string;
  bookIds: string[];
  books: any[];
  selectedYear?: string;
}

const props = defineProps<Props>();

// 生成唯一ID避免冲突
const chartId = ref(`multiBookMonthlyAssetDiv-${Math.random().toString(36).substr(2, 9)}`);

// 横轴数据（月份）
const xAxisList: string[] = [];
// 各账本的资产累计数据
const seriesData: { [key: string]: number[] } = {};
const noData = ref(false);
// 各账本的年度增长金额
const yearlyGrowthData: { [key: string]: number } = {};

// 计算图表配置
const optionRef = computed(() => {
  const series = props.books
    .filter(book => props.bookIds.includes(book.bookId))
    .map(book => ({
      name: book.bookName,
      type: "line" as const,
      symbol: "circle",
      symbolSize: 6,
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0, color: `${book.color}30`
          }, {
            offset: 1, color: `${book.color}10`
          }]
        }
      },
      itemStyle: {
        color: book.color,
      },
      lineStyle: {
        color: book.color,
        width: 3
      },
      emphasis: {
        focus: "series",
      },
      label: {
        show: true,
        position: 'top',
        formatter: function(params: any) {
          const index = params.dataIndex;
          if (index === 0) return ''; // 第一个点不显示标签
          
          const currentValue = params.value;
          const bookData = seriesData[book.bookId] || [];
          const previousValue = bookData[index - 1] || 0;
          const diff = currentValue - previousValue;
          
          if (diff > 0) {
            return `+${(diff / 1000).toFixed(0)}k`;
          } else if (diff < 0) {
            return `${(diff / 1000).toFixed(0)}k`;
          } else {
            return '0k';
          }
        },
        fontSize: 12,
        color: book.color,
        fontWeight: 'bold'
      },
      data: seriesData[book.bookId] || [],
    }));

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      formatter: function(params: any) {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param: any) => {
          result += `${param.seriesName}: ¥${param.value.toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: props.books
        .filter(book => props.bookIds.includes(book.bookId))
        .map(book => ({
          name: book.bookName,
          textStyle: {
            color: book.color,
          },
        })),
    },
    toolbox: {
      feature: {
        // 下载按钮
        // saveAsImage: {}
      },
    },
    dataZoom: [
      {
        type: "inside",
        start: 0,
        end: 100,
      },
      {
        start: 0,
        end: 100,
      },
    ],
    xAxis: {
      name: "月份",
      type: "category",
      data: xAxisList,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      name: "总资产(元)",
      show: true,
      type: "value",
      axisLabel: {
        formatter: function(value: number) {
          return `¥${value.toFixed(0)}`;
        }
      }
    },
    series: series,
  };
});

let chartDiv: any;
let chart: echarts.ECharts;
let lastEmittedMonth: string | null = null;
let hoverTimer: any = null;

// 格式化货币显示
const formatCurrency = (amount: number): string => {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function emitSelectedMonth(month: string | undefined) {
  if (!month) return;
  if (month === lastEmittedMonth) return;
  lastEmittedMonth = month;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('month-selected', { detail: { month } }));
  }
}

// 加载图表数据
const loadChartData = async () => {
  // 为每个选中的账本获取数据
  const promises = props.bookIds.map(async (bookId) => {
    try {
      // 构建请求参数
      const requestParams: any = {
        bookId: bookId
      };
      
      // 如果指定了年份，则添加时间范围参数
      if (props.selectedYear && props.selectedYear !== "") {
        const year = props.selectedYear;
        requestParams.startMonth = `${year}-01`;
        requestParams.endMonth = `${year}-12`;
      }
      // 如果没有指定年份或为空，则不传递时间参数，获取所有年份数据
      
      const res = await doApi.post("api/entry/analytics/monthly-asset-cumulative", requestParams);
      return { bookId, data: res.data || res, yearlyGrowth: res.yearlyGrowth || 0 };
    } catch (error) {
      console.error(`获取账本 ${bookId} 的月度资产累计数据失败:`, error);
      return { bookId, data: [], yearlyGrowth: 0 };
    }
  });

  Promise.all(promises).then((results) => {
    // 初始化数据结构
    xAxisList.length = 0;
    Object.keys(seriesData).forEach(key => delete seriesData[key]);
    Object.keys(yearlyGrowthData).forEach(key => delete yearlyGrowthData[key]);
    
    // 收集所有月份
    const allMonths = new Set<string>();
    results.forEach(result => {
      if (result.data && result.data.length > 0) {
        result.data.forEach((item: any) => {
          allMonths.add(item.month);
        });
      }
    });
    
    // 排序月份
    const sortedMonths = Array.from(allMonths).sort();
    xAxisList.push(...sortedMonths);
    
    // 为每个账本填充数据
    results.forEach(result => {
      const bookId = result.bookId;
      seriesData[bookId] = new Array(sortedMonths.length).fill(0);
      yearlyGrowthData[bookId] = result.yearlyGrowth || 0;
      
      if (result.data && result.data.length > 0) {
        result.data.forEach((item: any) => {
          const monthIndex = sortedMonths.indexOf(item.month);
          if (monthIndex !== -1) {
            seriesData[bookId][monthIndex] = Number(item.totalBalance);
          }
        });
      }
    });
    
    if (xAxisList.length > 0) {
      // 默认显示所有数据，不进行缩放
      optionRef.value.dataZoom[0].start = 0;
      optionRef.value.dataZoom[1].start = 0;
      
      chart.setOption(optionRef.value);
    } else {
      noData.value = true;
    }
  });
};

onMounted(() => {
  chartDiv = document.getElementById(chartId.value);
  const oldInstance = echarts.getInstanceByDom(chartDiv);
  if (oldInstance) {
    oldInstance.dispose();
  }
  chart = echarts.init(chartDiv);
  chart.on('click', function (param) {
    try {
      const month = param.name;
      emitSelectedMonth(month);
    } catch (e) {
      console.error('multi-book month click dispatch failed', e);
    }
  });
  // 悬浮即可选择月份，无需精确点中折线点
  chart.on('mousemove', function (param: any) {
    const month = param?.name;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => emitSelectedMonth(month), 150);
  });
  
  // 初始加载数据
  loadChartData();
});

// 监听年份变化，重新加载数据
watch(() => props.selectedYear, () => {
  if (chart) {
    loadChartData();
  }
});
</script>

<style scoped>
.chart-content {
  padding: 10px;
}

@media screen and (max-width: 480px) {
  .chart-content {
    font-size: small;
  }
}

.chart-info-tooltip {
  position: relative;
}

.chart-info-content {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 10px 16px;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 1000;
  min-width: 350px;
  max-width: 450px;
  white-space: normal;
  text-align: left;
  line-height: 1.5;
}

.chart-info-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.chart-info-tooltip:hover .chart-info-content {
  opacity: 1;
}

@media screen and (max-width: 480px) {
  .chart-info-content {
    font-size: 11px;
    max-width: 250px;
    padding: 6px 10px;
  }
}
</style>
