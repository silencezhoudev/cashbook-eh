<script setup lang="ts">
// 需要登录
definePageMeta({
  layout: "public",
  middleware: ["auth"],
});

import {
  del,
  page,
  bootstrapRules,
  rebuildProfile,
  exportProfileKeywords,
  importProfileKeywords,
} from "./api";
import { editInfoFlag, showGetShareDialog } from "./flag";
import EditInfoDialog from "./EditInfoDialog.vue";
import GetShareDialog from "./GetShareDialog.vue";
import BookImportComponent from "~/components/books/BookImportComponent.vue";
import { generateMobileFriendlyPageNumbers } from "~/utils/common";
import { exportJson } from "~/utils/fileUtils";
import {
  PencilIcon,
  ShareIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/vue/24/outline";

const { isDark } = useAppTheme();

const pageQuery = ref<PageParam>({ pageSize: 100, pageNum: 1 });
const query = ref<Book | any>({});
const tabledata = ref<{ total?: number; data?: Book[] }>({});
const loading = ref(false);

const editItem = ref<Book | any>();
const editDialogTitle = ref("Title");

// 新增
const addItem = () => {
  editDialogTitle.value = "新增账本";
  editItem.value = {};
  editInfoFlag.value = true;
};

// 编辑基本信息
const editItemInfo = (item: Book) => {
  editDialogTitle.value = "编辑账本";
  editItem.value = item;
  editInfoFlag.value = true;
};

const getShare = () => {
  showGetShareDialog.value = true;
};

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
          error("delete fail");
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

const changePage = (pageNum: number) => {
  pageQuery.value.pageNum = pageNum;
  getPages();
};

const changePageSize = (pageSize: number | string) => {
  pageQuery.value.pageSize = Number(pageSize);
  pageQuery.value.pageNum = 1;
  getPages();
};

const toShare = (item: Book) => {
  Confirm.open({
    title: "提示",
    content: `确定要分享账本【${item.bookName}】吗？分享后无法取消分享！`,
    confirm: () => {
      doApi.post("api/entry/book/share", { id: item.id }).then((res) => {
        Alert.success("分享成功");
        getPages();
      });
    },
    cancel: () => {
      Alert.info("取消分享");
    },
  });
};

// 复制分享Key到剪贴板
const copyShareKey = async (shareKey: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 现代浏览器的异步剪贴板API
      await navigator.clipboard.writeText(shareKey);
      Alert.success("分享Key已复制到剪贴板");
    } else {
      // 降级方案：使用传统的document.execCommand
      const textArea = document.createElement("textarea");
      textArea.value = shareKey;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        Alert.success("分享Key已复制到剪贴板");
      } else {
        throw new Error("复制失败");
      }
    }
  } catch (err) {
    console.error("复制失败:", err);
    Alert.error("复制失败，请手动选择复制");
    // 可选：显示一个包含分享Key的对话框，用户可以手动复制
    showShareKeyDialog(shareKey);
  }
};

// 显示分享Key对话框（降级方案）
const showShareKeyDialog = (shareKey: string) => {
  Confirm.open({
    title: "分享Key",
    content: `请手动复制以下分享Key：\n\n${shareKey}`,
    confirm: () => {
      // 用户点击确定
    },
    cancel: () => {
      // 用户点击取消
    },
  });
};

// 计算分页信息
const totalPages = computed(() =>
  Math.ceil((tabledata.value?.total || 0) / pageQuery.value.pageSize)
);

// 移动端友好的页码生成
const mobileFriendlyPageNumbers = computed(() => {
  return generateMobileFriendlyPageNumbers(
    pageQuery.value.pageNum,
    totalPages.value,
    3
  );
});

const perBookRuleLoading = ref<Record<number, boolean>>({});
const bulkRuleUpdating = ref(false);
const profileUpdateLoading = ref<Record<number, boolean>>({});
const bulkProfileUpdating = ref(false);
const profileImportLoading = ref<Record<number, boolean>>({});
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

const credentialDialog = reactive<{
  visible: boolean;
  mode: "single" | "all";
  username: string;
  password: string;
  targetUserId: number | null;
  targetBookId: number | null;
  targetBookName: string;
}>({
  visible: false,
  mode: "single",
  username: "",
  password: "",
  targetUserId: null,
  targetBookId: null,
  targetBookName: "",
});

