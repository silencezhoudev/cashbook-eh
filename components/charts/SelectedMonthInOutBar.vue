<template>
  <div class="chart-common-container">
    <div
      v-if="title"
      class="relative w-full border-b border-gray-200 dark:border-gray-700 mb-2 h-12 md:mb-4"
    >
      <div class="flex items-center justify-center gap-2">
        <h4
          class="md:text-center text-lg font-semibold text-green-950 dark:text-white my-2"
        >
          {{ title }}<span v-if="currentMonth">（{{ currentMonth }}）</span>
        </h4>
        <div class="chart-info-tooltip relative inline-flex items-center">
          <InformationCircleIcon class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-help" />
          <div class="chart-info-content">
            显示选中月份的收支情况，按消费类型分组，聚合所有账本数据，不包括转账和借贷
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
import * as echarts from 'echarts'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useBookState } from '~/composables/useBookState'
import { getAnalyticsData } from '~/utils/analyticsApi'
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

interface Props {
  title: string
  width: string
  height: string
  selectedYear?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{ 'bar-click': [data: { flowType: string; category: string; month: string; actualCategories?: string[] }] }>();

const { bookState, getAllSelectedBookIds } = useBookState()

const chartId = ref(`selectedMonthInOutDiv-${Math.random().toString(36).substr(2, 9)}`)
let chartDiv: any
let chart: echarts.ECharts

const currentMonth = ref<string>('')
const noData = ref(false)

const seriesIn = ref<number[]>([])
const seriesOut = ref<number[]>([])
const xAxis = ref<string[]>([])

const categoryDataCache = ref<Record<string, { income: number, expense: number }>>({})
const lastIncomeResult = ref<any>(null)
const lastExpenseResult = ref<any>(null)
const MAX_VISIBLE_CATEGORIES = 8 // 最多显示8个分类

/**
 * 合并小额分类
 * @param categories 分类及其金额的 Map
 * @param otherLabel 其他分类的标签名称
 * @returns 处理后的分类数组和映射关系
 */
const mergeSmallCategories = (
  categories: Map<string, number>,
  otherLabel: string
): { sortedCategories: string[], categoryMap: Map<string, string> } => {
  if (categories.size <= MAX_VISIBLE_CATEGORIES) {
    const sortedCategories = Array.from(categories.keys()).sort()
    const categoryMap = new Map<string, string>()
    sortedCategories.forEach(cat => categoryMap.set(cat, cat))
    return { sortedCategories, categoryMap }
  }

  const sorted = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])
  
  const topCategories = sorted.slice(0, MAX_VISIBLE_CATEGORIES)
  const otherCategories = sorted.slice(MAX_VISIBLE_CATEGORIES)
  
  const otherTotal = otherCategories.reduce((sum, [, amount]) => sum + amount, 0)
  
  const sortedCategories = [
    ...topCategories.map(([cat]) => cat),
    otherLabel
  ].sort()
  
  const categoryMap = new Map<string, string>()
  topCategories.forEach(([cat]) => categoryMap.set(cat, cat))
  otherCategories.forEach(([cat]) => categoryMap.set(cat, otherLabel))
  
  categories.set(otherLabel, otherTotal)
  
  return { sortedCategories, categoryMap }
}

const render = () => {
  if (!chart) return
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: [
        { name: '收入', textStyle: { color: 'rgba(76, 152, 112, 0.9)' } },
        { name: '支出', textStyle: { color: 'rgba(217,159,8, 0.9)' } }
      ]
    },
    xAxis: { 
      type: 'category', 
      data: xAxis.value, 
      name: '分类',
      axisLabel: {
        rotate: 0,
        fontSize: 11,
        interval: 0, // 强制显示所有标签
        overflow: 'truncate', // 如果太长则截断
        width: 70, // 设置标签最大宽度
        ellipsis: '...' // 超出部分显示省略号
      }
    },
    yAxis: { type: 'value', name: '金额(元)' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params || params.length === 0) return ''
        const category = params[0].axisValue
        const incomeParam = params.find((p: any) => p.seriesName === '收入')
        const expenseParam = params.find((p: any) => p.seriesName === '支出')
        
        const incomeVal = incomeParam?.value ?? 0
        const expenseVal = expenseParam?.value ?? 0
        
        let html = `${category}<br/>`
        
        if (incomeVal !== null && Number(incomeVal) > 0) {
          html += `收入: ¥${Number(incomeVal).toFixed(2)}<br/>`
        }
        if (expenseVal !== null && Number(expenseVal) > 0) {
          html += `支出: ¥${Number(expenseVal).toFixed(2)}<br/>`
        }
        
        return html
      }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: seriesIn.value,
        itemStyle: { color: 'rgba(76, 152, 112, 0.9)' },
        label: { 
          show: true, 
          position: 'top', 
          color: 'rgba(76, 152, 112, 0.9)',
          formatter: (params: any) => {
            return Math.round(Number(params.value)).toString()
          }
        }
      },
      {
        name: '支出',
        type: 'bar',
        data: seriesOut.value,
        itemStyle: { color: 'rgba(217,159,8, 0.9)' },
        label: { 
          show: true, 
          position: 'top', 
          color: 'rgba(217,159,8, 0.9)',
          formatter: (params: any) => {
            return Math.round(Number(params.value)).toString()
          }
        }
      }
    ]
  })
}

