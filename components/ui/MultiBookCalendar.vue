<template>
  <div class="multi-book-calendar">
    <!-- 账本选择器 -->
    <div class="book-selector-section mb-6">
      <BookSelector 
        :books="books" 
        :selected-books="selectedBooks"
        @update-selection="updateBookSelection"
        @color-change="handleColorChange"
      />
    </div>

    <!-- 日历头部 -->
    <div class="calendar-header mb-4">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ currentMonthText }}
        </h2>
        <div class="flex gap-2">
          <button
            @click="prevMonth"
            class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <button
            @click="nextMonth"
            class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- 日历网格 -->
    <div class="calendar-grid bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <!-- 星期标题 -->
      <div class="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
        <div
          v-for="day in weekdays"
          :key="day"
          class="py-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-400"
        >
          {{ day }}
        </div>
      </div>

      <!-- 日期网格 -->
      <div class="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600">
        <div
          v-for="date in calendarDates"
          :key="date.key"
          class="min-h-32 p-3 bg-white dark:bg-gray-800 relative hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          :class="{
            'bg-gray-100 dark:bg-gray-900 text-gray-400': !date.isCurrentMonth,
            'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300': date.isToday
          }"
        >
          <!-- 日期数字 -->
          <div class="flex justify-between items-start mb-2">
            <span
              class="text-lg font-medium"
              :class="{
                'text-blue-600 dark:text-blue-400 font-bold': date.isToday,
                'text-gray-900 dark:text-gray-100': date.isCurrentMonth && !date.isToday
              }"
            >
              {{ date.day }}
            </span>
            <button
              v-if="date.isCurrentMonth"
              @click="addFlow(date)"
              class="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all hover:scale-110 opacity-70 hover:opacity-100"
            >
              <PlusIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- 多账本流水显示 -->
          <div v-if="date.isCurrentMonth" class="space-y-1">
            <div
              v-for="bookData in getDateBookData(date.dateString)"
              :key="bookData.bookId"
              @click="clickBookFlow(date.dateString, bookData)"
              class="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-sm"
              :style="{ 
                backgroundColor: bookData.color + '20',
                borderLeft: `3px solid ${bookData.color}`
              }"
            >
              <div
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: bookData.color }"
              ></div>
              <span class="text-gray-700 dark:text-gray-300">
                {{ bookData.bookName }}
              </span>
              <span class="ml-auto font-bold">
                {{ formatAmount(bookData.total) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@heroicons/vue/24/outline";
import BookSelector from "./BookSelector.vue";
import { useMultiBookCalendar } from "~/composables/useMultiBookCalendar";

// 使用组合式函数管理状态
const {
  books,
  selectedBooks,
  calendarData,
  currentDate,
  updateBookSelection,
  updateBookColor,
  fetchCalendarData,
  init
} = useMultiBookCalendar();

// 星期标题
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

// 当前月份文本
const currentMonthText = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth() + 1;
  return `${year} 年 ${month} 月`;
});

// 日历日期计算
const calendarDates = computed(() => {
  const dates = [];
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = new Date(firstDay);
  startDay.setDate(startDay.getDate() - firstDay.getDay());

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDay);
    date.setDate(startDay.getDate() + i);

    dates.push({
      date: new Date(date),
      dateString: formatDate(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: isSameDay(date, new Date()),
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    });
  }

  return dates;
});

// 获取指定日期的账本数据
const getDateBookData = (dateString: string) => {
  const dayData = calendarData.value[dateString];
  if (!dayData) return [];

  return Object.values(dayData).map(bookData => ({
    ...bookData,
    total: bookData.income - bookData.expense
  }));
};

// 事件处理
const prevMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  );
  fetchCalendarData();
};

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  );
  fetchCalendarData();
};

const addFlow = (date: any) => {
  // 触发添加流水事件
  emit('add-flow', date);
};

const clickBookFlow = (dateString: string, bookData: any) => {
  // 触发点击账本流水事件
  emit('click-book-flow', dateString, bookData);
};

const handleColorChange = (bookId: string, color: string) => {
  updateBookColor(bookId, color);
};

// 工具函数
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const formatAmount = (amount: number): string => {
  if (amount === 0) return "0";
  if (amount > 0) return `+${amount.toFixed(0)}`;
  return amount.toFixed(0);
};

// 监听选中账本变化
watch(selectedBooks, () => {
  fetchCalendarData();
}, { deep: true });

// 监听当前日期变化
watch(currentDate, () => {
  fetchCalendarData();
});

// 组件挂载时初始化
onMounted(async () => {
  await init();
  fetchCalendarData();
});

// 定义事件
const emit = defineEmits<{
  'add-flow': [date: any];
  'click-book-flow': [dateString: string, bookData: any];
}>();
</script>

<style scoped>
.calendar-grid {
  min-height: 600px;
}

.date-cell {
  min-height: 120px;
}

@media (max-width: 768px) {
  .date-cell {
    min-height: 80px;
  }
}
</style>
