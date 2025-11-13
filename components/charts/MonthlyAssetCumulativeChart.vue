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
              <template v-if="onlyIncludedAccounts">
                仅统计计入总资产账户的净资产增长。包括收支（收入-支出）和跨边界转账影响。
              </template>
              <template v-else>
                统计所有账户的净资产增长。仅计算收支（收入-支出），转账不影响总资产。
              </template>
            </div>
          </div>
        </div>
        <!-- 年度增长金额显示（仅在单年份模式下显示） -->
        <div v-if="yearlyGrowth !== null && selectedYear && selectedYear !== ''" class="text-center mb-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">本年度总增长：</span>
          <span 
            :class="[
              'text-lg font-bold',
              yearlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'
            ]"
          >
            {{ yearlyGrowth >= 0 ? '+' : '' }}{{ formatCurrency(yearlyGrowth) }}
          </span>
        </div>
      </div>
    </div>
    <div v-show="noData" :style="`width: ${width}; height: ${height};`">
      <h3 style="width: 100%; text-align: center; color: tomato">暂无数据</h3>
    </div>
    <div
      v-show="!noData"
      class="chart-container relative"
      :style="`width: ${width}; height: ${height};`"
    >
      <div
        :id="chartId"
        class="chart-content"
        :style="`width: ${width}; height: ${height};`"
      ></div>
      <!-- 账户筛选开关 - 右上角 -->
      <div class="absolute top-2 right-2 z-10">
        <div class="flex items-center gap-1.5 px-2 py-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-md border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow transition-shadow">
          <span 
            :class="[
              'text-xs font-medium transition-colors whitespace-nowrap',
              !onlyIncludedAccounts 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-500 dark:text-gray-400'
            ]"
          >
            所有
          </span>
          <button
            type="button"
            @click="toggleOnlyIncludedAccounts"
            :class="[
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              onlyIncludedAccounts ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            ]"
            role="switch"
            :aria-checked="onlyIncludedAccounts"
            aria-label="切换账户筛选模式"
          >
            <span
              :class="[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out',
                onlyIncludedAccounts ? 'translate-x-5' : 'translate-x-0.5'
              ]"
            />
          </button>
          <span 
            :class="[
              'text-xs font-medium transition-colors whitespace-nowrap',
              onlyIncludedAccounts 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-500 dark:text-gray-400'
            ]"
          >
            仅计入
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { onMounted, ref, watch } from "vue";
import { doApi } from "~/utils/api";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

// 使用 props 来接收外部传入的参数
const { title, width, height, selectedYear } = defineProps(["title", "width", "height", "selectedYear"]);

// 生成唯一ID避免冲突
const chartId = ref(`monthlyAssetDiv-${Math.random().toString(36).substr(2, 9)}`);

// 复选框状态（默认false，计算所有账户）
const onlyIncludedAccounts = ref(false);

// 横轴数据（月份）
const xAxisList: string[] = [];
// 资产累计数据
const dataList: number[] = [];
// 存储完整的月份数据，用于计算第一个点的变化
const monthDataMap = ref<Map<string, number>>(new Map());
const noData = ref(false);
// 年度增长金额
const yearlyGrowth = ref<number | null>(null);

