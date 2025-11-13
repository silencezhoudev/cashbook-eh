<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style="z-index: 999">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-auto" @click.stop>
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">编辑转账</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">转出账户</label>
          <select v-model="form.fromAccountId" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">请选择</option>
            <option v-for="acc in activeAccounts" :key="acc.id" :value="acc.id">{{ acc.name }} ({{ acc.type }})</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">转入账户</label>
          <select v-model="form.toAccountId" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">请选择</option>
            <option v-for="acc in activeAccounts" :key="acc.id" :value="acc.id" :disabled="acc.id === form.fromAccountId">{{ acc.name }} ({{ acc.type }})</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">金额</label>
          <input v-model.number="form.amount" type="number" step="0.01" min="0.01" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">日期</label>
          <input v-model="form.day" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">说明</label>
          <input v-model="form.name" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">备注</label>
          <textarea v-model="form.description" rows="3" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"></textarea>
        </div>
      </div>

      <div class="flex justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700">
        <button @click="$emit('close')" class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors">取消</button>
        <button :disabled="!canSubmit" @click="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors">保存</button>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { Alert } from "~/utils/alert";

interface Props {
  show: boolean;
  transfer: any; // 由列表传入的转账聚合对象（包含 originalTransfer、fromAccount、toAccount 等）
  accounts: any[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: []; saved: [] }>();

const form = reactive({
  id: 0,
  fromAccountId: undefined as number | undefined,
  toAccountId: undefined as number | undefined,
  amount: undefined as number | undefined,
  day: "",
  name: "",
  description: "",
});

const activeAccounts = computed(() => (props.accounts || [])); // 所有账户都可用

watch(() => props.transfer, (val) => {
  if (!val) return;
  form.id = val.originalTransfer?.id || val.id;
  form.fromAccountId = val.fromAccount?.id || val.originalTransfer?.fromAccountId;
  form.toAccountId = val.toAccount?.id || val.originalTransfer?.toAccountId;
  form.amount = Number(val.money || val.originalTransfer?.amount || 0);
  form.day = val.day || val.originalTransfer?.day || new Date().toISOString().split("T")[0];
  form.name = val.originalTransfer?.name || val.name || "";
  form.description = val.originalTransfer?.description || val.description || "";
}, { immediate: true });

const canSubmit = computed(() => {
  return !!form.id && !!form.fromAccountId && !!form.toAccountId && form.fromAccountId !== form.toAccountId && !!form.amount && form.amount > 0;
});

const submit = async () => {
  if (!canSubmit.value) {
    Alert.error("请完整填写表单");
    return;
  }
  try {
    await doApi.post("api/entry/transfer/update", {
      id: form.id,
      bookId: localStorage.getItem("bookId"),
      fromAccountId: form.fromAccountId,
      toAccountId: form.toAccountId,
      amount: form.amount,
      day: form.day,
      name: form.name,
      description: form.description,
    });
    Alert.success("更新成功");
    emit("saved");
    emit("close");
  } catch (e: any) {
    console.error(e);
    Alert.error(e?.message || "更新失败");
  }
};
</script>