const loadData = async () => {
  if (!currentMonth.value) {
    noData.value = true
    return
  }

  const startDay = `${currentMonth.value}-01`
  const endDay = `${currentMonth.value}-31`

  try {
    let bookIds = bookState.value.books.map(b => b.bookId)
    if (!bookIds || bookIds.length === 0) {
      noData.value = true
      return
    }

    const [incomeRes, expenseRes]: any[] = await Promise.all([
      getAnalyticsData('common', { groupBy: 'industryType', flowType: '收入', startDay, endDay }, 'multi', bookIds),
      getAnalyticsData('common', { groupBy: 'industryType', flowType: '支出', startDay, endDay }, 'multi', bookIds)
    ])

    const incomeCategories = new Map<string, number>()
    if (incomeRes) {
      Object.entries(incomeRes).forEach(([category, books]: [string, any]) => {
        const totalIncome = Object.values(books).reduce((acc: number, v: any) => acc + (Number(v.inSum) || 0), 0)
        if (totalIncome > 0) {
          incomeCategories.set(category, totalIncome)
        }
      })
    }

    const expenseCategories = new Map<string, number>()
    if (expenseRes) {
      Object.entries(expenseRes).forEach(([category, books]: [string, any]) => {
        const totalExpense = Object.values(books).reduce((acc: number, v: any) => acc + (Number(v.outSum) || 0), 0)
        if (totalExpense > 0) {
          expenseCategories.set(category, totalExpense)
        }
      })
    }

    const incomeResult = mergeSmallCategories(new Map(incomeCategories), '其他收入')
    const expenseResult = mergeSmallCategories(new Map(expenseCategories), '其他支出')
    
    const allDisplayCategories = new Set([
      ...incomeResult.sortedCategories,
      ...expenseResult.sortedCategories
    ])

    const allCategoryTotals = new Map<string, number>()
    allDisplayCategories.forEach((category) => {
      const income = incomeCategories.get(category) || 0
      const expense = expenseCategories.get(category) || 0
      allCategoryTotals.set(category, Math.abs(Number(income)) + Math.abs(Number(expense)))
    })

    function isOtherCategory(cat: string) {
      return cat.startsWith('其他')
    }
    
    const sortedMainCategories = Array.from(allDisplayCategories)
      .filter(cat => !isOtherCategory(cat))
      .sort((a, b) => (allCategoryTotals.get(b)! - allCategoryTotals.get(a)!))
    const sortedOtherCategories = Array.from(allDisplayCategories)
      .filter(isOtherCategory)
    const finalCategories = [...sortedMainCategories, ...sortedOtherCategories]
    
    const finalIncomeMap = new Map<string, number>()
    const finalExpenseMap = new Map<string, number>()
    
    incomeCategories.forEach((amount, category) => {
      const displayCategory = incomeResult.categoryMap.get(category) || category
      const existing = finalIncomeMap.get(displayCategory) || 0
      finalIncomeMap.set(displayCategory, existing + amount)
    })
    
    expenseCategories.forEach((amount, category) => {
      const displayCategory = expenseResult.categoryMap.get(category) || category
      const existing = finalExpenseMap.get(displayCategory) || 0
      finalExpenseMap.set(displayCategory, existing + amount)
    })

    xAxis.value = finalCategories
    seriesIn.value = finalCategories.map(category => {
      const income = finalIncomeMap.get(category) || 0
      return income > 0 ? Number(income).toFixed(2) as unknown as number : null
    })
    seriesOut.value = finalCategories.map(category => {
      const expense = finalExpenseMap.get(category) || 0
      return expense > 0 ? Number(expense).toFixed(2) as unknown as number : null
    })

    categoryDataCache.value = {}
    finalCategories.forEach(category => {
      categoryDataCache.value[category] = {
        income: finalIncomeMap.get(category) || 0,
        expense: finalExpenseMap.get(category) || 0
      }
    })

    noData.value = (finalCategories.length === 0) || (seriesIn.value.every(v => Number(v) === 0) && seriesOut.value.every(v => Number(v) === 0))
    render()
    lastIncomeResult.value = incomeResult
    lastExpenseResult.value = expenseResult
  } catch (e) {
    console.error('load selected month data failed', e)
    noData.value = true
  }
}

const onMonthSelected = (evt: any) => {
  currentMonth.value = evt?.detail?.month || ''
  loadData()
}


onMounted(() => {
  chartDiv = document.getElementById(chartId.value)
  const oldInstance = echarts.getInstanceByDom(chartDiv)
  if (oldInstance) oldInstance.dispose()
  chart = echarts.init(chartDiv)
  chart.on('click', (params: any) => {
    if (!params || !params.seriesName || !params.name) return;
    let actualCategories: string[] | undefined = undefined;
    let actualIndustryTypes: string[] | undefined = undefined;
    let actualBookNames: string[] | undefined = undefined;
    if (params.name === '其他收入' || params.name === '其他支出' || params.name === '其他') {
      const mapObj = params.seriesName === '支出' ? lastExpenseResult.value : lastIncomeResult.value;
      actualCategories = Array.from(mapObj.categoryMap.entries()).filter(([ori, mapped]) => mapped === params.name && ori !== params.name).map(([ori]) => ori);
      const books = bookState.value?.books || [];
      actualIndustryTypes = actualCategories.filter(cat => !books.some(b => b.bookName === cat));
      actualBookNames = actualCategories.filter(cat => books.some(b => b.bookName === cat));
    }
    emit('bar-click', {
      flowType: params.seriesName,
      category: params.name,
      month: currentMonth.value,
      actualIndustryTypes,
      actualBookNames
    });
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('month-selected', onMonthSelected as any)
  }
  const now = new Date()
  const y = now.getFullYear()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  currentMonth.value = `${y}-${m}`
  loadData()
})

watch(() => props.selectedYear, () => {
  if (currentMonth.value) {
    loadData()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('month-selected', onMonthSelected as any)
  }
})

defineExpose({
  setMonth: (month: string) => {
    currentMonth.value = month
    loadData()
  }
})

</script>

<style scoped>
.chart-content {
  padding: 10px;
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