const optionRef = ref({
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "cross",
    },
    formatter: function(params: any) {
      const data = params[0];
      return `${data.axisValue}<br/>总资产: ¥${data.value.toFixed(2)}`;
    }
  },
  legend: {
    data: [
      {
        name: "总资产",
        textStyle: {
          color: "rgb(34, 197, 94)", // 绿色
        },
      },
    ],
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
      rotate: 45, // 旋转标签以避免重叠

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
  series: [
    {
      name: "总资产",
      type: "line",
      symbol: "circle",
      symbolSize: 6,
      smooth: true, // 平滑曲线
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0, color: 'rgba(34, 197, 94, 0.3)'
          }, {
            offset: 1, color: 'rgba(34, 197, 94, 0.1)'
          }]
        }
      },
      itemStyle: {
        color: "rgb(34, 197, 94)", // 绿色
      },
      lineStyle: {
        color: "rgb(34, 197, 94)",
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
          const currentValue = params.value;
          const currentMonth = xAxisList[index];
          
          if (index === 0) {
            // 第一个点：计算相对于上个月的变化
            // 计算上个月的月份
            const monthDate = new Date(currentMonth + '-01');
            monthDate.setMonth(monthDate.getMonth() - 1);
            const prevMonth = monthDate.toISOString().substring(0, 7);
            
            // 查找上个月的数据
            const prevValue = monthDataMap.value.get(prevMonth);
            
            if (prevValue !== undefined) {
              // 如果有上个月的数据，计算变化
              const diff = currentValue - prevValue;
              if (diff > 0) {
                return `+${(diff / 1000).toFixed(0)}k`;
              } else if (diff < 0) {
                return `${(diff / 1000).toFixed(0)}k`;
              } else {
                return '0k';
              }
            } else {
              // 如果没有上个月的数据，说明这是最早的数据点
              // API应该已经包含了上个月的数据，如果这里找不到，可能是数据确实不存在
              // 这种情况下不显示标签，避免显示误导性的数据
              return '';
            }
          }
          
          const previousValue = dataList[index - 1];
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
        color: 'rgb(34, 197, 94)',
        fontWeight: 'bold'
      },
      data: dataList,
    },
  ],
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
  try {
    // 构建请求参数
    const requestParams: any = {
      bookId: localStorage.getItem("bookId"),
      onlyIncludedAccounts: onlyIncludedAccounts.value
    };
    
    // 如果指定了年份，则添加时间范围参数
    if (selectedYear && selectedYear !== "") {
      const year = selectedYear;
      requestParams.startMonth = `${year}-01`;
      requestParams.endMonth = `${year}-12`;
    }
    // 如果没有指定年份或为空，则不传递时间参数，获取所有年份数据
    
    const res = await doApi.post("api/entry/analytics/monthly-asset-cumulative", requestParams);
    
    if (res && res.data && res.data.length > 0) {
      // 先将所有数据存入monthDataMap（包括上一年的12月，用于计算第一个点的标签）
      monthDataMap.value.clear();
      res.data.forEach((data: any) => {
        monthDataMap.value.set(data.month, Number(data.totalBalance));
      });
      
      // 如果指定了年份，过滤掉不在该年份的数据点（用于图表显示）
      // 但保留在monthDataMap中，用于计算标签
      xAxisList.length = 0;
      dataList.length = 0;
      
      if (selectedYear && selectedYear !== "") {
        // 只显示指定年份的数据（1月到12月）
        const yearStart = `${selectedYear}-01`;
        const yearEnd = `${selectedYear}-12`;
        
        res.data.forEach((data: any) => {
          if (data.month >= yearStart && data.month <= yearEnd) {
            xAxisList.push(data.month);
            dataList.push(Number(data.totalBalance));
          }
        });
      } else {
        // 没有指定年份，显示所有数据
        res.data.forEach((data: any) => {
          xAxisList.push(data.month);
          dataList.push(Number(data.totalBalance));
        });
      }
      
      // 设置年度增长金额
      yearlyGrowth.value = res.yearlyGrowth || 0;
      
      optionRef.value.xAxis.data = xAxisList;
      optionRef.value.series[0].data = dataList;
      
      // 默认显示所有数据，不进行缩放
      optionRef.value.dataZoom[0].start = 0;
      optionRef.value.dataZoom[1].start = 0;
      
      if (chart) {
        chart.setOption(optionRef.value);
      }
      noData.value = false;
    } else {
      noData.value = true;
      yearlyGrowth.value = null;
    }
  } catch (error) {
    console.error("获取月度资产累计数据失败:", error);
    noData.value = true;
  }
};

// 重新计算并刷新图表数据
const recalculateAndRefresh = async () => {
  try {
    // 先调用重新计算API
    await doApi.post("api/entry/analytics/recalculate-monthly-assets", {
      bookId: localStorage.getItem("bookId")
    });
    
    // 然后重新加载图表数据
    await loadChartData();
  } catch (error) {
    console.error("重新计算月度资产数据失败:", error);
  }
};

// 处理开关切换
const toggleOnlyIncludedAccounts = () => {
  onlyIncludedAccounts.value = !onlyIncludedAccounts.value;
  // 重新加载数据
  loadChartData();
};

// 暴露刷新方法给父组件
defineExpose({
  refresh: loadChartData,
  recalculate: recalculateAndRefresh
});

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
      console.error('month click dispatch failed', e);
    }
  });
  // 支持鼠标悬浮（不需要精确点中折线上的点）来触发月份选择
  chart.on('mousemove', function (param: any) {
    const month = param?.name;
    // 简单防抖，减少频繁刷新
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => emitSelectedMonth(month), 150);
  });
  
  // 初始加载数据
  loadChartData();
});

// 监听年份变化，重新加载数据
watch(() => selectedYear, () => {
  if (chart) {
    loadChartData();
  }
});
</script>

<style scoped>
.chart-container {
  position: relative;
}

.chart-content {
  padding: 10px;
}

@media screen and (max-width: 480px) {
  .chart-content {
    font-size: small;
  }
  
  /* 移动端调整开关位置和大小 */
  .chart-container .absolute {
    top: 4px;
    right: 4px;
  }
  
  .chart-container .absolute > div {
    padding: 0.25rem 0.375rem;
    gap: 0.25rem;
  }
  
  .chart-container .absolute span {
    font-size: 0.625rem;
  }
  
  .chart-container .absolute button {
    height: 0.875rem;
    width: 1.5rem;
  }
  
  .chart-container .absolute button span {
    height: 0.625rem;
    width: 0.625rem;
  }
  
  .chart-container .absolute button[aria-checked="true"] span {
    transform: translateX(0.75rem);
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

/* 开关样式优化 */
button[role="switch"] {
  cursor: pointer;
}

button[role="switch"]:focus {
  outline: none;
}

button[role="switch"]:focus-visible {
  outline: 2px solid rgb(59, 130, 246);
  outline-offset: 2px;
}

/* 开关动画优化 */
button[role="switch"] span {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

button[role="switch"]:hover {
  opacity: 0.85;
}

button[role="switch"]:active span {
  transform: scale(0.9);
}

button[role="switch"]:active {
  transform: scale(0.98);
}

/* 禁用文本选择 */
button[role="switch"] {
  user-select: none;
  -webkit-user-select: none;
}
</style>
