<template>
  <div class="w-full">
    <!-- 单账本模式 -->
    <MonthlyAssetCumulativeChart 
      v-if="bookState.mode === 'single'"
      :title="title"
      :width="width"
      :height="height"
      :selectedYear="selectedYear"
    />
    
    <!-- 多账本模式 -->
    <MultiBookMonthlyAssetCumulativeChart
      v-else
      :title="title"
      :width="width"
      :height="height"
      :bookIds="bookState.selectedBookIds"
      :books="bookState.books"
      :selectedYear="selectedYear"
    />
  </div>
</template>

<script setup lang="ts">
import { useBookState } from '~/composables/useBookState'
import MonthlyAssetCumulativeChart from './MonthlyAssetCumulativeChart.vue'
import MultiBookMonthlyAssetCumulativeChart from './MultiBookMonthlyAssetCumulativeChart.vue'

interface Props {
  title: string
  width: string
  height: string
  selectedYear?: string
}

defineProps<Props>()

const { bookState } = useBookState()
</script>
