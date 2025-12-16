<template>
  <!-- 智能导入容器 -->
  <div :class="containerClass">
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        智能导入
      </h3>
      <button
        v-if="variant === 'dialog'"
        @click="closeDialog"
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <!-- 步骤1: 上传账单文件 -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-medium"
          >
            1
          </div>
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            上传账单文件
          </h4>
        </div>
        <div class="pl-10">
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            @change="onFilesChange"
            class="hidden"
          />
          <div
            @click="fileInput?.click()"
            @dragover.prevent
            @dragenter.prevent
            @drop.prevent="onFilesDrop"
            class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
          >
            <svg
              class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              点击选择或拖拽文件到此处
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500">
              支持 CSV、XLSX、XLS 格式，可一次选择多个文件
            </p>
          </div>

          <!-- 已选择的文件列表 -->
          <div v-if="selectedFiles.length > 0" class="mt-4 space-y-2">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
              已选择文件 ({{ selectedFiles.length }})
            </p>
            <div
              v-for="(file, index) in selectedFiles"
              :key="index"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <svg
                  class="w-5 h-5 text-indigo-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span
                  class="text-sm text-gray-900 dark:text-white truncate"
                  :title="file.name"
                >
                  {{ file.name }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  ({{ formatFileSize(file.size) }})
                </span>
              </div>
              <button
                @click="removeFile(index)"
                class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤2: 选择账本（仅在第一步显示） -->
      <div v-if="currentStep === 1" class="space-y-4">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-medium"
          >
            2
          </div>
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            选择账本
          </h4>
        </div>
        <div class="pl-10">
          <div v-if="loadingBooks" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">加载账本列表...</p>
          </div>
          <div v-else-if="availableBooks.length === 0" class="text-center py-8">
            <p class="text-sm text-gray-500 dark:text-gray-400">暂无可用账本，请先创建账本</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="book in availableBooks"
              :key="book.bookId"
              @click="toggleBookSelection(book.bookId)"
              :class="[
                'flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all',
                selectedBookIds.includes(book.bookId)
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500',
              ]"
            >
              <div
                :class="[
                  'flex items-center justify-center w-5 h-5 rounded border-2 transition-all',
                  selectedBookIds.includes(book.bookId)
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'border-gray-300 dark:border-gray-500',
                ]"
              >
                <svg
                  v-if="selectedBookIds.includes(book.bookId)"
                  class="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div
                class="w-4 h-4 rounded flex-shrink-0"
                :style="{ backgroundColor: book.color || '#3b82f6' }"
              ></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ book.bookName }}
                </p>
                <p
                  v-if="book.description"
                  class="text-xs text-gray-500 dark:text-gray-400 truncate"
                >
                  {{ book.description }}
                </p>
              </div>
            </div>
          </div>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            系统将自动分析账单内容，并将账单智能分配到选中的账本中
          </p>
        </div>
      </div>

      <!-- 提示信息 -->
      <div v-if="currentStep === 1" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex gap-3">
          <svg
            class="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div class="flex-1 text-sm text-blue-800 dark:text-blue-300">
            <p class="font-medium mb-1">智能导入说明</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>支持上传多个账单文件（CSV、XLSX、XLS格式）</li>
              <li>系统将自动识别账单类型（支付宝、微信、京东金融、挖财等）</li>
              <li>自动筛选退款、亲情账户等特殊流水供您选择</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 步骤2: 查看和选择流水 -->
      <div v-if="currentStep === 2" class="space-y-4">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-sm font-medium"
          >
            2
          </div>
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">
            选择要导入的流水
          </h4>
        </div>

        <!-- 格式检测结果 -->
        <div v-if="detectedFormats.length > 0" class="pl-10">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">检测到的文件格式：</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(format, index) in detectedFormats"
              :key="index"
              class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-xs"
            >
              {{ format.fileName }}: {{ format.format }}
            </span>
          </div>
        </div>

        <!-- 统一流水列表 -->
        <div class="pl-10 space-y-3">
          <div class="flex flex-wrap items-center gap-3">
            <!-- 匹配模式选择 -->
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">匹配模式:</label>
              <select
                v-model="matchMode"
                :disabled="aiLoading"
                class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="history-first">历史匹配优先（推荐）</option>
                <option value="history-only">仅历史匹配（最快）</option>
                <option value="ai-only">仅AI匹配</option>
              </select>
            </div>
            <button
              @click="fetchBookSuggestions"
              :disabled="aiLoading || displayFlows.length === 0 || selectedFlowIndexes.length === 0"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              <svg
                v-if="aiLoading"
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
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              {{ aiLoading ? "生成中..." : "获取账本建议" }}
            </button>
            <button
              @click="fetchCategorySuggestions"
              :disabled="aiLoading || displayFlows.length === 0 || selectedFlowIndexes.length === 0"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
            >
              <svg
                v-if="aiLoading"
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
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              {{ aiLoading ? "生成中..." : "获取分类建议" }}
            </button>
            <button
              @click="exportAnalysisCsv"
              :disabled="displayFlows.length === 0"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              导出分析结果
            </button>
            <button
              v-if="hasAiSuggestions"
              @click="applyAllSuggestions"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
            >
              一键采纳{{ matchMode === 'history-only' ? '历史匹配' : 'AI' }}建议
            </button>
            <span
              v-if="hasBookSuggestions && !hasCategorySuggestions"
              class="text-xs text-blue-600 dark:text-blue-400"
            >
              已获取账本建议，可继续获取分类建议
            </span>
            <span
              v-else-if="hasAiSuggestions"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ matchMode === 'history-only' ? '历史匹配建议生成后可逐条或一键采纳' : 'AI 建议生成后可逐条或一键采纳' }}
            </span>
            <span
              v-else-if="matchMode === 'history-only'"
              class="text-xs text-amber-600 dark:text-amber-400"
            >
              仅历史匹配模式：将基于历史流水快速匹配，无需AI服务
            </span>
          </div>
          <div
            v-if="hasMatchProgress"
            class="w-full bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
          >
            <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
              <span class="font-semibold text-gray-800 dark:text-gray-100">分析进度</span>
              <span>{{ matchProgress.matched }} / {{ matchProgress.total }}</span>
            </div>
            <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
              <div
                v-for="segment in progressSegments"
                :key="segment.key"
                class="h-full"
                :style="{ width: `${segment.percent}%`, backgroundColor: segment.color }"
              ></div>
            </div>
            <div class="grid gap-2 sm:grid-cols-3">
              <div
                v-for="stage in matchProgress.stages"
                :key="stage.key"
                class="rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs flex flex-col gap-1"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-gray-800 dark:text-gray-100">{{ stage.label }}</span>
                  <span :class="stageStatusClass(stage.status)">{{ stageStatusText(stage.status) }}</span>
                </div>
                <span class="text-gray-600 dark:text-gray-400">
                  {{ stage.matched }} / {{ stage.scope || matchProgress.total }}
                </span>
              </div>
            </div>
            <div
              v-if="matchProgress.llmBatch"
              class="text-xs text-purple-700 dark:text-purple-300"
            >
              LLM 批次 {{ matchProgress.llmBatch.completedBatches }}/{{ matchProgress.llmBatch.totalBatches }}
              <span class="ml-2 text-gray-500 dark:text-gray-400">
                每批 {{ matchProgress.llmBatch.batchSize }} 条，最近批次 {{ matchProgress.llmBatch.lastBatchSize }} 条
              </span>
              <span
                v-if="matchProgress.llmBatch.failedBatches > 0"
                class="ml-2 text-amber-600 dark:text-amber-400"
              >
                失败 {{ matchProgress.llmBatch.failedBatches }} 批
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
              流水列表 ({{ displayFlows.length }})
            </p>
            <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                :checked="allDisplaySelected"
                @change="toggleAllDisplay"
                class="rounded border-gray-300"
              />
              全选
            </label>
          </div>

          <div class="max-h-[45vh] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <th class="px-1 py-2 w-10">
                    <input
                      type="checkbox"
                      :checked="allDisplaySelected"
                      @change="toggleAllDisplay"
                      class="rounded border-gray-300"
                    />
                  </th>
                  <th class="px-1 py-1 w-16">类型</th>
                  <th class="px-1 py-1 w-12">日期</th>
                  <th class="px-1 py-1 w-24">收支</th>
                  <th class="px-1 py-1 w-24">金额</th>
                  <th class="px-1 py-1 w-32">交易对方</th>
                  <th class="px-1 py-1 w-24">支付方式</th>
                  <th class="px-1 py-1 w-32">账户</th>
                  <th class="px-1 py-1 w-32">分类</th>
                  <th class="px-1 py-1 w-32">商品</th>
                  <th class="px-1 py-1 min-w-24">备注</th>
                  <th class="px-1 py-1 w-32">流水归属</th>
                  <th class="px-1 py-1 w-32">AI建议</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="(flow, index) in displayFlows"
                  :key="index"
                  :class="[
                    'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    flow._meta?.badgeType === 'warning'
                      ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
                      : flow._meta?.badgeType === 'info'
                      ? 'bg-indigo-50/40 dark:bg-indigo-900/10'
                      : ''
                  ]"
                >
                  <td class="px-1 py-2 align-top">
                    <input
                      type="checkbox"
                      :value="index"
                      v-model="selectedFlowIndexes"
                      class="rounded border-gray-300"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <span
                      v-if="flow._meta?.badge"
                      :class="[
                        'px-2 py-1 rounded-full text-xs font-medium',
                        badgeClass(flow._meta?.badgeType)
                      ]"
                    >
                      {{ flow._meta?.badge }}
                    </span>
                    <span v-else class="text-xs text-gray-400">正常</span>
                  </td>
                  <td class="px-1 py-1 align-top">
                    <input
                      v-model="flow.day"
                      type="date"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <select
                      v-model="flow.flowType"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                    >
                      <option value="支出">支出</option>
                      <option value="收入">收入</option>
                      <option value="转账">转账</option>
                      <option value="不计收支">不计收支</option>
                    </select>
                  </td>
                  <td class="px-1 py-2 align-top">
                    <input
                      v-model.number="flow.money"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-right"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <input
                      v-model="flow.name"
                      type="text"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <input
                      v-model="flow.payType"
                      type="text"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <div class="space-y-1">
                      <select
                        v-if="accountList.length > 0"
                        v-model.number="flow.accountId"
                        class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                      >
                        <option value="">-- 未选择 --</option>
                        <option
                          v-for="account in accountList"
                          :key="account.id"
                          :value="account.id"
                        >
                          {{ account.name }}
                          <span v-if="account.type">({{ account.type }})</span>
                        </option>
                      </select>
                      <p
                        v-else
                        class="text-xs text-gray-400"
                      >
                        暂无账户信息
                      </p>
                      <p
                        v-if="flow.accountName"
                        class="text-xs text-gray-500 dark:text-gray-400"
                      >
                        识别：{{ flow.accountName }}
                      </p>
                    </div>
                  </td>
                  <td class="px-1 py-2 align-top">
                    <div class="relative">
                      <input
                        v-model="flow.industryType"
                        type="text"
                        :list="`category-list-${index}`"
                        class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="输入或选择分类"
                      />
                      <datalist :id="`category-list-${index}`">
                        <option
                          v-for="(categoryItem, catIndex) in getCategoryListForFlowSync(flow, index)"
                          :key="catIndex"
                          :value="categoryItem"
                        >
                          {{ categoryItem }}
                        </option>
                      </datalist>
                    </div>
                  </td>
                  <td class="px-1 py-2 align-top">
                    <textarea
                      v-model="flow.goods"
                      rows="2"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                      placeholder="商品信息"
                    ></textarea>
                  </td>
                  <td class="px-1 py-2 align-top">
                    <input
                      v-model="flow.description"
                      type="text"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td class="px-1 py-2 align-top">
                    <select
                      :value="resolveFlowBookId(flow) || ''"
                      @change="handleFlowBookChange(flow, ($event.target as HTMLSelectElement).value)"
                      class="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                    >
                      <option value="">-- 请选择 --</option>
                      <option
                        v-for="book in selectedBookDetails"
                        :key="book.bookId"
                        :value="book.bookId"
                      >
                        {{ book.bookName }}
                      </option>
                    </select>
                    <p
                      v-if="flow.attribution && !resolveFlowBookId(flow)"
                      class="text-xs text-gray-500 dark:text-gray-400 mt-1"
                    >
                      原始值: {{ flow.attribution }}
                    </p>
                  </td>
                  <td class="px-1 py-2 align-top">
                    <div v-if="flow._meta?.llmSuggestion" class="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      <div class="flex items-center gap-1">
                        <span class="font-medium text-indigo-600 dark:text-indigo-300">账本</span>
                        <span>{{ flow._meta.llmSuggestion.bookName || flow._meta.llmSuggestion.bookId || "未确定" }}</span>
                      </div>
                      <div
                        class="flex items-center gap-1"
                        v-if="flow._meta.llmSuggestion.industryType || flow._meta.llmSuggestion.primaryCategory"
                      >
                        <span class="font-medium text-indigo-600 dark:text-indigo-300">分类</span>
                        <span>{{ formatIndustryTypeFromSuggestion(flow._meta.llmSuggestion) }}</span>
                      </div>
                      <div class="flex items-center gap-1" v-if="flow._meta.llmSuggestion.attribution">
                        <span class="font-medium text-indigo-600 dark:text-indigo-300">归属</span>
                        <span>{{ flow._meta.llmSuggestion.attribution }}</span>
                      </div>
                      <div class="flex items-center gap-1" v-if="flow._meta.llmSuggestion.comment">
                        <span class="font-medium text-indigo-600 dark:text-indigo-300">理由</span>
                        <span class="truncate">{{ flow._meta.llmSuggestion.comment }}</span>
                      </div>
                      <div class="flex items-center gap-1" v-if="flow._meta.llmSuggestion.confidence !== undefined">
                        <span class="font-medium text-indigo-600 dark:text-indigo-300">置信度</span>
                        <span>{{ (flow._meta.llmSuggestion.confidence * 100).toFixed(0) }}%</span>
                      </div>
                      <button
                        @click="applyLlmSuggestion(flow, { force: true })"
                        class="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 transition-colors"
                      >
                        采纳建议
                      </button>
                    </div>
                    <span v-else class="text-xs text-gray-400">--</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div
      class="flex flex-col sm:flex-row gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
    >
      <button
        @click="currentStep === 1 ? closeDialog() : currentStep = 1"
        class="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {{ currentStep === 1 ? "取消" : "返回" }}
      </button>
      <button
        v-if="currentStep === 1"
        @click="parseFiles"
        :disabled="selectedFiles.length === 0 || importing"
        class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <div
          v-if="importing"
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
        ></div>
        {{ importing ? "解析中..." : "解析文件" }}
      </button>
      <button
        v-if="currentStep === 2"
        @click="commitImport"
        :disabled="!selectedBookId || selectedFlowIndexes.length === 0 || importing"
        class="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <div
          v-if="importing"
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
        ></div>
        {{ importing ? "导入中..." : "确认导入" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  type PropType,
} from "vue";
import { Alert } from "~/utils/alert";
import { doApi } from "~/utils/api";
import { exportCsvWithRows } from "~/utils/fileUtils";

const props = defineProps({
  variant: {
    type: String as PropType<"dialog" | "page">,
    default: "dialog",
  },
});

const emits = defineEmits(["success-callback", "close"]);

const variant = computed(() => props.variant);
const containerClass = computed(() =>
  props.variant === "page"
    ? "bg-white dark:bg-gray-900 w-full min-h-full flex flex-col"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[95vw] mx-auto max-h-[90vh] flex flex-col"
);

const fileInput = ref<HTMLInputElement>();
const selectedFiles = ref<File[]>([]);
const availableBooks = ref<any[]>([]);
const selectedBookIds = ref<string[]>([]);
const selectedBookDetails = computed(() =>
  availableBooks.value.filter((book) => selectedBookIds.value.includes(book.bookId))
);
const selectedBookId = ref<string>("");
const loadingBooks = ref(false);
const importing = ref(false);
const currentStep = ref(1); // 1: 上传文件, 2: 选择流水

// 解析结果
const detectedFormats = ref<Array<{ fileName: string; format: string }>>([]);
const displayFlows = ref<any[]>([]);
const aiLoading = ref(false);
const loadingAccounts = ref(false);
const accountList = ref<any[]>([]);
const categoryList = ref<Array<{ category: string; count: number; lastUsed: string | null }>>([]);
const loadingCategories = ref(false);

// 选中的流水索引
const selectedFlowIndexes = ref<number[]>([]);

// 匹配模式：history-first（历史匹配优先，AI补充）、history-only（仅历史匹配）、ai-only（仅AI匹配）
const matchMode = ref<"history-first" | "history-only" | "ai-only">("history-first");

type StageStatusUI = "pending" | "partial" | "completed" | "skipped";

interface StageProgressResponse {
  key: string;
  label: string;
  scope: number;
  matched: number;
  status: StageStatusUI;
}

interface LlmBatchProgress {
  stage: string;
  batchSize: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  lastBatchSize: number;
}

interface ProgressResponse {
  total: number;
  matched: number;
  stages: StageProgressResponse[];
  llmBatch?: LlmBatchProgress;
}

interface StageProgressUI extends StageProgressResponse {
  color: string;
}

interface MatchProgressUI {
  total: number;
  matched: number;
  stages: StageProgressUI[];
  llmBatch?: LlmBatchProgress;
}

const stageColors: Record<string, string> = {
  rules: "#16a34a",
  attribution: "#f59e0b",
  category: "#10b981",
  profiles: "#2563eb",
  llm: "#7c3aed",
};

const matchProgress = reactive<MatchProgressUI>({
  total: 0,
  matched: 0,
  stages: [],
  llmBatch: undefined,
});

const currentProgressToken = ref<string | null>(null);
const progressTimer = ref<ReturnType<typeof setInterval> | null>(null);

const hasMatchProgress = computed(
  () => matchProgress.total > 0 && matchProgress.stages.length > 0
);

const progressSegments = computed(() => {
  if (!hasMatchProgress.value || matchProgress.total <= 0) {
    return [];
  }
  return matchProgress.stages
    .filter((stage) => stage.matched > 0)
    .map((stage) => ({
      key: stage.key,
      percent: Math.min(
        100,
        (stage.matched / Math.max(matchProgress.total, 1)) * 100
      ),
      color: stage.color,
    }));
});

const stageStatusText = (status: StageStatusUI) => {
  switch (status) {
    case "completed":
      return "已完成";
    case "partial":
      return "部分完成";
    case "skipped":
      return "跳过";
    default:
      return "等待中";
  }
};

const stageStatusClass = (status: StageStatusUI) => {
  switch (status) {
    case "completed":
      return "text-emerald-600";
    case "partial":
      return "text-amber-600";
    case "skipped":
      return "text-gray-500";
    default:
      return "text-gray-500";
  }
};

const resetMatchProgress = () => {
  matchProgress.total = 0;
  matchProgress.matched = 0;
  matchProgress.stages = [];
  matchProgress.llmBatch = undefined;
};

const initializeMatchProgress = (totalFlows: number) => {
  if (totalFlows <= 0) {
    resetMatchProgress();
    return;
  }
  matchProgress.total = totalFlows;
  matchProgress.matched = 0;
  matchProgress.stages = [
    {
      key: "rules",
      label: "规则引擎",
      scope: totalFlows,
      matched: 0,
      status: "pending",
      color: stageColors.rules,
    },
    {
      key: "profiles",
      label: "账本画像",
      scope: totalFlows,
      matched: 0,
      status: "pending",
      color: stageColors.profiles,
    },
    {
      key: "llm",
      label: "LLM 匹配",
      scope: totalFlows,
      matched: 0,
      status: "pending",
      color: stageColors.llm,
    },
  ];
  matchProgress.llmBatch = undefined;
};

const applyProgressResult = (progress?: ProgressResponse) => {
  if (!progress) {
    resetMatchProgress();
    return;
  }
  matchProgress.total = progress.total || 0;
  matchProgress.matched = progress.matched || 0;
  matchProgress.stages = (progress.stages || []).map((stage) => ({
    ...stage,
    color: stageColors[stage.key] || "#4b5563",
  }));
  matchProgress.llmBatch = progress.llmBatch;
};

const generateProgressToken = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `progress_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const stopProgressPolling = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value);
    progressTimer.value = null;
  }
  currentProgressToken.value = null;
};

const pollProgress = async () => {
  if (!currentProgressToken.value) {
    return;
  }
  try {
    const res = await doApi.get<{ progress: ProgressResponse | null }>(
      "api/entry/flow/progress",
      { token: currentProgressToken.value }
    );
    if (res?.progress) {
      applyProgressResult(res.progress);
    }
  } catch (err) {
    console.warn("progress poll failed", err);
  }
};

const startProgressPolling = (token: string) => {
  stopProgressPolling();
  currentProgressToken.value = token;
  pollProgress();
  progressTimer.value = setInterval(pollProgress, 1500);
};

// 获取账本列表
const fetchBooks = async () => {
  loadingBooks.value = true;
  try {
    const res = await doApi.post<any[]>("api/entry/book/list-with-colors");
    availableBooks.value = res || [];

    // 默认选中全部账本，便于智能导入覆盖所有账本画像
    if (selectedBookIds.value.length === 0 && availableBooks.value.length > 0) {
      selectedBookIds.value = availableBooks.value
        .map((book) => book.bookId)
        .filter(Boolean);
    }

    // 读取上次选择的账本
    const lastSelectedBookId = localStorage.getItem("smartImport_lastSelectedBookId");
    if (lastSelectedBookId && availableBooks.value.some(b => b.bookId === lastSelectedBookId)) {
      selectedBookId.value = lastSelectedBookId;
    }
  } catch (e) {
    console.error("获取账本列表失败:", e);
    availableBooks.value = [];
  } finally {
    loadingBooks.value = false;
  }
};

const fetchAccounts = async () => {
  loadingAccounts.value = true;
  try {
    const res = await doApi.post<any[]>("api/entry/account/list", {
      includeInactive: false,
      includeHidden: true,
    });
    accountList.value = Array.isArray(res) ? res : [];
  } catch (error) {
    console.warn("获取账户列表失败:", error);
    accountList.value = [];
  } finally {
    loadingAccounts.value = false;
  }
};

// 存储所有账本的分类数据(按账本ID分组)
const categoryMapByBook = ref<Map<string, Array<{ category: string; count: number; lastUsed: string | null }>>>(new Map());
// 存储所有账本的合并分类数据
const allCategories = ref<Array<{ category: string; count: number; lastUsed: string | null }>>([]);

// 获取分类列表(根据匹配的账本)
const fetchCategories = async (bookIds?: string[]) => {
  loadingCategories.value = true;
  try {
    const targetBookIds = bookIds || selectedBookIds.value;
    
    // 如果没有账本ID,获取所有账本的分类
    const res = await doApi.post<Array<{ category: string; count: number; lastUsed: string | null }>>(
      "api/entry/flow/type/getCategoriesWithStats",
      {
        bookIds: targetBookIds.length > 0 ? targetBookIds : undefined,
        flowType: "支出",
      }
    );
    
    const categories = Array.isArray(res) ? res : [];
    
    if (targetBookIds.length > 0) {
      // 如果指定了账本ID,存储到对应的账本分类映射中
      targetBookIds.forEach((bookId) => {
        // 这里我们存储所有分类,因为API返回的是这些账本的合并分类
        // 如果需要按账本单独获取,需要修改API支持
        categoryMapByBook.value.set(bookId, categories);
      });
    }
    
    // 更新所有分类列表
    allCategories.value = categories;
  } catch (error) {
    console.warn("获取分类列表失败:", error);
    allCategories.value = [];
  } finally {
    loadingCategories.value = false;
  }
};

// 获取某个流水的分类列表(根据匹配的账本)
const getCategoryListForFlow = async (flow: any): Promise<string[]> => {
  const matchedBookId = resolveFlowBookId(flow);
  if (matchedBookId) {
    // 如果有匹配的账本,尝试获取该账本的分类
    let bookCategories = categoryMapByBook.value.get(matchedBookId);
    if (!bookCategories || bookCategories.length === 0) {
      // 如果该账本的分类还没有加载,单独加载该账本的分类
      try {
        const res = await doApi.post<Array<{ category: string; count: number; lastUsed: string | null }>>(
          "api/entry/flow/type/getCategoriesWithStats",
          {
            bookIds: [matchedBookId],
            flowType: "支出",
          }
        );
        bookCategories = Array.isArray(res) ? res : [];
        categoryMapByBook.value.set(matchedBookId, bookCategories);
      } catch (error) {
        console.warn(`获取账本 ${matchedBookId} 的分类列表失败:`, error);
        // 如果加载失败,返回所有分类作为兜底
        return allCategories.value.map((item) => item.category);
      }
    }
    return bookCategories.map((item) => item.category);
  } else {
    // 如果没有匹配的账本,返回所有账本的分类
    return allCategories.value.map((item) => item.category);
  }
};

// 缓存每个流水的分类列表,避免重复计算
const categoryListCache = ref<Map<number, string[]>>(new Map());

// 获取某个流水的分类列表(同步版本,使用缓存)
const getCategoryListForFlowSync = (flow: any, index: number): string[] => {
  // 先检查缓存
  if (categoryListCache.value.has(index)) {
    return categoryListCache.value.get(index) || [];
  }
  
  const matchedBookId = resolveFlowBookId(flow);
  if (matchedBookId) {
    // 如果有匹配的账本,尝试获取该账本的分类
    const bookCategories = categoryMapByBook.value.get(matchedBookId);
    if (bookCategories && bookCategories.length > 0) {
      const categories = bookCategories.map((item) => item.category);
      categoryListCache.value.set(index, categories);
      return categories;
    }
    // 如果该账本的分类还没有加载,异步加载并返回所有分类作为临时值
    getCategoryListForFlow(flow).then((categories) => {
      categoryListCache.value.set(index, categories);
    });
    return allCategories.value.map((item) => item.category);
  } else {
    // 如果没有匹配的账本,返回所有账本的分类
    const categories = allCategories.value.map((item) => item.category);
    categoryListCache.value.set(index, categories);
    return categories;
  }
};

/**
 * 规范化账户名称，用于匹配
 * 参考挖财导入的 cleanAccountName 逻辑，移除数字后缀、银行卡类型后缀等，只保留核心账户名称
 * 改进：保留银行卡号（括号中的数字），以便更准确地匹配
 */
const normalizeAccountName = (name?: string | null) => {
  if (!name) {
    return "";
  }
  let normalized = String(name).trim();
  
  // 移除开头的"识别："等前缀
  normalized = normalized.replace(/^识别[：:]\s*/, "");
  
  // 移除开头的逗号、空格等无效字符
  normalized = normalized.replace(/^[，,、\s]+/, "");
  
  // 移除结尾的逗号、空格等无效字符
  normalized = normalized.replace(/[，,、\s]+$/, "");
  
  // 先提取银行卡号（括号中的数字），需要在移除&之前提取
  const cardNumberMatch = normalized.match(/\((\d+)\)/);
  const cardNumber = cardNumberMatch ? cardNumberMatch[1] : null;
  
  // 移除额外的后缀信息（如"&红包"、"&余额"、"&支付宝随机抽立减"等）
  // 移除第一个&及其后面的所有内容（包括后续的&）
  const firstAmpersandIndex = normalized.indexOf("&");
  if (firstAmpersandIndex !== -1) {
    normalized = normalized.substring(0, firstAmpersandIndex).trim();
  }
  
  // 移除所有剩余的 & 和 | 符号（以防万一）
  normalized = normalized.replace(/[&|｜]/g, " ").trim();
  
  // 如果后面紧跟银行卡号，先去掉“储蓄卡 / 信用卡”等类型标记
  normalized = normalized.replace(
    /(储蓄卡|借记卡|信用卡|电子钱包|微信支付|银行卡)(?=\s*\()/g,
    ""
  );
  
  // 移除数字后缀（如"支付宝总12000" -> "支付宝总"），但保留银行卡号
  // 如果末尾是纯数字且不是银行卡号格式，才移除
  if (!cardNumber) {
    normalized = normalized.replace(/[总]?\d+\.?\d*$/, "");
  }
  
  // 移除银行卡类型后缀（但保留银行名称）
  normalized = normalized.replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$|微信支付$|银行卡$/g, "");
  
  // 移除多余的空格
  normalized = normalized.replace(/\s+/g, " ");
  
  // 移除特殊字符，但保留中文、英文、数字、空格和括号（用于银行卡号）
  normalized = normalized.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s()]/g, "");
  
  // 如果有银行卡号，确保格式为"银行名称(卡号)"
  if (cardNumber) {
    // 移除原有的括号和数字
    normalized = normalized.replace(/\(?\d+\)?/g, "");
    normalized = normalized.trim();
    // 重新添加银行卡号
    if (normalized) {
      normalized = `${normalized}(${cardNumber})`;
    }
  }
  
  normalized = normalized.trim();
  
  // 如果清理后为空，返回空字符串
  if (!normalized || normalized.length === 0) {
    return "";
  }
  
  // 移除所有空格并转小写（用于匹配）
  return normalized.replace(/\s+/g, "").toLowerCase();
};

/**
 * 创建账户名称到ID的映射表
 * 同时创建多个变体的映射（原始名称、清理后的名称等）
 * 参考挖财导入的匹配逻辑，优先精确匹配
 */
const accountLookup = computed(() => {
  const map = new Map<string, number>();
  accountList.value.forEach((account) => {
    if (!account || account.id === undefined || account.id === null) {
      return;
    }
    const accountName = account.name || "";
    
    // 1. 添加清理后的规范化版本（最重要，用于精确匹配）
    const normalized = normalizeAccountName(accountName);
    if (normalized) {
      map.set(normalized, account.id);
    }
    
    // 2. 添加原始名称（去除空格转小写，用于兼容）
    const simpleNormalized = accountName.replace(/\s+/g, "").toLowerCase();
    if (simpleNormalized && simpleNormalized !== normalized) {
      map.set(simpleNormalized, account.id);
    }
    
    // 3. 如果账户名称包含银行关键词，也添加银行名称的映射
    const bankKeywords = [
      "工商银行", "建设银行", "农业银行", "中国银行", "交通银行",
      "招商银行", "浦发银行", "民生银行", "兴业银行", "光大银行",
      "华夏银行", "中信银行", "平安银行", "广发银行", "邮储银行"
    ];
    for (const keyword of bankKeywords) {
      if (accountName.includes(keyword)) {
        // 添加"银行+储蓄卡"的映射
        const bankWithCard = normalizeAccountName(keyword + "储蓄卡");
        if (bankWithCard && !map.has(bankWithCard)) {
          map.set(bankWithCard, account.id);
        }
        // 添加"银行"的映射
        const bankOnly = normalizeAccountName(keyword);
        if (bankOnly && !map.has(bankOnly)) {
          map.set(bankOnly, account.id);
        }
      }
    }
    
    // 4. 处理特殊账户类型（投资账户、借贷账户等）
    if (accountName.includes("投资账户") || accountName.includes("基金") || accountName.includes("股票")) {
      // 提取投资账户的核心部分（如"投资账户-股票" -> "投资账户股票"）
      const investmentNormalized = normalizeAccountName(accountName.replace(/-/g, ""));
      if (investmentNormalized && !map.has(investmentNormalized)) {
        map.set(investmentNormalized, account.id);
      }
    }
    
    // 5. 处理支付方式相关的账户（如"微信支付" -> "微信"）
    if (accountName.includes("微信支付") || accountName.includes("微信")) {
      const wechatNormalized = normalizeAccountName("微信");
      if (wechatNormalized && !map.has(wechatNormalized)) {
        map.set(wechatNormalized, account.id);
      }
    }
    if (accountName.includes("支付宝")) {
      const alipayNormalized = normalizeAccountName("支付宝");
      if (alipayNormalized && !map.has(alipayNormalized)) {
        map.set(alipayNormalized, account.id);
      }
    }
  });
  return map;
});

const extractBankName = (name: string) => {
  if (!name) {
    return "";
  }
  let bankName = name.replace(/\([^)]*\)/g, "");
  bankName = bankName.replace(/储蓄卡|借记卡|信用卡|银行卡/g, "");
  bankName = bankName.replace(/\d+/g, "");
  return bankName.trim();
};

/**
 * 尝试匹配账户ID
 * 参考挖财导入的匹配逻辑：先精确匹配，再模糊匹配
 */
const tryMatchAccountId = (flow: any) => {
  if (!flow || flow.accountId || accountLookup.value.size === 0) {
    return;
  }
  
  const normalizedAccountName = normalizeAccountName(flow.accountName);
  const normalizedMetaAccountName = normalizeAccountName(flow._meta?.accountName);
  const normalizedPayType = normalizeAccountName(flow.payType);
  const normalizedAccountBankName = normalizedAccountName ? extractBankName(normalizedAccountName) : "";
  const normalizedMetaBankName = normalizedMetaAccountName ? extractBankName(normalizedMetaAccountName) : "";
  
  const collectCandidates = (...candidates: (string | undefined)[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    candidates.filter(Boolean).forEach((candidate) => {
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        result.push(candidate);
      }
    });
    return result;
  };
  
  const primaryCandidates = collectCandidates(
    normalizedAccountName,
    normalizedMetaAccountName,
    normalizedAccountBankName,
    normalizedMetaBankName
  );
  const fallbackCandidates = collectCandidates(normalizedPayType);
  
  const tryExactMatch = (candidates: string[]) => {
    for (const candidate of candidates) {
      const matched = accountLookup.value.get(candidate);
      if (matched) {
        flow.accountId = matched;
        console.log(`[账户匹配] 精确匹配成功: \"${candidate}\" -> 账户ID ${matched}`);
        return true;
      }
    }
    return false;
  };
  
  if (tryExactMatch(primaryCandidates)) {
    return;
  }
  
  // 第二步：如果精确匹配失败，尝试模糊匹配（部分包含）
  const fuzzySource =
    normalizedAccountName ||
    normalizedMetaAccountName ||
    normalizedAccountBankName ||
    normalizedMetaBankName;
  if (fuzzySource) {
    const flowAccountNormalized = fuzzySource;
    if (flowAccountNormalized) {
      let bestMatch: { accountId: number; score: number } | null = null;
      const flowBankName = extractBankName(flowAccountNormalized);
      
      // 遍历所有账户，查找包含关系
      for (const account of accountList.value) {
        if (!account || account.id === undefined || account.id === null) {
          continue;
        }
        const accountNormalized = normalizeAccountName(account.name);
        
        if (!accountNormalized) {
          continue;
        }
        
        const accountBankName = extractBankName(accountNormalized);
        
        // 计算匹配分数
        let score = 0;
        
        // 如果完全匹配，分数最高（这种情况应该已经在精确匹配中处理了，但保留作为兜底）
        if (accountNormalized === flowAccountNormalized) {
          score = 100;
        }
        // 如果银行名称匹配（核心匹配逻辑）
        else if (flowBankName && accountBankName && flowBankName === accountBankName) {
          score = 90; // 银行名称匹配，分数很高
        }
        // 如果流水的账户名称完全包含在系统账户名称中（如"工商银行"包含在"工商银行储蓄卡"中）
        else if (accountNormalized.includes(flowAccountNormalized)) {
          // 匹配度 = 流水账户名称长度 / 系统账户名称长度
          // 例如："工商银行" (4字) 在 "工商银行储蓄卡" (7字) 中，匹配度 = 4/7 * 80 = 45.7
          score = (flowAccountNormalized.length / accountNormalized.length) * 80;
        }
        // 如果系统账户名称完全包含在流水账户名称中（如"工商银行储蓄卡"包含"工商银行"）
        else if (flowAccountNormalized.includes(accountNormalized)) {
          // 匹配度 = 系统账户名称长度 / 流水账户名称长度
          // 例如："工商银行" (4字) 在 "工商银行储蓄卡" (7字) 中，匹配度 = 4/7 * 70 = 40
          score = (accountNormalized.length / flowAccountNormalized.length) * 70;
        }
        // 如果银行名称有包含关系
        else if (flowBankName && accountBankName) {
          if (accountBankName.includes(flowBankName)) {
            score = (flowBankName.length / accountBankName.length) * 75;
          } else if (flowBankName.includes(accountBankName)) {
            score = (accountBankName.length / flowBankName.length) * 75;
          }
        }
        
        // 降低阈值，提高匹配成功率（从60降到50）
        if (score >= 50) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { accountId: account.id, score };
          }
        }
      }
      
      // 使用最佳匹配
      if (bestMatch) {
        flow.accountId = bestMatch.accountId;
        console.log(`[账户匹配] 模糊匹配成功: "${flowAccountNormalized}" -> 账户ID ${bestMatch.accountId} (分数: ${bestMatch.score.toFixed(1)})`);
        return;
      } else {
        console.log(`[账户匹配] 未找到匹配: "${flowAccountNormalized}"`);
      }
    }
  }
  
  // 第三步：使用支付方式等兜底字段尝试精确匹配
  tryExactMatch(fallbackCandidates);
};

