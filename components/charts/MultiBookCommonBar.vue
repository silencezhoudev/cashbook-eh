<template>
  <div class="chart-common-container">
    <div
      class="flex flex-col md:flex-row md:justify-between items-center w-full border-b border-gray-200 dark:border-gray-700 md:h-16 mb-4"
    >
      <div>
        <h4
          class="hidden md:flex text-lg font-semibold text-green-950 dark:text-white my-2"
        >
          {{ title }}【{{ flowType }}】
        </h4>
      </div>
    </div>
    
    <div
      v-show="noData"
      :style="`width: ${width}; height: ${height};`"
      class="flex items-center justify-center"
    >
      <h3 class="text-lg text-red-500 font-medium">暂无数据</h3>
    </div>
    <div
      v-show="!noData"
      :id="chartId"
      :style="`width: ${width}; height: ${height};`"
    ></div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from "echarts";
import { onMounted, ref, watch } from "vue";
import { multiBookCommon } from "~/utils/analyticsApi";
import type { Book } from "~/utils/model";

interface Props {
  title: string;
  width: string;
  height: string;
  groupBy: string;
  startDay?: string;
  endDay?: string;
  flowType?: string;
  seriesName?: string;
  showLegend?: boolean;
  queryField?: string;
  bookIds: string[];
  books: Book[];
}

const props = withDefaults(defineProps<Props>(), {
  seriesName: "数据分析",
  showLegend: true,
  queryField: "payType",
});

const chartId = ref(`multiBookCommonBarDiv-${Math.random().toString(36).substr(2, 9)}`);
const noData = ref(false);
const showLegend = ref(props.showLegend);

const optionRef = ref({
  tooltip: {
    trigger: "item",
  },
  legend: {
    show: props.showLegend,
    data: [] as string[],
    textStyle: {
      color: "#374151",
    },
  },
  toolbox: {
    feature: {},
  },
  xAxis: {
    type: "category",
    data: [] as string[],
    axisLabel: {
      rotate: 45,
      fontSize: 12,
    },
  },
  yAxis: {
    type: "value",
    name: "金额(元)",
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
    const res = await multiBookCommon(props.bookIds, {
      groupBy: props.groupBy,
      flowType: props.flowType,
      startDay: props.startDay,
      endDay: props.endDay
    });
    
    if (!res || Object.keys(res).length === 0) {
      noData.value = true;
      return;
    }

    noData.value = false;
    
    // 处理多账本通用数据
    const categories = Object.keys(res);
    const bookSeriesMap = new Map<string, number[]>();
    
    // 初始化每个账本的数据系列
    props.bookIds.forEach(bookId => {
      bookSeriesMap.set(bookId, new Array(categories.length).fill(0));
    });

    // 填充数据
    categories.forEach((category, index) => {
      const categoryData = res[category];
      Object.keys(categoryData).forEach(bookId => {
        const bookData = categoryData[bookId];
        const series = bookSeriesMap.get(bookId);
        if (series) {
          if (props.flowType === "支出") {
            series[index] = Number(bookData.outSum).toFixed(2);
          } else if (props.flowType === "收入") {
            series[index] = Number(bookData.inSum).toFixed(2);
          } else {
            series[index] = Number(bookData.zeroSum).toFixed(2);
          }
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
        name: book.bookName,
        type: "bar",
        itemStyle: {
          color: book.color,
          borderRadius: [4, 4, 0, 0],
        },
        data: seriesData.map(value => ({
          name: categories[seriesData.indexOf(value)],
          value: value
        })),
        label: {
          show: true,
          position: "top",
          fontSize: 12,
          formatter: function (params: any) {
            return Number(params.value).toFixed(2);
          },
        },
      });

      legendData.push(book.bookName);
    });

    // 更新图表配置
    optionRef.value.xAxis.data = categories;
    optionRef.value.series = series;
    optionRef.value.legend.data = legendData;

    chart.setOption(optionRef.value);
  } catch (error) {
    console.error('Failed to fetch multi-book common data:', error);
    noData.value = true;
  }
};

const toggleLegend = () => {
  showLegend.value = !showLegend.value;
  optionRef.value.legend.show = showLegend.value;
  chart.setOption(optionRef.value);
};

// 监听账本选择变化
watch(() => props.bookIds, () => {
  doQuery();
}, { deep: true });

// 监听props变化，重新查询数据
watch(() => [props.startDay, props.endDay, props.flowType], () => {
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
