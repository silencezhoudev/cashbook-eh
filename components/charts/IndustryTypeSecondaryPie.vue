<template>
  <div class="chart-common-container">
    <div
      class="flex flex-col md:flex-row md:justify-between items-center w-full border-b border-gray-200 dark:border-gray-700 md:h-16 mb-4"
    >
      <div class="flex items-center gap-2">
        <h4
          class="hidden md:flex text-lg font-semibold text-green-950 dark:text-white my-2"
        >
          {{ title }}【{{ selectedCategory || '请选择分类' }}】
        </h4>
        <div class="chart-info-tooltip relative inline-flex items-center hidden md:flex">
          <InformationCircleIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-help" />
          <div class="chart-info-content">
            显示选中消费类型的二级分类详情，仅统计支出，不包括转账、借贷和不计入收支的流水
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
import { useAppTheme } from "~/composables/useAppTheme";
import { doApi } from "@/utils/api";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

const { isDark } = useAppTheme();

const emit = defineEmits<{
  'secondary-category-clicked': [primaryCategory: string, secondaryCategory: string]
}>();

// 使用 props 来接收外部传入的参数
const { title, width, height, selectedCategory, startDay, endDay, bookIds, books } = defineProps<{
  title: string;
  width: string;
  height: string;
  selectedCategory: string;
  startDay?: string;
  endDay?: string;
  bookIds: string[];
  books: Array<{bookId: string, bookName: string, color: string}>;
}>();

// 生成唯一ID避免冲突
const chartId = ref(`industrySecondaryPieDiv-${Math.random().toString(36).substr(2, 9)}`);

const dataList: any[] = [];
const noData = ref(false);
const totalAmount = ref(0);

const optionRef = ref({
  tooltip: {
    trigger: "item",
  },
  legend: {
    tooltip: {
      formatter: function (legend: any) {
        for (let d of dataList) {
          if (legend.name == d.name) {
            return `${legend.name}: ${d.value}`;
          }
        }
        return `未找到${legend.name}`;
      },
      show: true,
    },
    textStyle: {
      color: "#374151",
    },
    left: "0",
    orient: "vertical",
    top: "middle",
    formatter(name: string) {
      for (let d of dataList) {
        if (name === d.name) {
          const val = typeof d.value === 'number' ? d.value : Number(d.value);
          return `${name}: ${val.toFixed(2)}`;
        }
      }
      return name;
    },
  },
  toolbox: {
    feature: {
      // 下载按钮
    },
  },
  series: [
    {
      name: "消费类型",
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
      data: dataList,
    },
  ],
});

let industrySecondaryDiv: any;
let industrySecondaryChart: echarts.ECharts;

const doQuery = () => {
  if (!selectedCategory) {
    noData.value = true;
    return;
  }

  doApi
    .post("api/entry/analytics/industry-secondary", {
      bookIds,
      primaryCategory: selectedCategory,
      flowType: "支出",
      startDay,
      endDay,
    })
    .then((res) => {
      if (res) {
        // 处理二级分类数据
        if (!res || Object.keys(res).length === 0) {
          noData.value = true;
          totalAmount.value = 0;
          return;
        }

        noData.value = false;
        dataList.length = 0;

        // 处理二级分类数据
        const secondaryCategories: Record<string, number> = {};
        
        // 遍历所有二级分类数据
        Object.entries(res).forEach(([secondaryCategory, categoryData]: [string, any]) => {
          let totalAmount = 0;
          
          // 计算该二级分类在所有账本中的总金额
          Object.values(categoryData).forEach((bookData: any) => {
            totalAmount += bookData.outSum || 0;
          });
          
          if (totalAmount > 0) {
            secondaryCategories[secondaryCategory] = totalAmount;
          }
        });

        // 如果没有找到二级分类，显示一级分类本身
        if (Object.keys(secondaryCategories).length === 0) {
          dataList.push({
            value: "0",
            name: selectedCategory, // 直接显示一级分类名称
            itemStyle: {
              color: '#5470c6' // 使用正常颜色
            }
          });
          totalAmount.value = 0;
        } else {
          // 转换为图表数据格式
          Object.entries(secondaryCategories)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
              dataList.push({
                value: Number(amount).toFixed(2),
                name: category,
              });
            });
          
          // 计算总金额
          totalAmount.value = Object.values(secondaryCategories).reduce((sum, amount) => sum + amount, 0);
        }

        optionRef.value.series[0].data = dataList;
        optionRef.value.legend.textStyle.color = isDark.value
          ? "#e5e7eb"
          : "#374151";
        optionRef.value.series[0].itemStyle.borderColor = isDark.value
          ? "#4b5563"
          : "#d1d5db";

        // 根据项目数量构建最多三列图例，第三列右对齐
        const names = dataList.map((d: any) => d.name);
        const shouldThreeCols = names.length >= 21;
        if (shouldThreeCols) {
          const maxRows = Math.ceil(names.length / 3);
          const col1 = names.slice(0, maxRows);
          const col2 = names.slice(maxRows, maxRows * 2);
          const col3 = names.slice(maxRows * 2);

          const formatter = function(name: string) {
            const item = dataList.find((d: any) => d.name === name);
            if (item) {
              const val = typeof item.value === 'number' ? item.value : Number(item.value);
              return `${name}: ${val.toFixed(2)}`;
            }
            return name;
          } as any;

          // @ts-ignore
          optionRef.value.legend = [
            {
              show: true,
              type: 'plain',
              orient: 'vertical',
              left: 0,
              top: 'middle',
              data: col1,
              textStyle: { color: optionRef.value.legend.textStyle.color, align: 'left' },
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
              textStyle: { color: optionRef.value.legend.textStyle.color, align: 'left' },
              formatter,
            },
            {
              show: true,
              type: 'plain',
              orient: 'vertical',
              right: 0,
              top: 'middle',
              data: col3,
              textStyle: { color: optionRef.value.legend.textStyle.color, align: 'right' },
              formatter,
            },
          ];
          // 右移饼图
          // @ts-ignore
          optionRef.value.series[0].center = ["60%", "50%"];
        } else {
          // 单列默认
          // @ts-ignore
          optionRef.value.legend = {
            tooltip: optionRef.value.legend.tooltip,
            textStyle: { color: optionRef.value.legend.textStyle.color },
            left: '0',
            orient: 'vertical',
            top: 'middle',
            formatter(name: string) {
              const item = dataList.find((d: any) => d.name === name);
              if (item) {
                const val = typeof item.value === 'number' ? item.value : Number(item.value);
                return `${name}: ${val.toFixed(2)}`;
              }
              return name;
            },
          } as any;
        }

        industrySecondaryChart.setOption(optionRef.value);
      }
    });
};

// 监听选中分类变化
watch(() => selectedCategory, () => {
  doQuery();
});

onMounted(() => {
  industrySecondaryDiv = document.getElementById(chartId.value);
  const oldInstance = echarts.getInstanceByDom(industrySecondaryDiv);
  if (oldInstance) {
    oldInstance.dispose();
  }
  industrySecondaryChart = echarts.init(industrySecondaryDiv);
  
  // 添加点击事件监听
  industrySecondaryChart.on('click', (params) => {
    if (params.name) {
      if (params.name === selectedCategory) {
        // 当点击一级分类本身时，传递空字符串作为二级分类，触发一级分类查询
        emit('secondary-category-clicked', selectedCategory, '');
      } else {
        emit('secondary-category-clicked', selectedCategory, params.name);
      }
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
