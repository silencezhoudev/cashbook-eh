<script setup lang="ts">
// 需要登录
definePageMeta({
  layout: "admin",
  middleware: ["admin"],
});

import { del, page, bootstrapRules, rebuildProfile } from "./api";
import { editInfoFlag } from "./flag";
import EditInfoDialog from "./EditInfoDialog.vue";

const pageQuery = ref<PageParam>({ pageSize: 10, pageNum: 1 });
const query = ref<Book | any>({});
const tabledata = ref<{ total?: number; data?: Book[] }>({});
const loading = ref(false);

const editItem = ref<Book | any>();
const editDialogTitle = ref("Title");

// 取消编辑的回调
const cancelEdit = () => {
  // cancel hook
};

const toDelete = (item: Book) => {
  Confirm.open({
    title: "删除确认",
    content: `确定要删除账本【${item.bookName}】吗？`,
    confirm: () => {
      del(item.id)
        .then((res) => {
          Alert.success("删除成功");
          getPages();
        })
        .catch(() => {
          Alert.error("删除失败");
        });
    },
    cancel: () => {
      Alert.info("取消删除");
    },
  });
};

const getPages = () => {
  loading.value = true;
  page(pageQuery.value, query.value).then((res) => {
    tabledata.value = res;
    loading.value = false;
  });
};

const changePage = (newPage: number) => {
  pageQuery.value.pageNum = newPage;
  getPages();
};

const changePageSize = (newSize: number) => {
  pageQuery.value.pageSize = newSize;
  pageQuery.value.pageNum = 1;
  getPages();
};

// 计算分页信息
const totalPages = computed(() => {
  return Math.ceil((tabledata.value.total || 0) / pageQuery.value.pageSize);
});

const startItem = computed(() => {
  return (pageQuery.value.pageNum - 1) * pageQuery.value.pageSize + 1;
});

const endItem = computed(() => {
  const end = pageQuery.value.pageNum * pageQuery.value.pageSize;
  return Math.min(end, tabledata.value.total || 0);
});

const ruleUpdateLoading = ref<Record<number, boolean>>({});
const profileRebuildLoading = ref<Record<number, boolean>>({});
const profileTooltip = reactive<{
  id: number | null;
  text: string;
  top: number;
  left: number;
  placement: "top" | "bottom";
}>({
  id: null,
  text: "",
  top: 0,
  left: 0,
  placement: "bottom",
});

const triggerRuleBootstrap = (item: Book) => {
  Confirm.open({
    title: "更新智能规则",
    content: `将基于用户 #${item.userId} 的历史流水重新生成智能规则，确认继续吗？`,
    confirm: () => executeRuleBootstrap(item),
  });
};

const executeRuleBootstrap = (item: Book) => {
  ruleUpdateLoading.value[item.id] = true;
  bootstrapRules({
    userId: item.userId,
  })
    .then((res) => {
      const created = res?.created ?? 0;
      const attempted = res?.attempted ?? 0;
      Alert.success(
        attempted > 0
          ? `已触发规则更新：生成 ${created}/${attempted} 条`
          : "已触发规则更新"
      );
    })
    .catch((err) => {
      const message =
        err?.m || err?.message || err?.data?.message || "更新规则失败";
      Alert.error(message);
    })
    .finally(() => {
      delete ruleUpdateLoading.value[item.id];
      ruleUpdateLoading.value = { ...ruleUpdateLoading.value };
    });
};

const triggerProfileRebuild = (item: Book) => {
  Confirm.open({
    title: "重建账本画像",
    content: `将基于账本【${item.bookName}】历史流水重新生成画像描述，确认继续吗？`,
    confirm: () => executeProfileRebuild(item),
  });
};

const executeProfileRebuild = (item: Book) => {
  profileRebuildLoading.value[item.id] = true;
  rebuildProfile({
    bookId: item.bookId,
  })
    .then((res) => {
      const message =
        res?.message || `账本【${item.bookName}】画像已重建`;
      Alert.success(message);
      getPages();
    })
    .catch((err) => {
      const message =
        err?.m || err?.message || err?.data?.message || "重建账本画像失败";
      Alert.error(message);
    })
    .finally(() => {
      delete profileRebuildLoading.value[item.id];
      profileRebuildLoading.value = { ...profileRebuildLoading.value };
    });
};

const showProfileTooltip = (item: Book, event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement | null;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  const tooltipWidth = 320;
  const tooltipHeight = 140;
  const margin = 12;

  let left = rect.left + scrollX;
  const maxLeft = scrollX + viewportWidth - tooltipWidth - margin;
  left = Math.min(Math.max(left, scrollX + margin), maxLeft);

  let top = rect.bottom + scrollY + margin;
  let placement: "top" | "bottom" = "bottom";
  if (top + tooltipHeight > scrollY + window.innerHeight - margin) {
    top = rect.top + scrollY - tooltipHeight - margin;
    placement = "top";
  }

  profileTooltip.id = item.id;
  profileTooltip.text = item.profileSummary || "暂无画像信息";
  profileTooltip.top = top;
  profileTooltip.left = left;
  profileTooltip.placement = placement;
};

const hideProfileTooltip = () => {
  profileTooltip.id = null;
  profileTooltip.text = "";
  profileTooltip.top = 0;
  profileTooltip.left = 0;
};

// 初始化
onMounted(() => {
  getPages();
});
</script>

