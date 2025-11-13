<template>
  <div class="chart-common-container">
    <div class="flex flex-col md:flex-row md:justify-between items-center w-full border-b border-gray-200 dark:border-gray-700 md:h-16 mb-4">
      <div class="flex items-center gap-2">
        <h4 class="hidden md:flex text-lg font-semibold text-green-950 dark:text-white my-2">
          {{ title }}
        </h4>
        <div class="chart-info-tooltip relative inline-flex items-center hidden md:flex">
          <InformationCircleIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-help" />
            <div class="chart-info-content">
              统计所有账户的余额变动，包括收支、借贷和账户间转账，反映账户层面的资金流动
            </div>
        </div>
      </div>
      <div class="w-full md:w-auto flex items-center justify-between md:justify-end gap-4 text-sm">
        <span class="text-gray-600 dark:text-gray-300">总变动</span>
        <span :class="totalDeltaClass">
          {{ signedTotalDelta }}
        </span>
      </div>
    </div>

    <div v-show="noData" :style="`width: ${width}; height: ${height};`" class="flex items-center justify-center">
      <h3 class="text-lg text-red-500 font-medium">暂无数据</h3>
    </div>
    <div v-show="!noData" :id="chartId" :style="`width: ${width}; height: ${height};`"></div>
  </div>
  
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { onMounted, ref, watch, computed } from "vue";
import { accountDeltaByYear } from "~/utils/analyticsApi";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

interface Props {
  title: string;
  width: string;
  height: string;
  selectedYear: string;
}

const emit = defineEmits<{ 'account-click': [payload: { accountId: number; accountName: string }] }>();
const props = defineProps<Props>();

const chartId = ref(`accountDeltaPieDiv-${Math.random().toString(36).substr(2, 9)}`);
const noData = ref(false);
const totalDelta = ref(0);

const optionRef = ref({
  tooltip: {
    trigger: "item",
    formatter: (param: any) => {
      const sign = param.data.delta >= 0 ? "+" : "-";
      return `${param.name}<br/>变动: ${sign}${Math.abs(param.data.delta).toFixed(2)}`;
    },
  },
  legend: {
    show: false,
    textStyle: { color: "#374151" },
  },
  series: [
    {
      name: "账户变动",
      type: "pie",
      radius: ["50%", "80%"],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      label: {
        show: true,
        position: "outside",
        formatter(param: any) {
          const sign = param.data.delta >= 0 ? "+" : "-";
          return `${param.name}: ${sign}${Math.abs(param.data.delta).toFixed(2)}`;
        },
      },
      labelLine: { show: true },
      data: [] as any[],
    },
  ],
});

let chartDiv: any;
let chart: echarts.ECharts;

const colorForValue = (value: number) => {
  return value >= 0 ? "#10b981" : "#ef4444"; // 绿涨 红跌
};

const refresh = async () => {
  try {
    const res = await accountDeltaByYear(props.selectedYear);
    const data = res?.data || [];
    if (!data || data.length === 0) {
      noData.value = true;
      totalDelta.value = 0;
      return;
    }
    noData.value = false;

    // 只显示有变动的账户，数值用绝对值作为饼图权重
    const chartData = data.map((d: any) => ({
      name: d.accountName,
      value: Math.abs(Number(d.delta) || 0),
      delta: Number(d.delta) || 0,
      accountId: d.accountId,
      itemStyle: { color: colorForValue(Number(d.delta) || 0) },
    })).filter((d: any) => d.value > 0.005);

    // 计算总变动（可为正或负）
    totalDelta.value = (data as any[]).reduce((sum: number, d: any) => sum + (Number(d.delta) || 0), 0);

    // 排序（可选）
    chartData.sort((a: any, b: any) => b.value - a.value);

    optionRef.value.series[0].data = chartData;
    chart.setOption(optionRef.value);
  } catch (e) {
    console.error(e);
    noData.value = true;
    totalDelta.value = 0;
  }
};

watch(() => props.selectedYear, () => {
  refresh();
});

onMounted(() => {
  chartDiv = document.getElementById(chartId.value);
  const oldInstance = echarts.getInstanceByDom(chartDiv);
  if (oldInstance) oldInstance.dispose();
  chart = echarts.init(chartDiv);
  chart.on('click', (params: any) => {
    if (params?.data?.accountId) {
      emit('account-click', { accountId: params.data.accountId, accountName: params.name });
    }
  });
  refresh();
});

defineExpose({ refresh });

// 显示样式与文案
const signedTotalDelta = computed(() => {
  const v = Number(totalDelta.value || 0);
  const sign = v >= 0 ? "+" : "-";
  return `${sign}¥${Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

const totalDeltaClass = computed(() => {
  const v = Number(totalDelta.value || 0);
  return v >= 0
    ? "px-2 py-1 rounded-md font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
    : "px-2 py-1 rounded-md font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
});
</script>

<style scoped>
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

@media screen and (max-width: 768px) {
  .chart-info-content {
    font-size: 11px;
    max-width: 250px;
    padding: 6px 10px;
  }
}
</style>