const credentialSubmitting = ref(false);

const openRuleUpdateDialog = (book: Book) => {
  credentialDialog.visible = true;
  credentialDialog.mode = "single";
  credentialDialog.username = "";
  credentialDialog.password = "";
  credentialDialog.targetUserId = book.userId || null;
  credentialDialog.targetBookId = book.id || null;
  credentialDialog.targetBookName = book.bookName || "";
};

const openBulkRuleUpdateDialog = () => {
  credentialDialog.visible = true;
  credentialDialog.mode = "all";
  credentialDialog.username = "";
  credentialDialog.password = "";
  credentialDialog.targetBookId = null;
  credentialDialog.targetBookName = "";
  credentialDialog.targetUserId =
    tabledata.value.data && tabledata.value.data.length > 0
      ? tabledata.value.data[0].userId || null
      : null;
};

const closeCredentialDialog = () => {
  credentialDialog.visible = false;
  credentialDialog.username = "";
  credentialDialog.password = "";
  credentialDialog.targetUserId = null;
  credentialDialog.targetBookId = null;
  credentialDialog.targetBookName = "";
};

const submitCredentialDialog = () => {
  if (credentialSubmitting.value) {
    return;
  }
  if (!credentialDialog.username || !credentialDialog.password) {
    Alert.error("请输入管理员账号和密码");
    return;
  }

  const payload = {
    userId: credentialDialog.targetUserId || undefined,
    adminAccount: credentialDialog.username.trim(),
    adminPassword: credentialDialog.password,
  };

  const targetBookId = credentialDialog.targetBookId;
  const targetBookName = credentialDialog.targetBookName;
  const mode = credentialDialog.mode;

  credentialSubmitting.value = true;

  if (targetBookId) {
    perBookRuleLoading.value[targetBookId] = true;
  } else if (mode === "all") {
    bulkRuleUpdating.value = true;
  }

  bootstrapRules(payload)
    .then((res) => {
      const created = res?.created ?? 0;
      const attempted = res?.attempted ?? 0;
      const scope =
        mode === "all" ? "全部账本" : `账本【${targetBookName || "-"}】`;
      Alert.success(
        attempted > 0
          ? `${scope}：生成 ${created}/${attempted} 条规则`
          : `${scope}：已触发规则更新`
      );
      closeCredentialDialog();
    })
    .catch((err) => {
      const message =
        err?.m || err?.message || err?.data?.message || "更新规则失败";
      Alert.error(message);
    })
    .finally(() => {
      credentialSubmitting.value = false;
      if (targetBookId) {
        delete perBookRuleLoading.value[targetBookId];
        perBookRuleLoading.value = { ...perBookRuleLoading.value };
      } else if (mode === "all") {
        bulkRuleUpdating.value = false;
      }
    });
};

const triggerProfileRebuild = (book: Book) => {
  Confirm.open({
    title: "重建账本画像",
    content: `将立即基于账本【${book.bookName}】的历史流水重新生成画像描述，并更新账本说明，确认继续吗？`,
    confirm: () => executeProfileRebuild(book),
  });
};

const executeProfileRebuild = (book: Book) => {
  profileUpdateLoading.value[book.id] = true;
  rebuildProfile({ bookId: book.bookId })
    .then((res) => {
      const message =
        res?.message || `账本【${book.bookName}】画像已重建`;
      Alert.success(message);
      getPages();
    })
    .catch((err) => {
      const message =
        err?.m || err?.message || err?.data?.message || "重建账本画像失败";
      Alert.error(message);
    })
    .finally(() => {
      delete profileUpdateLoading.value[book.id];
      profileUpdateLoading.value = { ...profileUpdateLoading.value };
    });
};

// 画像关键词导出
const triggerProfileExport = (book: Book) => {
  exportProfileKeywords({ bookId: book.bookId })
    .then((res) => {
      const fileName = `${book.bookName || book.bookId}-画像关键词.json`;
      exportJson(fileName, JSON.stringify(res || {}, null, 2));
      Alert.success("已导出画像关键词");
    })
    .catch((err) => {
      const message =
        err?.m || err?.message || err?.data?.message || "导出失败";
      Alert.error(message);
    });
};

