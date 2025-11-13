<template>
  <div class="w-full">
    <!-- 单账本模式 -->
    <DailyLineChart 
      v-if="bookState.mode === 'single'"
      :title="title"
      :width="width"
      :height="height"
    />
    
    <!-- 多账本模式 -->
    <MultiBookDailyLineChart
      v-else
      :title="title"
      :width="width"
      :height="height"
      :bookIds="bookState.selectedBookIds"
      :books="bookState.books"
    />
  </div>
</template>

<script setup lang="ts">
import { useBookState } from '~/composables/useBookState'
import DailyLineChart from './DailyLineChart.vue'
import MultiBookDailyLineChart from './MultiBookDailyLineChart.vue'

interface Props {
  title: string
  width: string
  height: string
}

defineProps<Props>()

const { bookState } = useBookState()
</script>
