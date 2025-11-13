<template>
  <div class="chart-common-container">
    <div
      class="flex flex-col md:flex-row md:justify-between items-center w-full border-b border-gray-200 dark:border-gray-700 md:h-16 mb-4"
    >
      <div class="flex items-center gap-2">
        <h4
          class="hidden md:flex text-lg font-semibold text-green-950 dark:text-white my-2"
        >
          {{ title }}【{{ flowType }}】
        </h4>
        <div class="chart-info-tooltip relative inline-flex items-center hidden md:flex">
          <InformationCircleIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-help" />
          <div class="chart-info-content">
            <template v-if="flowType === '支出'">
              按消费类型统计支出，聚合所有账本数据，不包括转账和借贷
            </template>
            <template v-else-if="flowType === '收入'">
              按收入类型统计，聚合所有账本数据，不包括转账和借贷
            </template>
            <template v-else>
              按{{ groupBy === 'industryType' ? '消费类型' : groupBy === 'payType' ? '支付方式' : '消费归属' }}统计{{ flowType || '' }}，聚合所有账本数据，不包括转账和借贷
            </template>
          </div>
        </div>
      </div>
      <div class="w-full md:w-auto flex items-center justify-between md:justify-end gap-4 text-sm">
        <span class="text-gray-600 dark:text-gray-300">总金额</span>
        <span :class="totalAmountClass">
          {{ formattedTotalAmount }}
        </span>
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
import { onMounted, ref, watch, computed } from "vue";
import { multiBookCommon } from "~/utils/analyticsApi";
import type { Book } from "~/utils/model";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

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

const emit = defineEmits<{
  'category-selected': [category: string]
}>();

const chartId = ref(`multiBookCommonPieDiv-${Math.random().toString(36).substr(2, 9)}`);
const noData = ref(false);
const showLegend = ref(props.showLegend);
const totalAmount = ref(0);

const optionRef = ref({
  tooltip: {
    trigger: "item",
  },
  legend: {
    show: props.showLegend,
    textStyle: {
      color: "#374151",
    },
    left: "0",
    orient: "vertical",
    top: "middle",
    formatter(name: string) {
      try {
        // 查找对应数据以显示金额
        // @ts-ignore
        const data = optionRef.value.series[0].data as Array<{ name: string; value: string | number }>;
        const item = data.find(d => d.name === name);
        if (item) {
          const val = typeof item.value === 'number' ? item.value : Number(item.value);
          return `${name}: ${val.toFixed(2)}`;
        }
      } catch (_) {}
      return name;
    }
  },
  toolbox: {
    feature: {},
  },
  series: [
    {
      name: props.seriesName,
      type: "pie",
      radius: ["50%", "80%"],
      center: ["60%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: "#d1d5db",
        borderWidth: 1,
      },
      label: {
        show: true,
        position: "center",
        formatter(param: any) {
          return param.name + " (" + param.percent + "%)";
        },
      },
      emphasis: {
        label: {
          show: true,
          fontSize: "40",
          fontWeight: "bold",
        },
      },
      labelLine: {
        show: false,
      },
      data: [] as any[],
    },
  ],
});

let chartDiv: any;
let chart: echarts.ECharts;

