<template>
  <div class="w-full">
    <!-- 单账本模式 -->
    <MonthBar 
      v-if="bookState.mode === 'single'"
      :title="title"
      :width="width"
      :height="height"
    />
    
    <!-- 多账本模式 -->
    <MultiBookMonthBar
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
import MonthBar from './MonthBar.vue'
import MultiBookMonthBar from './MultiBookMonthBar.vue'

interface Props {
  title: string
  width: string
  height: string
}

defineProps<Props>()

const { bookState } = useBookState()
</script>