const autoAssignAccounts = (flows: any[]) => {
  if (!Array.isArray(flows) || flows.length === 0) {
    return;
  }
  flows.forEach((flow) => tryMatchAccountId(flow));
};

// 文件选择处理
const onFilesChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  addFiles(files);
};

// 拖拽文件处理
const onFilesDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || []);
  const validFiles = files.filter(
    (file) =>
      file.type === "text/csv" ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
  );
  if (validFiles.length > 0) {
    addFiles(validFiles);
  }
};

// 添加文件
const addFiles = (files: File[]) => {
  const validFiles = files.filter(
    (file) =>
      file.type === "text/csv" ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
  );
  
  // 去重，避免重复添加相同文件
  const newFiles = validFiles.filter(
    (file) => !selectedFiles.value.some((f) => f.name === file.name && f.size === file.size)
  );
  
  selectedFiles.value.push(...newFiles);
};

// 移除文件
const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1);
};

// 切换账本选择
const toggleBookSelection = (bookId: string) => {
  const index = selectedBookIds.value.indexOf(bookId);
  if (index > -1) {
    selectedBookIds.value.splice(index, 1);
  } else {
    selectedBookIds.value.push(bookId);
  }
};

// 根据bookId获取账本名称
const getBookName = (bookId: string): string => {
  const book = availableBooks.value.find((b) => b.bookId === bookId);
  return book?.bookName || bookId;
};

