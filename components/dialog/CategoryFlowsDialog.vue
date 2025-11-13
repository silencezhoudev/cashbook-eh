<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click.self="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ primaryCategory }} / {{ secondaryCategory }} - 明细
        </h2>
        <button @click="close" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ✕
        </button>
      </div>

      <div class="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">总记录数</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ summary.totalCount }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">总金额(支出)</p>
            <p class="text-xl font-semibold text-red-600">{{ summary.totalAmount.toFixed(2) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400">账本</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ booksLabel }}</p>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <FlowsTable
          :flows="flows"
          :selected-items="[]"
          :is-all-selected="false"
          :current-page="1"
          :page-size="flows.length"
          :total="flows.length"
          :total-pages="1"
          :page-numbers="[]"
          :loading="loading"
          :default-monthly-collapse="false"
          @toggle-select-all="() => {}"
          @toggle-select-item="() => {}"
          @edit-item="() => {}"
          @edit-transfer="() => {}"
          @delete-item="() => {}"
          @change-page="() => {}"
          @change-page-size="() => {}"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import FlowsTable from '@/components/flows/FlowsTable.vue';
import { doApi } from '@/utils/api';

interface Props {
  show: boolean;
  bookIds: string[];
  primaryCategory: string;
  secondaryCategory?: string;
  startDay?: string;
  endDay?: string;
  books?: { bookId: string; bookName: string }[]; // 新增: 带账本信息
  actualIndustryTypes?: string[]; // “其他”项真实分类
  actualBookNames?: string[]; // “其他”项账本名分组
}

const props = defineProps<Props & { flowType?: string }>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const flows = ref<any[]>([]);
const summary = ref({ totalCount: 0, totalAmount: 0 });

const booksLabel = computed(() => `${props.bookIds.length} 个`);

const fetchFlows = async () => {
  if (!props.primaryCategory && (!props.actualIndustryTypes || props.actualIndustryTypes.length === 0)) return;
  loading.value = true;
  try {
    let url = '';
    let isBookName = false;
    if (Array.isArray(props.books) && props.books.length > 0) {
      isBookName = props.books.some(b => b.bookName === props.primaryCategory);
    } else if (Array.isArray(props.bookIds) && props.bookIds.length === 1 && props.primaryCategory) {
      isBookName = true;
    }
    const body: any = {
      bookIds: props.bookIds,
      primaryCategory: props.primaryCategory,
      flowType: props.flowType || '支出',
      startDay: props.startDay,
      endDay: props.endDay,
    };
    // "其他"项: 携带实际合并分类
    if (props.actualIndustryTypes && props.actualIndustryTypes.length > 0) {
      url = 'api/entry/analytics/category-flows';
      body.actualIndustryTypes = props.actualIndustryTypes;
      body.actualBookNames = props.actualBookNames;
      body.secondaryCategory = '';
    } else if (isBookName) {
      url = 'api/entry/analytics/category-flows';
      body.secondaryCategory = '全部';
    } else {
      url = (props.secondaryCategory && props.secondaryCategory.trim() !== '')
        ? 'api/entry/analytics/category-flows'
        : 'api/entry/analytics/category-flows-primary';
      body.secondaryCategory = props.secondaryCategory || '';
    }
    const res = await doApi.post(url, body);
    const data = res?.d || res;
    flows.value = data.flows || [];
    summary.value = data.summary || { totalCount: 0, totalAmount: 0 };
  } finally {
    loading.value = false;
  }
};

const close = () => emit('close');

watch(() => [props.show, props.primaryCategory, props.secondaryCategory, props.startDay, props.endDay, props.bookIds], () => {
  if (props.show) fetchFlows();
}, { deep: true });

onMounted(() => {
  if (props.show) fetchFlows();
});
</script>

<style scoped></style>


