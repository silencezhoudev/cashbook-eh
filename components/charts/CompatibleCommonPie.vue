<template>
  <div class="w-full">
    <!-- 单账本模式 -->
    <CommonPie 
      v-if="bookState.mode === 'single'"
      :title="title"
      :width="width"
      :height="height"
      :groupBy="groupBy"
      :startDay="startDay"
      :endDay="endDay"
      :flowType="flowType"
      :seriesName="seriesName"
      :showLegend="showLegend"
      :queryField="queryField"
    />
    
    <!-- 多账本模式 -->
    <MultiBookCommonPie
      v-else
      :title="title"
      :width="width"
      :height="height"
      :groupBy="groupBy"
      :startDay="startDay"
      :endDay="endDay"
      :flowType="flowType"
      :seriesName="seriesName"
      :showLegend="showLegend"
      :queryField="queryField"
      :bookIds="bookState.selectedBookIds"
      :books="bookState.books"
    />
  </div>
</template>

<script setup lang="ts">
import { useBookState } from '~/composables/useBookState'
import CommonPie from './CommonPie.vue'
import MultiBookCommonPie from './MultiBookCommonPie.vue'

interface Props {
  title: string
  width: string
  height: string
  groupBy: string
  startDay?: string
  endDay?: string
  flowType?: string
  seriesName?: string
  showLegend?: boolean
  queryField?: string
}

defineProps<Props>()

const { bookState } = useBookState()
</script>