const resolveFlowBookId = (flow: any): string | undefined => {
  if (flow?._meta?.appliedBookId) {
    return flow._meta.appliedBookId;
  }
  if (flow?.bookId) {
    return flow.bookId;
  }
  if (flow?.attribution) {
    // 尝试匹配账本ID或账本名称
    const matched = availableBooks.value.find(
      (book) => book.bookId === flow.attribution || book.bookName === flow.attribution
    );
    if (matched) {
      return matched.bookId;
    }
    // 如果没有匹配到，但attribution有值，尝试在selectedBookDetails中查找
    const matchedInSelected = selectedBookDetails.value.find(
      (book) => book.bookId === flow.attribution || book.bookName === flow.attribution
    );
    if (matchedInSelected) {
      return matchedInSelected.bookId;
    }
  }
  return undefined;
};

const handleFlowBookChange = async (flow: any, bookId: string) => {
  if (!flow._meta) {
    flow._meta = {};
  }
  flow._meta.appliedBookId = bookId || undefined;
  flow.bookId = bookId || undefined;
  if (bookId) {
    // 优先使用后端返回的 bookName（如果存在），否则从前端账本列表中查找
    const bookName = flow._meta?.llmSuggestion?.bookName || getBookName(bookId);
    flow.attribution = bookName;
  } else {
    flow.attribution = "";
  }
  // 账本变化后,清除所有流水的分类缓存,以便重新加载
  categoryListCache.value.clear();
  // 如果该账本的分类还没有加载,异步加载
  if (bookId && !categoryMapByBook.value.has(bookId)) {
    try {
      const res = await doApi.post<Array<{ category: string; count: number; lastUsed: string | null }>>(
        "api/entry/flow/type/getCategoriesWithStats",
        {
          bookIds: [bookId],
          flowType: "支出",
        }
      );
      const categories = Array.isArray(res) ? res : [];
      categoryMapByBook.value.set(bookId, categories);
    } catch (error) {
      console.warn(`加载账本 ${bookId} 的分类失败:`, error);
    }
  }
};