// 画像关键词导入
const importFileInput = ref<HTMLInputElement | null>(null);
const importTargetBook = ref<Book | null>(null);

const triggerProfileImport = (book: Book) => {
  importTargetBook.value = book;
  if (importFileInput.value) {
    importFileInput.value.value = "";
    importFileInput.value.click();
  }
};

const onImportFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  const target = importTargetBook.value;
  if (!file || !target) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result as string;
      const json = JSON.parse(text);
      profileImportLoading.value[target.id] = true;
      importProfileKeywords({
        bookId: target.bookId,
        data: json,
      })
        .then((res) => {
          const message =
            res?.message || `账本【${target.bookName}】关键词已导入`;
          Alert.success(message);
          getPages();
        })
        .catch((err) => {
          const message =
            err?.m || err?.message || err?.data?.message || "导入失败";
          Alert.error(message);
        })
        .finally(() => {
          delete profileImportLoading.value[target.id];
          profileImportLoading.value = { ...profileImportLoading.value };
          importTargetBook.value = null;
          if (input) {
            input.value = "";
          }
        });
    } catch (err: any) {
      console.error("导入文件解析失败:", err);
      Alert.error("文件解析失败，请确认为有效的画像导出文件");
    }
  };
  reader.readAsText(file, "utf-8");
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

const triggerBulkProfileRebuild = () => {
  if (bulkProfileUpdating.value) {
    return;
  }
  Confirm.open({
    title: "一键重建画像",
    content: "将为当前账户下的全部账本重新生成画像摘要，确认继续吗？",
    confirm: () => {
      bulkProfileUpdating.value = true;
      rebuildProfile({})
        .then((res) => {
          const message =
            res?.message || "已开始重建全部账本画像，请稍后查看结果";
          Alert.success(message);
          getPages();
        })
        .catch((err) => {
          const message =
            err?.m || err?.message || err?.data?.message || "重建账本画像失败";
          Alert.error(message);
        })
        .finally(() => {
          bulkProfileUpdating.value = false;
        });
    },
  });
};

// 在组件挂载时获取数据
onMounted(() => {
  getPages();
});
</script>