// 生成分类颜色
const getCategoryColor = (category: string, index: number) => {
  // 预定义的颜色数组
  const colors = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
    '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff9f7f',
    '#ffdb5c', '#37a2ff', '#32c5e9', '#67e0e3', '#9fe6b8',
    '#ffd93d', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
  ];
  
  // 根据分类名称生成一致的颜色
  let colorIndex = 0;
  for (let i = 0; i < category.length; i++) {
    colorIndex += category.charCodeAt(i);
  }
  
  return colors[colorIndex % colors.length];
};

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
      totalAmount.value = 0;
      return;
    }

    noData.value = false;
    
    // 处理多账本通用数据
    const categories = Object.keys(res);
    const pieData: any[] = [];

    categories.forEach(category => {
      const categoryData = res[category];
      let totalValue = 0;
      const bookDetails: string[] = [];

      Object.keys(categoryData).forEach(bookId => {
        const bookData = categoryData[bookId];
        const book = props.books.find(b => b.bookId === bookId);
        if (!book) return;

        let value = 0;
        if (props.flowType === "支出") {
          value = Number(bookData.outSum);
        } else if (props.flowType === "收入") {
          value = Number(bookData.inSum);
        } else {
          value = Number(bookData.zeroSum);
        }

        if (value > 0) {
          totalValue += value;
          bookDetails.push(`${book.bookName}: ${value.toFixed(2)}`);
        }
      });

      if (totalValue > 0) {
        pieData.push({
          name: category,
          value: totalValue.toFixed(2),
          itemStyle: {
            color: getCategoryColor(category, categories.indexOf(category))
          },
          tooltip: {
            formatter: function() {
              return `${category}<br/>总计: ${totalValue.toFixed(2)}<br/>${bookDetails.join('<br/>')}`;
            }
          }
        });
      }
    });

    // 按值排序
    pieData.sort((a, b) => Number(b.value) - Number(a.value));

    // 计算总金额
    totalAmount.value = pieData.reduce((sum, item) => sum + Number(item.value), 0);

    // 更新图表配置
    optionRef.value.series[0].data = pieData;

    // 根据项目数量构建最多三列图例，第三列右对齐
    const names = pieData.map((d: any) => d.name);
    const shouldThreeCols = names.length >= 21; // 简单阈值，足够多时分三列
    if (shouldThreeCols && showLegend.value) {
      const maxRows = Math.ceil(names.length / 3);
      const col1 = names.slice(0, maxRows);
      const col2 = names.slice(maxRows, maxRows * 2);
      const col3 = names.slice(maxRows * 2);

      // 公共的格式化器，显示金额
      const formatter = function(name: string) {
        const item = pieData.find((d: any) => d.name === name);
        if (item) {
          const val = typeof item.value === 'number' ? item.value : Number(item.value);
          return `${name}: ${val.toFixed(2)}`;
        }
        return name;
      } as any;

      // 使用三个图例并排布局，第三列文本右对齐
      // @ts-ignore
      optionRef.value.legend = [
        {
          show: true,
          type: 'plain',
          orient: 'vertical',
          left: 0,
          top: 'middle',
          data: col1,
          textStyle: { color: '#374151', align: 'left' },
          formatter,
        },
        {
          show: true,
          type: 'plain',
          orient: 'vertical',
          // 让第二列尽可能贴近第一列，减少列间距
          left: '22%',
          top: 'middle',
          data: col2,
          textStyle: { color: '#374151', align: 'left' },
          formatter,
        },
        {
          show: true,
          type: 'plain',
          orient: 'vertical',
          right: 0,
          top: 'middle',
          data: col3,
          textStyle: { color: '#374151', align: 'right' },
          formatter,
        },
      ];
      // 为了给左侧三列图例留空间，将饼图居中偏右
      // @ts-ignore
      optionRef.value.series[0].center = ["60%", "50%"];
    } else {
      // 单列默认样式
      // @ts-ignore
      optionRef.value.legend = {
        show: showLegend.value,
        textStyle: { color: '#374151' },
        left: '0',
        orient: 'vertical',
        top: 'middle',
        formatter(name: string) {
          const item = pieData.find((d: any) => d.name === name);
          if (item) {
            const val = typeof item.value === 'number' ? item.value : Number(item.value);
            return `${name}: ${val.toFixed(2)}`;
          }
          return name;
        },
      } as any;
    }

    chart.setOption(optionRef.value);
  } catch (error) {
    console.error('Failed to fetch multi-book common data:', error);
    noData.value = true;
    totalAmount.value = 0;
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
  
  // 添加点击事件监听
  chart.on('click', (params) => {
    if (props.groupBy === 'industryType') {
      emit('category-selected', params.name);
    }
  });
  
  doQuery();
});

// 计算属性：格式化总金额
const formattedTotalAmount = computed(() => {
  return `¥${totalAmount.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

// 计算属性：总金额样式
const totalAmountClass = computed(() => {
  return "px-2 py-1 rounded-md font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
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