const prepareFlowForCommit = (flow: any) => {
  const cloned = JSON.parse(JSON.stringify(flow));
  const resolvedBookId = resolveFlowBookId(cloned) || selectedBookId.value;
  if (!cloned._meta) {
    cloned._meta = {};
  }
  cloned._meta.appliedBookId = resolvedBookId;
  if (resolvedBookId) {
    cloned.bookId = resolvedBookId;
    if (!cloned.attribution) {
      cloned.attribution = getBookName(resolvedBookId);
    }
  }
  return cloned;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// 验证文件格式
const validateFileFormat = (file: File): boolean => {
  const validExtensions = [".csv", ".xlsx", ".xls"];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
};

// 解析文件
const parseFiles = async () => {
  if (selectedFiles.value.length === 0) {
    Alert.error("请至少选择一个账单文件");
    return;
  }

  // 验证所有文件格式
  const invalidFiles = selectedFiles.value.filter((file) => !validateFileFormat(file));
  if (invalidFiles.length > 0) {
    Alert.error(`以下文件格式不支持: ${invalidFiles.map((f) => f.name).join(", ")}`);
    return;
  }

  importing.value = true;
  try {
    // 准备文件上传
    const formData = new FormData();
    
    // 添加文件
    selectedFiles.value.forEach((file) => {
      formData.append("files", file);
    });
    
    // 添加账本ID列表（可选）
    if (selectedBookIds.value.length > 0) {
      formData.append("bookIds", JSON.stringify(selectedBookIds.value));
    }

    // 调用智能导入API（第一步：解析）
    const result = await doApi.postform<{
      success: boolean;
      message: string;
      detectedFormats: Array<{ fileName: string; format: string }>;
      displayFlows: any[];
    }>("api/entry/flow/smart-import", formData);

    if (result && result.success) {
      // 保存解析结果
      detectedFormats.value = result.detectedFormats || [];
      const flows = (result.displayFlows || []).map((flow) => ({
        ...flow,
        money: Number(flow.money) || 0,
      }));
      
      // 排序：特殊类型流水（有badge的）放在最前面
      displayFlows.value = flows.sort((a, b) => {
        const aHasBadge = !!a._meta?.badge;
        const bHasBadge = !!b._meta?.badge;
        if (aHasBadge && !bHasBadge) return -1;
        if (!aHasBadge && bHasBadge) return 1;
        return 0;
      });
      autoAssignAccounts(displayFlows.value);

      // 如果还没有选择账本，使用第一个选中的账本
      if (!selectedBookId.value && selectedBookIds.value.length > 0) {
        selectBook(selectedBookIds.value[0]);
      }

      // 根据 _meta.selected 初始化选择状态
      // 如果 _meta.selected 为 false，则不选中；否则默认选中
      selectedFlowIndexes.value = displayFlows.value
        .map((flow, index) => {
          // 如果明确标记为 selected: false，则不选中
          if (flow._meta?.selected === false) {
            return null;
          }
          // 其他情况默认选中（包括 selected: true 或未设置 selected）
          return index;
        })
        .filter((index): index is number => index !== null);

      // 切换到第二步
      currentStep.value = 2;
      
      // 清除分类缓存
      categoryListCache.value.clear();
      
      // 加载分类列表
      fetchCategories();
    } else {
      Alert.error(result?.message || "解析失败，请重试");
    }
  } catch (error: any) {
    console.error("解析失败:", error);
    Alert.error(error?.message || "解析失败，请重试");
  } finally {
    importing.value = false;
  }
};

// 提交导入
const commitImport = async () => {
  if (!selectedBookId.value) {
    Alert.error("请选择账本");
    return;
  }

  // 收集所有选中的流水
  const flowsToImport: any[] = selectedFlowIndexes.value
    .map((index) => displayFlows.value[index])
    .filter(Boolean)
    .map((flow) => prepareFlowForCommit(flow));

  if (flowsToImport.length === 0) {
    Alert.error("请至少选择一条流水");
    return;
  }

  importing.value = true;
  try {
    // 调用提交导入API
    const result = await doApi.post<{
      success: boolean;
      message: string;
      importedCount?: number;
    }>("api/entry/flow/smart-import-commit", {
      bookId: selectedBookId.value,
      flows: flowsToImport,
    });

    if (result && result.success) {
      Alert.success(result.message || `成功导入 ${result.importedCount || 0} 条流水`);
      emits("success-callback");
      closeDialog();
    } else {
      Alert.error(result?.message || "导入失败，请重试");
    }
  } catch (error: any) {
    console.error("导入失败:", error);
    Alert.error(error?.message || "导入失败，请重试");
  } finally {
    importing.value = false;
  }
};

// 选择账本（并记住选择）
const selectBook = (bookId: string) => {
  selectedBookId.value = bookId;
  localStorage.setItem("smartImport_lastSelectedBookId", bookId);
};

const allDisplaySelected = computed(() => {
  return (
    displayFlows.value.length > 0 &&
    selectedFlowIndexes.value.length === displayFlows.value.length
  );
});

const hasAiSuggestions = computed(() =>
  displayFlows.value.some((flow) => flow?._meta?.llmSuggestion)
);

const hasBookSuggestions = computed(() =>
  displayFlows.value.some((flow) => flow?._meta?.llmSuggestion?.bookId)
);

const hasCategorySuggestions = computed(() =>
  displayFlows.value.some((flow) => {
    const suggestion = flow?._meta?.llmSuggestion;
    return suggestion && (suggestion.industryType || suggestion.primaryCategory || suggestion.flowType);
  })
);

const toggleAllDisplay = () => {
  if (allDisplaySelected.value) {
    selectedFlowIndexes.value = [];
  } else {
    selectedFlowIndexes.value = displayFlows.value.map((_, index) => index);
  }
};

const applyLlmSuggestion = (flow: any, options?: { silent?: boolean; force?: boolean }): boolean => {
  const suggestion = flow?._meta?.llmSuggestion;
  if (!suggestion) return false;
  const shouldOverride = (current: any) => options?.force || !current;

  const formattedIndustryType = formatIndustryTypeFromSuggestion(suggestion);

  if (suggestion.flowType && shouldOverride(flow.flowType)) {
    flow.flowType = suggestion.flowType;
  }
  if (formattedIndustryType && (options?.force || flow.industryType !== formattedIndustryType)) {
    flow.industryType = formattedIndustryType;
  } else if (suggestion.industryType && shouldOverride(flow.industryType)) {
    flow.industryType = suggestion.industryType;
  }
  if (suggestion.attribution && shouldOverride(flow.attribution)) {
    flow.attribution = suggestion.attribution;
  }
  if (suggestion.bookId) {
    const bookName = getBookName(suggestion.bookId);
    if (bookName && (options?.force || !flow.attribution)) {
      flow.attribution = bookName;
    }
  }
  if (suggestion.description && shouldOverride(flow.description)) {
    flow.description = suggestion.description;
  }

  if (suggestion.bookId) {
    flow._meta = flow._meta || {};
    flow._meta.appliedBookId = suggestion.bookId;
  }
  if (!options?.silent) {
    Alert.success("已采纳 AI 建议");
  }
  return true;
};

// 获取账本建议
const fetchBookSuggestions = async () => {
  if (displayFlows.value.length === 0 || aiLoading.value) {
    return;
  }
  if (selectedFlowIndexes.value.length === 0) {
    Alert.error("请先选择需要分析的流水");
    return;
  }
  aiLoading.value = true;
  try {
    const payloadFlows = selectedFlowIndexes.value
      .map((index) => {
        const flow = displayFlows.value[index];
        if (!flow) {
          return null;
        }
        const cloned = JSON.parse(JSON.stringify(flow));
        cloned._meta = {
          ...(cloned._meta || {}),
          clientIndex: index,
        };
        return cloned;
      })
      .filter((flow): flow is any => !!flow);

    if (payloadFlows.length === 0) {
      Alert.error("未找到可分析的流水");
      aiLoading.value = false;
      return;
    }

    initializeMatchProgress(payloadFlows.length);
    const progressToken = generateProgressToken();
    startProgressPolling(progressToken);

    const payload = {
      flows: payloadFlows,
      bookIds: selectedBookIds.value,
      mode: "book" as const,
      useHistoryMatch: matchMode.value !== "ai-only", // 仅AI模式时禁用历史匹配
      matchMode: matchMode.value,
      progressToken,
    };
    const result = await doApi.post<{
      success: boolean;
      flows: any[];
      message?: string;
      suggestedCount?: number;
      historyMatchedCount?: number;
    progress?: ProgressResponse;
  }>("api/entry/flow/smart-import-ai", payload);
    if (result?.success && Array.isArray(result.flows)) {
      result.flows.forEach((flow) => {
        const clientIndex = flow?._meta?.clientIndex;
        if (clientIndex === undefined || clientIndex === null) {
          return;
        }
        const original = displayFlows.value[clientIndex];
        if (!original) {
          return;
        }
        const merged = {
          ...original,
          ...flow,
          money: Number(flow.money ?? original.money) || 0,
          _meta: {
            ...(original._meta || {}),
            ...(flow._meta || {}),
          },
        };
        displayFlows.value.splice(clientIndex, 1, merged);
        // 只应用账本建议，不自动应用分类
        if (merged._meta?.llmSuggestion?.bookId) {
          // 从数组中获取更新后的对象，确保响应式更新
          const updatedFlow = displayFlows.value[clientIndex];
          if (updatedFlow) {
            // handleFlowBookChange 会使用 llmSuggestion.bookName 更新归属信息
            handleFlowBookChange(updatedFlow, merged._meta.llmSuggestion.bookId);
          }
          // 账本变化后,清除该流水的分类缓存,以便重新加载
          categoryListCache.value.delete(clientIndex);
        }
      });
      applyProgressResult(result.progress);
      const historyCount = result.historyMatchedCount || 0;
      const message = result.message || "账本建议已生成";
      if (historyCount > 0 && matchMode.value !== "ai-only") {
        Alert.success(`${message}（历史匹配 ${historyCount} 条）`);
      } else {
        Alert.success(message);
      }
    } else {
      Alert.error(result?.message || "获取账本建议失败，请重试");
      resetMatchProgress();
    }
  } catch (error: any) {
    console.error("获取账本建议失败:", error);
    Alert.error(error?.message || "获取账本建议失败，请重试");
    resetMatchProgress();
  } finally {
    stopProgressPolling();
    aiLoading.value = false;
  }
};

// 获取分类建议
const fetchCategorySuggestions = async () => {
  if (displayFlows.value.length === 0 || aiLoading.value) {
    return;
  }
  if (selectedFlowIndexes.value.length === 0) {
    Alert.error("请先选择需要分析的流水");
    return;
  }
  aiLoading.value = true;
  try {
    const payloadFlows = selectedFlowIndexes.value
      .map((index) => {
        const flow = displayFlows.value[index];
        if (!flow) {
          return null;
        }
        const cloned = JSON.parse(JSON.stringify(flow));
        cloned._meta = {
          ...(cloned._meta || {}),
          clientIndex: index,
        };
        return cloned;
      })
      .filter((flow): flow is any => !!flow);

    if (payloadFlows.length === 0) {
      Alert.error("未找到可分析的流水");
      aiLoading.value = false;
      return;
    }

    initializeMatchProgress(payloadFlows.length);
    const progressToken = generateProgressToken();
    startProgressPolling(progressToken);

    const payload = {
      flows: payloadFlows,
      bookIds: selectedBookIds.value,
      mode: "category" as const,
      useHistoryMatch: matchMode.value !== "ai-only", // 仅AI模式时禁用历史匹配
      matchMode: matchMode.value,
      progressToken,
    };
    const result = await doApi.post<{
      success: boolean;
      flows: any[];
      message?: string;
      suggestedCount?: number;
      historyMatchedCount?: number;
    progress?: ProgressResponse;
  }>("api/entry/flow/smart-import-ai", payload);
    if (result?.success && Array.isArray(result.flows)) {
      result.flows.forEach((flow) => {
        const clientIndex = flow?._meta?.clientIndex;
        if (clientIndex === undefined || clientIndex === null) {
          return;
        }
        const original = displayFlows.value[clientIndex];
        if (!original) {
          return;
        }
        const merged = {
          ...original,
          ...flow,
          money: Number(flow.money ?? original.money) || 0,
          _meta: {
            ...(original._meta || {}),
            ...(flow._meta || {}),
          },
        };
        displayFlows.value.splice(clientIndex, 1, merged);
        // 只应用分类建议，保留已有的账本建议
        applyLlmSuggestion(merged, { silent: true, force: false });
      });
      applyProgressResult(result.progress);
      const historyCount = result.historyMatchedCount || 0;
      const message = result.message || "分类建议已生成";
      if (historyCount > 0 && matchMode.value !== "ai-only") {
        Alert.success(`${message}（历史匹配 ${historyCount} 条）`);
      } else {
        Alert.success(message);
      }
    } else {
      Alert.error(result?.message || "获取分类建议失败，请重试");
      resetMatchProgress();
    }
  } catch (error: any) {
    console.error("获取分类建议失败:", error);
    Alert.error(error?.message || "获取分类建议失败，请重试");
    resetMatchProgress();
  } finally {
    stopProgressPolling();
    aiLoading.value = false;
  }
};

const formatIndustryTypeFromSuggestion = (suggestion: any): string | undefined => {
  if (!suggestion) return undefined;
  const { primaryCategory, secondaryCategory, industryType } = suggestion;
  if (primaryCategory && secondaryCategory) {
    return `${primaryCategory}/${secondaryCategory}`;
  }
  if (industryType) {
    return industryType;
  }
  return primaryCategory || undefined;
};

const applyAllSuggestions = () => {
  let applied = 0;
  displayFlows.value.forEach((flow) => {
    if (applyLlmSuggestion(flow, { silent: true, force: true })) {
      applied += 1;
    }
  });
  if (applied > 0) {
    Alert.success(`已采纳 ${applied} 条 AI 建议`);
  } else {
    Alert.error("没有可采纳的 AI 建议");
  }
};

const exportAnalysisCsv = () => {
  if (displayFlows.value.length === 0) {
    Alert.error("暂无记录可导出");
    return;
  }

  const headers = [
    "序号",
    "是否选中",
    "交易时间",
    "收支类型",
    "金额",
    "交易对方",
    "支付方式",
    "账户",
    "当前分类",
    "AI分类建议",
    "当前账本",
    "AI账本建议",
    "当前归属",
    "AI归属建议",
    "AI置信度",
    "AI理由",
    "规则/来源",
    "备注",
    "商品信息",
  ];

  const rows = displayFlows.value.map((flow, index) => {
    const suggestion = flow?._meta?.llmSuggestion || {};
    const resolvedBookId = resolveFlowBookId(flow);
    const resolvedBookName = resolvedBookId ? getBookName(resolvedBookId) : "";
    const suggestedBookName =
      suggestion.bookName ||
      (suggestion.bookId ? getBookName(suggestion.bookId) : "");
    const suggestedCategory = formatIndustryTypeFromSuggestion(suggestion) || "";
    const confidence =
      suggestion.confidence !== undefined && suggestion.confidence !== null
        ? `${(Number(suggestion.confidence) * 100).toFixed(0)}%`
        : "";
    const isSelected = selectedFlowIndexes.value.includes(index) ? "是" : "否";

    return [
      index + 1,
      isSelected,
      flow.day || "",
      flow.flowType || "",
      flow.money ?? "",
      flow.name || "",
      flow.payType || "",
      flow.accountName || flow._meta?.accountName || "",
      flow.industryType || "",
      suggestedCategory,
      resolvedBookName,
      suggestedBookName,
      flow.attribution || "",
      suggestion.attribution || "",
      confidence,
      suggestion.comment || "",
      suggestion.ruleId !== undefined ? suggestion.ruleId : "",
      flow.description || "",
      flow.goods || "",
    ];
  });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .split(".")[0];
  const fileName = `智能导入分析结果-${timestamp}.csv`;

  exportCsvWithRows(fileName, headers, rows);
  Alert.success("已导出分析结果");
};

const badgeClass = (badgeType?: string) => {
  switch (badgeType) {
    case "warning":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200";
    case "info":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200";
    case "success":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  }
};

// 关闭对话框
const closeDialog = () => {
  selectedFiles.value = [];
  selectedBookIds.value = [];
  importing.value = false;
  currentStep.value = 1;
  detectedFormats.value = [];
  displayFlows.value = [];
  selectedFlowIndexes.value = [];
  stopProgressPolling();
  resetMatchProgress();
  emits("close");
};

watch(accountList, () => {
  if (displayFlows.value.length > 0) {
    autoAssignAccounts(displayFlows.value);
  }
});

// 初始化
onMounted(() => {
  fetchBooks();
  fetchAccounts();
  fetchCategories();
});

onBeforeUnmount(() => {
  stopProgressPolling();
});
</script>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-700;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}
</style>