<template>
  <div class="p-2 md:p-4 bg-gray-50 dark:bg-green-950/20 min-h-full">
    <input
      ref="importFileInput"
      type="file"
      accept="application/json"
      class="hidden"
      @change="onImportFileChange"
    />
    <!-- 搜索和操作栏 -->
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 mb-2 md:mb-4"
    >
      <!-- 宽屏：左右布局，窄屏：分两行 -->
      <div class="flex flex-col lg:flex-row gap-2">
        <!-- 搜索区域 -->
        <div class="flex space-x-2">
          <div class="relative">
            <MagnifyingGlassIcon
              class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
            />
            <input
              v-model="query.name"
              type="text"
              placeholder="搜索账本名称..."
              class="w-full max-w-60 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-green-950 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              @keyup.enter="getPages"
            />
          </div>
          <button
            @click="getPages"
            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <MagnifyingGlassIcon class="h-4 w-4" />
            <span>查询</span>
          </button>
        </div>

        <!-- 操作按钮区域 -->
        <div class="flex-1 flex flex-wrap gap-2 lg:flex-nowrap">
          <button
            @click="getShare"
            class="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <UsersIcon class="h-4 w-4" />
            添加共享账本
          </button>
          <button
            @click="addItem"
            class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <PlusIcon class="h-4 w-4" />
            新增账本
          </button>
          <button
            @click="openBulkRuleUpdateDialog"
            :disabled="bulkRuleUpdating"
            class="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <ArrowPathIcon class="h-4 w-4" />
            <span>一键更新规则</span>
            <svg
              v-if="bulkRuleUpdating"
              class="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
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
                d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
              ></path>
            </svg>
          </button>
          <button
            @click="triggerBulkProfileRebuild"
            :disabled="bulkProfileUpdating"
            class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:text-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
          >
            <SparklesIcon class="h-4 w-4" />
            <span>一键重建画像</span>
            <svg
              v-if="bulkProfileUpdating"
              class="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
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
                d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 数据表格容器 -->
    <div
      class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <span class="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>

      <!-- 桌面端表格 -->
      <div
        v-if="!loading && tabledata.data?.length"
        class="hidden lg:block max-h-[70vh] overflow-y-auto"
      >
        <table class="w-full">
          <thead>
            <tr
              class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
            >
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                ID
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                账本ID
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                账本名称
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                账本说明
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                账本画像
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                预算（每月）
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                创建时间
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                共享KEY
              </th>
              <th
                class="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
            <tr
              v-for="item in tabledata.data"
              :key="item.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <td
                class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.id }}
              </td>
              <td
                class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.bookId }}
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                <div
                  class="text-sm font-medium text-green-950 dark:text-white max-w-52 text-ellipsis overflow-hidden"
                  :title="item.bookName"
                >
                  {{ item.bookName }}
                </div>
              </td>
              <td class="px-4 py-2">
                <div
                  class="text-sm text-gray-600 dark:text-gray-300 max-w-72 text-ellipsis overflow-hidden whitespace-nowrap"
                  :title="item.description || '-'"
                >
                  {{ item.description || "-" }}
                </div>
              </td>
              <td class="px-4 py-2">
                <div
                  class="text-sm text-gray-600 dark:text-gray-300 max-w-72 text-ellipsis overflow-hidden whitespace-nowrap cursor-help"
                  @mouseenter="showProfileTooltip(item, $event)"
                  @mouseleave="hideProfileTooltip"
                >
                  {{ item.profileSummary || "暂无画像信息" }}
                </div>
              </td>
              <td
                class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.budget || "-" }}
              </td>
              <td
                class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ formatDate(item.createDate) }}
              </td>
              <td class="px-4 py-2 whitespace-nowrap">
                <div v-if="item.shareKey" class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  >
                    {{ item.shareKey }}
                  </span>
                  <button
                    @click="copyShareKey(item.shareKey)"
                    class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded p-1 transition-colors"
                    title="复制分享Key"
                  >
                    <DocumentDuplicateIcon class="h-3 w-3" />
                  </button>
                </div>
                <span v-else class="text-gray-400 dark:text-gray-500 text-sm"
                  >-</span
                >
              </td>
              <td class="px-4 py-2 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center gap-2">
                  <button
                    @click="triggerProfileExport(item)"
                    class="text-sky-600 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200 transition-colors flex items-center gap-1"
                    title="导出画像关键词"
                  >
                    <ArrowDownTrayIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="triggerProfileImport(item)"
                    :disabled="profileImportLoading[item.id]"
                    class="text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200 disabled:text-gray-400 transition-colors flex items-center gap-1"
                    title="导入画像关键词"
                  >
                    <ArrowUpTrayIcon class="h-4 w-4" />
                    <svg
                      v-if="profileImportLoading[item.id]"
                      class="w-3 h-3 animate-spin"
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
                      ></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    @click="openRuleUpdateDialog(item)"
                    :disabled="perBookRuleLoading[item.id]"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 disabled:text-gray-400 transition-colors flex items-center gap-1"
                    title="更新智能规则"
                  >
                    <ArrowPathIcon class="h-4 w-4" />
                    <svg
                      v-if="perBookRuleLoading[item.id]"
                      class="w-3 h-3 animate-spin"
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
                      ></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    @click="triggerProfileRebuild(item)"
                    :disabled="profileUpdateLoading[item.id]"
                    class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200 disabled:text-gray-400 transition-colors flex items-center gap-1"
                    title="重建账本画像"
                  >
                    <SparklesIcon class="h-4 w-4" />
                    <svg
                      v-if="profileUpdateLoading[item.id]"
                      class="w-3 h-3 animate-spin"
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
                      ></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                      ></path>
                    </svg>
                  </button>
                  <button
                    @click="editItemInfo(item)"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    title="编辑"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!item.shareKey"
                    @click="toShare(item)"
                    class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                    title="分享"
                  >
                    <ShareIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="toDelete(item)"
                    class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="删除"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 移动端卡片 -->
      <div
        v-if="!loading && tabledata.data?.length"
        class="lg:hidden max-h-[60vh] overflow-y-auto"
      >
        <div
          v-for="item in tabledata.data"
          :key="item.id"
          class="bg-gray-50 dark:bg-gray-800 p-3 space-y-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          <!-- 标题行：账本名称 + 删除按钮 -->
          <div class="flex justify-between items-center mb-2">
            <h3
              class="text-base font-medium text-gray-900 dark:text-gray-100 flex-1 flex items-center pr-2"
            >
              <span class="font-medium">账本名称：</span>
              <span class="text-ellipsis overflow-hidden max-w-52">{{
                item.bookName
              }}</span>
            </h3>

            <!-- 删除按钮 -->
            <div class="flex items-center">
              <button
                @click="toDelete(item)"
                class="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="删除"
              >
                <TrashIcon class="h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- 详细信息 -->
          <div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div class="flex items-center justify-between">
              <p><span class="font-medium">ID:</span> {{ item.id }}</p>
              <p><span class="font-medium">账本ID:</span> {{ item.bookId }}</p>
            </div>
            <div>
              <p class="font-medium">账本说明:</p>
              <p class="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {{ item.description || "暂无说明" }}
              </p>
            </div>
            <div>
              <p class="font-medium">账本画像:</p>
              <p class="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {{ item.profileSummary || "暂无画像信息" }}
              </p>
            </div>
            <div class="flex items-center justify-between">
              <p>
                <span class="font-medium">预算:</span>
                {{ item.budget || "-" }}
              </p>

              <div class="flex items-center gap-3">
                <span class="font-medium">分享KEY:</span>
                <span
                  v-if="item.shareKey"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                >
                  {{ item.shareKey }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500"
                  >未分享</span
                >
                <button
                  v-if="item.shareKey"
                  @click="copyShareKey(item.shareKey)"
                  class="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  title="复制分享Key"
                >
                  <DocumentDuplicateIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <p>
                <span class="font-medium">创建时间:</span>
                {{ formatDate(item.createDate) }}
              </p>

              <!-- 编辑和分享按钮 -->
              <div class="flex items-center gap-1">
                <button
                  @click="triggerProfileExport(item)"
                  class="p-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded transition-colors"
                  title="导出画像关键词"
                >
                  <ArrowDownTrayIcon class="h-3 w-3" />
                </button>
                <button
                  @click="triggerProfileImport(item)"
                  :disabled="profileImportLoading[item.id]"
                  class="p-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-900 disabled:text-gray-400 text-white rounded transition-colors flex items-center gap-1"
                  title="导入画像关键词"
                >
                  <ArrowUpTrayIcon class="h-3 w-3" />
                  <svg
                    v-if="profileImportLoading[item.id]"
                    class="w-3 h-3 animate-spin"
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
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                    ></path>
                  </svg>
                </button>
                <button
                  @click="openRuleUpdateDialog(item)"
                  :disabled="perBookRuleLoading[item.id]"
                  class="p-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-900 disabled:text-gray-400 text-white rounded transition-colors flex items-center gap-1"
                  title="更新智能规则"
                >
                  <ArrowPathIcon class="h-3 w-3" />
                  <svg
                    v-if="perBookRuleLoading[item.id]"
                    class="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                      d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                    ></path>
                  </svg>
                </button>
                <button
                  @click="triggerProfileRebuild(item)"
                  :disabled="profileUpdateLoading[item.id]"
                  class="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:text-gray-400 text-white rounded transition-colors flex items-center gap-1"
                  title="重建账本画像"
                >
                  <SparklesIcon class="h-3 w-3" />
                  <svg
                    v-if="profileUpdateLoading[item.id]"
                    class="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
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
                      d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
                    ></path>
                  </svg>
                </button>
                <button
                  @click="editItemInfo(item)"
                  class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  title="编辑"
                >
                  <PencilIcon class="h-3 w-3" />
                </button>
                <button
                  v-if="!item.shareKey"
                  @click="toShare(item)"
                  class="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  title="分享"
                >
                  <ShareIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!loading && (!tabledata.data || tabledata.data.length === 0)"
        class="text-center py-12"
      >
        <div class="text-gray-400 dark:text-gray-500 mb-4">
          <svg
            class="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          暂无账本数据
        </h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          开始创建您的第一个账本吧
        </p>
        <button
          @click="addItem"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 inline-flex items-center gap-2"
        >
          <PlusIcon class="h-4 w-4" />
          创建账本
        </button>
      </div>

      <!-- 分页组件 -->
      <div
        v-if="!loading && tabledata.data?.length && totalPages > 1"
        class="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600"
      >
        <div class="flex flex-col gap-4">
          <!-- 分页信息 -->
          <div class="text-sm text-gray-700 dark:text-gray-300 text-center">
            显示第 {{ (pageQuery.pageNum - 1) * pageQuery.pageSize + 1 }} -
            {{
              Math.min(
                pageQuery.pageNum * pageQuery.pageSize,
                tabledata.total || 0
              )
            }}
            条， 共 {{ tabledata.total || 0 }} 条记录
          </div>

          <!-- 分页控件 - 水平居中 -->
          <div class="flex items-center justify-center gap-4">
            <!-- 每页显示数量选择 -->
            <select
              v-model="pageQuery.pageSize"
              @change="changePageSize(pageQuery.pageSize)"
              class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-green-950 dark:text-white"
            >
              <option value="10">10条/页</option>
              <option value="15">15条/页</option>
              <option value="20">20条/页</option>
              <option value="50">50条/页</option>
            </select>

            <!-- 分页按钮 -->
            <div class="flex items-center gap-1">
              <!-- 上一页 -->
              <button
                @click="changePage(pageQuery.pageNum - 1)"
                :disabled="pageQuery.pageNum <= 1"
                class="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-green-950 dark:text-white transition-colors"
                title="上一页"
              >
                <ChevronLeftIcon class="h-3 w-3 sm:h-4 sm:w-4" />
              </button>

              <!-- 页码按钮 - 移动端限制显示数量 -->
              <template
                v-for="(page, index) in mobileFriendlyPageNumbers"
                :key="index"
              >
                <button
                  v-if="page !== '...'"
                  @click="changePage(Number(page))"
                  :class="[
                    'h-7 w-7 sm:h-8 sm:w-8 text-center text-xs sm:text-sm border rounded transition-colors',
                    page === pageQuery.pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-800 text-green-950 dark:text-white',
                  ]"
                >
                  {{ page }}
                </button>
                <span v-else class="px-1 text-gray-500 text-xs">...</span>
              </template>

              <!-- 下一页 -->
              <button
                @click="changePage(pageQuery.pageNum + 1)"
                :disabled="pageQuery.pageNum >= totalPages"
                class="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-green-950 dark:text-white transition-colors"
                title="下一页"
              >
                <ChevronRightIcon class="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增导入功能区域 -->
    <div class="mt-8" id="import-section">
      <BookImportComponent />
    </div>

    <div
      v-if="credentialDialog.visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <div
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-green-950 dark:text-white">
            管理员认证
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            将为
            {{
              credentialDialog.mode === "all"
                ? "当前账户的全部账本"
                : `账本【${credentialDialog.targetBookName || "-"}】`
            }}
            重新生成智能规则。
          </p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1"
              >管理员账号</label
            >
            <input
              v-model="credentialDialog.username"
              type="text"
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-green-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入管理员账号"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 dark:text-gray-300 mb-1"
              >管理员密码</label
            >
            <input
              v-model="credentialDialog.password"
              type="password"
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded text-green-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入管理员密码"
              @keyup.enter="submitCredentialDialog"
            />
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3">
          <button
            class="px-4 py-2 text-sm text-gray-500 dark:text-gray-300 hover:text-green-900 dark:hover:text-white transition-colors"
            @click="closeCredentialDialog"
            :disabled="credentialSubmitting"
          >
            取消
          </button>
          <button
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:bg-blue-900 disabled:text-gray-400 flex items-center space-x-2"
            @click="submitCredentialDialog"
            :disabled="credentialSubmitting"
          >
            <span>确认更新</span>
            <svg
              v-if="credentialSubmitting"
              class="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
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
                d="M4 12a8 8 0 018-8V2C5.373 2 0 7.373 0 14h4z"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 对话框组件 -->
    <EditInfoDialog
      :item="editItem"
      :title="editDialogTitle"
      @success="getPages"
      @cancel="cancelEdit"
      v-if="editInfoFlag"
    />
    <GetShareDialog
      @success="getPages"
      @cancel="cancelEdit"
      v-if="showGetShareDialog"
    />
  </div>

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
/* 自定义滚动条样式 */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-700;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