<template>
  <div class="space-y-4">
    <!-- 搜索区域 -->
    <div
      class="bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700 px-4 py-2"
    >
      <div class="flex flex-col lg:flex-row gap-4 items-end">
        <!-- 搜索输入框 -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            v-model="query.userId"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="用户ID"
          />
          <input
            v-model="query.bookId"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="账本ID"
          />
          <input
            v-model="query.bookName"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="账本名称"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3">
          <button
            @click="getPages"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
            <span>查询</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div
      class="bg-gray-800/60 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden"
    >
      <!-- 表格头部 -->
      <div class="px-6 py-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">账本列表</h3>
          <div class="text-sm text-gray-400">
            共 {{ tabledata.total || 0 }} 条记录
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="flex items-center space-x-2 text-gray-400">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>加载中...</span>
        </div>
      </div>

      <!-- 表格内容 -->
      <div
        v-else-if="tabledata.data && tabledata.data.length > 0"
        class="overflow-x-auto"
      >
        <table class="w-full">
          <thead class="bg-gray-700/50">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                ID
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                账本ID
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                用户ID
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                账本名称
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                账本说明
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                账本画像
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                共享Key
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                创建时间
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr
              v-for="item in tabledata.data"
              :key="item.id"
              class="hover:bg-gray-700/30 transition-colors"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-white">
                {{ item.id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-white">
                {{ item.bookId }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-white">
                {{ item.userId }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-white">
                {{ item.bookName }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-300">
                <div class="max-w-xs truncate" :title="item.description || '-'">
                  {{ item.description || "-" }}
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-300">
                <div
                  class="max-w-xs truncate cursor-help"
                  @mouseenter="showProfileTooltip(item, $event)"
                  @mouseleave="hideProfileTooltip"
                >
                  {{ item.profileSummary || "暂无画像信息" }}
                </div>
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono"
              >
                {{ item.shareKey || "-" }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ formatDate(item.createDate) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                  <button
                    @click="triggerRuleBootstrap(item)"
                    :disabled="ruleUpdateLoading[item.id]"
                    class="text-blue-300 hover:text-blue-200 disabled:text-gray-500 transition-colors flex items-center space-x-1"
                    title="重新生成智能规则"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0114-7.5M19 5a9 9 0 01-14 7.5"
                      ></path>
                    </svg>
                    <span class="text-xs">更新规则</span>
                    <svg
                      v-if="ruleUpdateLoading[item.id]"
                      class="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                      />
                    </svg>
                  </button>
                  <button
                    @click="triggerProfileRebuild(item)"
                    :disabled="profileRebuildLoading[item.id]"
                    class="text-emerald-300 hover:text-emerald-200 disabled:text-gray-500 transition-colors flex items-center space-x-1"
                    title="重建账本画像"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 3l1.902 4.848L19 8.764l-3.5 3.409.91 4.984L12 15.708 7.59 17.157l.91-4.984L5 8.764l5.098-.916L12 3z"
                      ></path>
                    </svg>
                    <span class="text-xs">重建画像</span>
                    <svg
                      v-if="profileRebuildLoading[item.id]"
                      class="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                      />
                    </svg>
                  </button>
                  <button
                    @click="toDelete(item)"
                    class="text-red-400 hover:text-red-300 transition-colors"
                    title="删除"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center justify-center py-12">
        <svg
          class="w-12 h-12 text-gray-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          ></path>
        </svg>
        <p class="text-gray-400 text-lg mb-2">暂无数据</p>
        <p class="text-gray-500 text-sm">没有找到符合条件的账本</p>
      </div>

      <!-- 分页 -->
      <div
        v-if="tabledata.data && tabledata.data.length > 0"
        class="px-6 py-4 border-t border-gray-700"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-400">每页显示</span>
            <select
              :value="pageQuery.pageSize"
              @change="
                changePageSize(
                  parseInt(($event.target as HTMLSelectElement).value)
                )
              "
              class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span class="text-sm text-gray-400"
              >条，共 {{ tabledata.total }} 条</span
            >
          </div>

          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-400">
              第 {{ startItem }}-{{ endItem }} 条，共 {{ totalPages }} 页
            </span>
            <div class="flex items-center space-x-1">
              <button
                @click="changePage(1)"
                :disabled="pageQuery.pageNum === 1"
                class="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded transition-colors"
              >
                首页
              </button>
              <button
                @click="changePage(pageQuery.pageNum - 1)"
                :disabled="pageQuery.pageNum === 1"
                class="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded transition-colors"
              >
                上一页
              </button>
              <span class="px-3 py-1 text-sm bg-blue-600 text-white rounded">
                {{ pageQuery.pageNum }}
              </span>
              <button
                @click="changePage(pageQuery.pageNum + 1)"
                :disabled="pageQuery.pageNum === totalPages"
                class="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded transition-colors"
              >
                下一页
              </button>
              <button
                @click="changePage(totalPages)"
                :disabled="pageQuery.pageNum === totalPages"
                class="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded transition-colors"
              >
                尾页
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <EditInfoDialog
    :item="editItem"
    :title="editDialogTitle"
    @success="getPages"
    @cancel="cancelEdit"
    v-if="editInfoFlag"
  />

  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="profileTooltip.id"
        class="fixed z-50 pointer-events-none px-2"
        :style="{ top: profileTooltip.top + 'px', left: profileTooltip.left + 'px' }"
      >
        <div
          class="w-80 max-w-[calc(100vw-32px)] bg-gray-900 text-white text-xs p-3 rounded-md shadow-2xl border border-gray-700 whitespace-pre-wrap break-words"
          :class="profileTooltip.placement === 'top' ? 'origin-bottom' : 'origin-top'"
        >
          {{ profileTooltip.text }}
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
