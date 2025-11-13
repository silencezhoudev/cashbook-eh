<template>
  <div
    class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden rounded-lg"
  >
    <!-- 按月收拢控制 -->
    <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              v-model="monthlyCollapse"
              class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            按月收拢显示
          </label>
        </div>
        <div v-if="monthlyCollapse" class="text-sm text-gray-600 dark:text-gray-400">
          共 {{ groupedFlows.length }} 个月份
        </div>
      </div>
    </div>

    <!-- 桌面端表格 -->
    <div class="hidden md:block max-h-[65vh] overflow-y-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="$emit('toggleSelectAll')"
                class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              日期
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>流水类型</span>
                <ColumnFilter
                  column-key="flowType"
                  :options="flowTypeOptions"
                  v-model:selected-values="columnFilters.flowType.selectedValues"
                  v-model:keyword-filter="columnFilters.flowType.keywordFilter"
                  @apply="onColumnFilterApply('flowType', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>支出/收入类型</span>
                <ColumnFilter
                  column-key="industryType"
                  :options="industryTypeOptions"
                  v-model:selected-values="columnFilters.industryType.selectedValues"
                  v-model:keyword-filter="columnFilters.industryType.keywordFilter"
                  @apply="onColumnFilterApply('industryType', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>支付方式</span>
                <ColumnFilter
                  column-key="payType"
                  :options="payTypeOptions"
                  v-model:selected-values="columnFilters.payType.selectedValues"
                  v-model:keyword-filter="columnFilters.payType.keywordFilter"
                  @apply="onColumnFilterApply('payType', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>账户</span>
                <ColumnFilter
                  column-key="account"
                  :options="accountOptions"
                  v-model:selected-values="columnFilters.account.selectedValues"
                  v-model:keyword-filter="columnFilters.account.keywordFilter"
                  @apply="onColumnFilterApply('account', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              金额
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>名称</span>
                <ColumnFilter
                  column-key="name"
                  :options="nameOptions"
                  v-model:selected-values="columnFilters.name.selectedValues"
                  v-model:keyword-filter="columnFilters.name.keywordFilter"
                  @apply="onColumnFilterApply('name', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>备注</span>
                <ColumnFilter
                  column-key="description"
                  :options="descriptionOptions"
                  v-model:selected-values="columnFilters.description.selectedValues"
                  v-model:keyword-filter="columnFilters.description.keywordFilter"
                  @apply="onColumnFilterApply('description', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>归属</span>
                <ColumnFilter
                  column-key="attribution"
                  :options="attributionOptions"
                  v-model:selected-values="columnFilters.attribution.selectedValues"
                  v-model:keyword-filter="columnFilters.attribution.keywordFilter"
                  @apply="onColumnFilterApply('attribution', $event)"
                />
              </div>
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              余额
            </th>
            <th
              class="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody
          class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
        >
          <tr v-if="loading" class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td
              colspan="10"
              class="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
            >
              <div class="flex items-center justify-center gap-2">
                <div
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"
                ></div>
                加载中...
              </div>
            </td>
          </tr>
          <tr
            v-else-if="paginatedFilteredFlows.length === 0"
            class="hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <td
              colspan="10"
              class="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
            >
              暂无数据
            </td>
          </tr>
          <!-- 按月收拢显示 -->
          <template v-else-if="monthlyCollapse">
            <template v-for="monthGroup in groupedFlows" :key="monthGroup.month">
              <!-- 月份汇总行 -->
              <tr class="bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-200 dark:border-blue-700">
                <td class="px-2 py-3">
                  <input
                    type="checkbox"
                    :checked="isMonthSelected(monthGroup.month)"
                    @change="toggleMonthSelection(monthGroup.month)"
                    class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                </td>
                <td class="px-2 py-3 font-semibold text-blue-900 dark:text-blue-100">
                  <div class="flex items-center gap-2">
                    <button
                      @click="toggleMonthCollapse(monthGroup.month)"
                      class="flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <ChevronRightIcon 
                        v-if="collapsedMonths.includes(monthGroup.month)"
                        class="h-4 w-4 transition-transform"
                      />
                      <ChevronDownIcon 
                        v-else
                        class="h-4 w-4 transition-transform"
                      />
                      {{ monthGroup.month }}
                    </button>
                  </div>
                </td>
                <td class="px-2 py-3 text-sm text-blue-800 dark:text-blue-200">
                  <div class="flex gap-2">
                    <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      收入: ¥{{ monthGroup.totalIncome.toFixed(2) }}
                    </span>
                    <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      支出: ¥{{ monthGroup.totalExpense.toFixed(2) }}
                    </span>
                  </div>
                </td>
                <td class="px-2 py-3 text-sm text-blue-800 dark:text-blue-200">
                  共 {{ monthGroup.flows.length }} 条记录
                </td>
                <td class="px-2 py-3 text-sm text-blue-800 dark:text-blue-200">
                  净收入: ¥{{ (monthGroup.totalIncome - monthGroup.totalExpense).toFixed(2) }}
                </td>
                <td colspan="5" class="px-2 py-3"></td>
              </tr>
              <!-- 该月份的流水记录 -->
              <template v-if="!collapsedMonths.includes(monthGroup.month)">
                <tr
                  v-for="item in monthGroup.flows"
                  :key="item.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td class="px-2 py-1 whitespace-nowrap">
                    <input
                      type="checkbox"
                      :checked="selectedItems.includes(item.id)"
                      @change="$emit('toggleSelectItem', item.id)"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                    {{ item.day }}
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                  <span>{{ item.displayFlowType || item.flowType }}</span>
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                    {{ item.displayIndustryType || item.industryType }}
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                    {{ item.payType }}
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                    <span v-if="item.type === 'transfer'" class="inline-flex items-center">
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                      ></div>
                      <span class="text-sm">{{ item.fromAccount.name }}</span>
                      <span class="mx-1 text-gray-400">→</span>
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                      ></div>
                      <span class="text-sm">{{ item.toAccount.name }}</span>
                    </span>
                    <span v-else-if="(item.attribution === '借贷' || item.flowType === '借贷') && (item.fromAccount && item.toAccount)" class="inline-flex items-center">
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                      ></div>
                      <span class="text-sm">{{ item.fromAccount.name }}</span>
                      <span class="mx-1 text-gray-400">→</span>
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                      ></div>
                      <span class="text-sm">{{ item.toAccount.name }}</span>
                    </span>
                    <span v-else-if="item.account" class="inline-flex items-center">
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :style="{ backgroundColor: getAccountColor(item.account.id) }"
                      ></div>
                      {{ item.account.name }}
                    </span>
                    <span v-else class="text-gray-400 text-xs">未指定</span>
                  </td>
                  <td class="px-2 py-1 whitespace-nowrap text-sm">
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        item.flowType === '收入'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : item.flowType === '支出'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                      ]"
                    >
                      {{ Number(item.money || 0).toFixed(2) }}
                    </span>
                  </td>
                  <td
                    class="px-2 py-1 text-sm text-gray-900 dark:text-gray-100 max-w-32 truncate"
                    :title="item.name"
                  >
                    {{ item.name }}
                  </td>
                  <td
                    class="px-2 py-1 text-sm text-gray-900 dark:text-gray-100 max-w-32 truncate"
                    :title="item.description"
                  >
                    {{ item.description }}
                  </td>
                  <td
                    class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                  >
                    {{ item.book?.bookName || item.attribution || '未指定' }}
                  </td>
                  <td class="px-2 py-1 whitespace-nowrap text-sm">
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        getBalanceForFlow(item) >= 0
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                      ]"
                    >
                      ¥{{ getBalanceForFlow(item).toFixed(2) }}
                    </span>
                  </td>
                  <td class="px-2 py-1 whitespace-nowrap text-sm font-medium">
                    <div class="flex gap-2">
                      <button
                        v-if="item.type === 'flow'"
                        @click="$emit('editItem', item)"
                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="编辑流水"
                      >
                        <PencilIcon class="h-4 w-4" />
                      </button>
                      <button
                        v-if="item.type === 'transfer'"
                        @click="$emit('editTransfer', item)"
                        class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="编辑转账"
                      >
                        <PencilIcon class="h-4 w-4" />
                      </button>
                      <button
                        @click="$emit('deleteItem', item)"
                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        :title="item.type === 'transfer' ? '删除转账' : '删除流水'"
                      >
                        <TrashIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </template>
          <!-- 普通列表显示 -->
          <template v-else>
            <tr
              v-for="item in paginatedFilteredFlows"
              :key="item.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <td class="px-2 py-1 whitespace-nowrap">
                <input
                  type="checkbox"
                  :checked="selectedItems.includes(item.id)"
                  @change="$emit('toggleSelectItem', item.id)"
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.day }}
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                <span>{{ item.displayFlowType || item.flowType }}</span>
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.displayIndustryType || item.industryType }}
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.payType }}
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                <span v-if="item.type === 'transfer'" class="inline-flex items-center">
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                  ></div>
                  <span class="text-sm">{{ item.fromAccount.name }}</span>
                  <span class="mx-1 text-gray-400">→</span>
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                  ></div>
                  <span class="text-sm">{{ item.toAccount.name }}</span>
                </span>
                <span v-else-if="(item.attribution === '借贷' || item.flowType === '借贷') && (item.fromAccount && item.toAccount)" class="inline-flex items-center">
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                  ></div>
                  <span class="text-sm">{{ item.fromAccount.name }}</span>
                  <span class="mx-1 text-gray-400">→</span>
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                  ></div>
                  <span class="text-sm">{{ item.toAccount.name }}</span>
                </span>
                <span v-else-if="(item.attribution === '借贷' || item.flowType === '借贷') && item.relatedAccount" class="inline-flex items-center">
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.account.id) }"
                  ></div>
                  <span class="text-sm">{{ item.account.name }}</span>
                  <span class="mx-1 text-gray-400">→</span>
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.relatedAccount.id) }"
                  ></div>
                  <span class="text-sm">{{ item.relatedAccount.name }}</span>
                </span>
                <span v-else-if="item.account" class="inline-flex items-center">
                  <div
                    class="w-2 h-2 rounded-full mr-2"
                    :style="{ backgroundColor: getAccountColor(item.account.id) }"
                  ></div>
                  {{ item.account.name }}
                </span>
                <span v-else class="text-gray-400 text-xs">未指定</span>
              </td>
              <td class="px-2 py-1 whitespace-nowrap text-sm">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                    item.flowType === '收入'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : item.flowType === '支出'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                  ]"
                >
                  {{ Number(item.money || 0).toFixed(2) }}
                </span>
              </td>
              <td
                class="px-2 py-1 text-sm text-gray-900 dark:text-gray-100 max-w-32 truncate"
                :title="item.name"
              >
                {{ item.name }}
              </td>
              <td
                class="px-2 py-1 text-sm text-gray-900 dark:text-gray-100 max-w-32 truncate"
                :title="item.description"
              >
                {{ item.description }}
              </td>
              <td
                class="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
              >
                {{ item.book?.bookName || item.attribution || '未指定' }}
              </td>
              <td class="px-2 py-1 whitespace-nowrap text-sm">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                    getBalanceForFlow(item) >= 0
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                  ]"
                >
                  ¥{{ getBalanceForFlow(item).toFixed(2) }}
                </span>
              </td>
              <td class="px-2 py-1 whitespace-nowrap text-sm font-medium">
                <div class="flex gap-2">
                  <button
                    v-if="item.type === 'flow'"
                    @click="$emit('editItem', item)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="编辑流水"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-if="item.type === 'transfer'"
                    @click="$emit('editTransfer', item)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="编辑转账"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                  <button
                    @click="$emit('deleteItem', item)"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    :title="item.type === 'transfer' ? '删除转账' : '删除流水'"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 移动端卡片 -->
    <div class="md:hidden">
      <div
        v-if="loading"
        class="p-8 text-center text-gray-500 dark:text-gray-400"
      >
        <div class="flex items-center justify-center gap-2">
          <div
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"
          ></div>
          加载中...
        </div>
      </div>
      <div
        v-else-if="paginatedFilteredFlows.length === 0"
        class="p-8 text-center text-gray-500 dark:text-gray-800"
      >
        暂无数据
      </div>
      <div class="max-h-[50vh] overflow-y-auto" v-else>
        <!-- 按月收拢显示 -->
        <template v-if="monthlyCollapse">
          <template v-for="monthGroup in groupedFlows" :key="monthGroup.month">
            <!-- 月份汇总卡片 -->
            <div class="bg-blue-50 dark:bg-blue-900/20 px-3 py-3 border-b-2 border-blue-200 dark:border-blue-700">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="isMonthSelected(monthGroup.month)"
                    @change="toggleMonthSelection(monthGroup.month)"
                    class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <button
                    @click="toggleMonthCollapse(monthGroup.month)"
                    class="flex items-center gap-1 font-semibold text-blue-900 dark:text-blue-100 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    <ChevronRightIcon 
                      v-if="collapsedMonths.includes(monthGroup.month)"
                      class="h-4 w-4 transition-transform"
                    />
                    <ChevronDownIcon 
                      v-else
                      class="h-4 w-4 transition-transform"
                    />
                    {{ monthGroup.month }}
                  </button>
                </div>
                <div class="text-sm text-blue-800 dark:text-blue-200">
                  {{ monthGroup.flows.length }} 条记录
                </div>
              </div>
              <div class="flex flex-wrap gap-2 text-xs">
                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  收入: ¥{{ monthGroup.totalIncome.toFixed(2) }}
                </span>
                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  支出: ¥{{ monthGroup.totalExpense.toFixed(2) }}
                </span>
                <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  净收入: ¥{{ (monthGroup.totalIncome - monthGroup.totalExpense).toFixed(2) }}
                </span>
              </div>
            </div>
            <!-- 该月份的流水记录 -->
            <template v-if="!collapsedMonths.includes(monthGroup.month)">
              <div
                v-for="item in monthGroup.flows"
                :key="item.id"
                class="bg-gray-50 dark:bg-gray-800 px-2 py-2 space-y-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <!-- 顶部：复选框、日期和删除按钮 -->
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      :checked="selectedItems.includes(item.id)"
                      @change="$emit('toggleSelectItem', item.id)"
                      class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{
                      item.day
                    }}</span>
                  </div>
                  <div class="flex items-center">
                    <button
                      @click="$emit('deleteItem', item)"
                      class="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="删除"
                    >
                      <TrashIcon class="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <!-- 中间内容 -->
                <div class="space-y-1">
                  <div
                    class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1"
                  >
                    {{ item.name }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                    {{ item.description }}
                  </div>

                  <!-- 标签、金额和编辑按钮在同一行 -->
                  <div
                    class="flex flex-wrap items-center justify-between gap-1 text-xs"
                  >
                    <div class="flex flex-wrap gap-1">
                      <span
                        class="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded"
                      >
                        {{ item.displayFlowType || item.flowType }}
                      </span>
                      <span
                        class="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded"
                      >
                        {{ item.displayIndustryType || item.industryType }}
                      </span>
                      <span
                        class="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded"
                      >
                        {{ item.payType }}
                      </span>
                      <span
                        v-if="item.type === 'transfer'"
                        class="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded inline-flex items-center"
                      >
                        <div
                          class="w-1.5 h-1.5 rounded-full mr-1"
                          :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                        ></div>
                        <span class="text-xs">{{ item.fromAccount.name }}</span>
                        <span class="mx-1 text-xs">→</span>
                        <div
                          class="w-1.5 h-1.5 rounded-full mr-1"
                          :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                        ></div>
                        <span class="text-xs">{{ item.toAccount.name }}</span>
                      </span>
                      <span
                        v-else-if="item.account"
                        class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded inline-flex items-center"
                      >
                        <div
                          class="w-1.5 h-1.5 rounded-full mr-1"
                          :style="{ backgroundColor: getAccountColor(item.account.id) }"
                        ></div>
                        {{ item.account.name }}
                      </span>
                      <span
                        v-else
                        class="bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded text-xs"
                      >
                        未指定账户
                      </span>
                      <span
                        v-if="item.book?.bookName || item.attribution"
                        class="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded"
                      >
                        {{ item.book?.bookName || item.attribution }}
                      </span>
                    </div>
                    <!-- 右侧：金额和编辑按钮 -->
                    <div class="flex items-center gap-2">
                      <span
                        :class="[
                          'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                          item.flowType === '收入'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : item.flowType === '支出'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                        ]"
                      >
                        {{ Number(item.money || 0).toFixed(2) }}
                      </span>
                      <span
                        :class="[
                          'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                          getBalanceForFlow(item) >= 0
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                        ]"
                      >
                        余额: ¥{{ getBalanceForFlow(item).toFixed(2) }}
                      </span>
                      <button
                        v-if="item.type === 'flow'"
                        @click="$emit('editItem', item)"
                        class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="编辑流水"
                      >
                        <PencilIcon class="h-3 w-3" />
                      </button>
                      <button
                        v-if="item.type === 'transfer'"
                        @click="$emit('editTransfer', item)"
                        class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="编辑转账"
                      >
                        <PencilIcon class="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </template>
        <!-- 普通列表显示 -->
        <template v-else>
          <div
            v-for="item in paginatedFilteredFlows"
            :key="item.id"
            class="bg-gray-50 dark:bg-gray-800 px-2 py-2 space-y-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
          >
            <!-- 顶部：复选框、日期和删除按钮 -->
            <div class="flex justify-between items-start">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="selectedItems.includes(item.id)"
                  @change="$emit('toggleSelectItem', item.id)"
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span class="text-xs text-gray-600 dark:text-gray-400">{{
                  item.day
                }}</span>
              </div>
              <div class="flex items-center">
                <button
                  @click="$emit('deleteItem', item)"
                  class="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="删除"
                >
                  <TrashIcon class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- 中间内容 -->
            <div class="space-y-1">
              <div
                class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1"
              >
                {{ item.name }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                {{ item.description }}
              </div>

              <!-- 标签、金额和编辑按钮在同一行 -->
              <div
                class="flex flex-wrap items-center justify-between gap-1 text-xs"
              >
                <div class="flex flex-wrap gap-1">
                  <span
                    class="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded"
                  >
                    {{ item.displayFlowType || item.flowType }}
                  </span>
                  <span
                    class="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded"
                  >
                    {{ item.displayIndustryType || item.industryType }}
                  </span>
                  <span
                    class="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded"
                  >
                    {{ item.payType }}
                  </span>
                  <span
                    v-if="item.type === 'transfer'"
                    class="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded inline-flex items-center"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full mr-1"
                      :style="{ backgroundColor: getAccountColor(item.fromAccount.id) }"
                    ></div>
                    <span class="text-xs">{{ item.fromAccount.name }}</span>
                    <span class="mx-1 text-xs">→</span>
                    <div
                      class="w-1.5 h-1.5 rounded-full mr-1"
                      :style="{ backgroundColor: getAccountColor(item.toAccount.id) }"
                    ></div>
                    <span class="text-xs">{{ item.toAccount.name }}</span>
                  </span>
                  <span
                    v-else-if="item.account"
                    class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded inline-flex items-center"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full mr-1"
                      :style="{ backgroundColor: getAccountColor(item.account.id) }"
                    ></div>
                    {{ item.account.name }}
                  </span>
                  <span
                    v-else
                    class="bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded text-xs"
                  >
                    未指定账户
                  </span>
                  <span
                    v-if="item.book?.bookName || item.attribution"
                    class="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded"
                  >
                    {{ item.book?.bookName || item.attribution }}
                  </span>
                </div>
                <!-- 右侧：金额和编辑按钮 -->
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      item.flowType === '收入'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : item.flowType === '支出'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                    ]"
                  >
                    {{ Number(item.money || 0).toFixed(2) }}
                  </span>
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      getBalanceForFlow(item) >= 0
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
                    ]"
                  >
                    余额: ¥{{ getBalanceForFlow(item).toFixed(2) }}
                  </span>
                  <button
                    v-if="item.type === 'flow'"
                    @click="$emit('editItem', item)"
                    class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="编辑流水"
                  >
                    <PencilIcon class="h-3 w-3" />
                  </button>
                  <button
                    v-if="item.type === 'transfer'"
                    @click="$emit('editTransfer', item)"
                    class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="编辑转账"
                  >
                    <PencilIcon class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 分页 -->
    <div
      v-if="!loading && paginatedFilteredFlows.length"
      class="p-2 md:px-4 md:py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600"
    >
      <div class="flex items-center justify-center gap-2">
        <!-- 分页信息 -->
        <div
          class="text-sm text-gray-700 dark:text-gray-300 text-center hidden md:block"
        >
          共 {{ filteredFlows.length }} 条记录
          <span v-if="filteredFlows.length !== props.flows.length" class="text-blue-600 dark:text-blue-400">
            (已筛选)
          </span>
          <span v-if="filteredFlows.length > 0" class="text-gray-500 dark:text-gray-400">
            - 第 {{ Math.min((currentPage - 1) * pageSize + 1, filteredFlows.length) }} - {{ Math.min(currentPage * pageSize, filteredFlows.length) }} 条
          </span>
        </div>

        <!-- 分页控件 - 响应式布局 -->
        <div class="flex flex-row items-center justify-center gap-4">
          <!-- 每页显示数量选择 -->
          <select
            :value="pageSize"
            @change="
              $emit(
                'changePageSize',
                ($event.target as HTMLSelectElement).value
              )
            "
            class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-green-950 dark:text-white"
          >
            <option value="20">20条/页</option>
            <option value="50">50条/页</option>
            <option value="100">100条/页</option>
            <option value="200">200条/页</option>
            <option value="500">500条/页</option>
            <option value="1000">1000条/页</option>
            <option value="999999">显示全部</option>
          </select>

          <!-- 分页按钮 - 始终显示，即使只有一页也显示页码跳转功能 -->
          <div class="flex items-center gap-1">
            <!-- 上一页 -->
            <button
              @click="$emit('changePage', currentPage - 1)"
              :disabled="currentPage <= 1"
              class="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-green-950 dark:text-white transition-colors"
              title="上一页"
            >
              <ChevronLeftIcon class="h-3 w-3 sm:h-4 sm:w-4" />
            </button>

            <!-- 页码按钮 - 只在多页时显示 -->
            <template v-if="filteredTotalPages > 1">
              <template
                v-for="(page, index) in mobileFriendlyPageNumbers"
                :key="index"
              >
                <button
                  v-if="page !== '...'"
                  @click="$emit('changePage', Number(page))"
                  :class="[
                    'h-7 w-7 sm:h-8 sm:w-8 text-center text-xs sm:text-sm border rounded transition-colors',
                    page === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-800 text-green-950 dark:text-white',
                  ]"
                >
                  {{ page }}
                </button>
                <span v-else class="px-1 text-gray-500 text-xs">...</span>
              </template>
            </template>

            <!-- 页码跳转输入框 -->
            <div class="flex items-center gap-1 ml-2">
              <input
                v-model="jumpPageInput"
                type="number"
                :min="1"
                :max="filteredTotalPages"
                placeholder="页码"
                class="w-16 h-7 sm:h-8 text-center text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-green-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                @keyup.enter="jumpToPage"
              />
              <button
                @click="jumpToPage"
                class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 bg-white dark:bg-gray-800 text-green-950 dark:text-white transition-colors"
                title="跳转"
              >
                跳转
              </button>
            </div>

            <!-- 下一页 -->
            <button
              @click="$emit('changePage', currentPage + 1)"
              :disabled="currentPage >= filteredTotalPages"
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
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import { generateMobileFriendlyPageNumbers } from "~/utils/common";
import ColumnFilter from "./ColumnFilter.vue";

interface FlowItem {
  id: string | number;
  type: 'flow' | 'transfer';
  day: string;
  flowType: string;
  industryType: string;
  payType: string;
  money: number;
  name: string;
  description: string;
  // 借贷相关字段
  loanType?: string;
  counterparty?: string;
  relatedFlowId?: number;
  attribution: string;
  book?: {
    id: number;
    bookId: string;
    bookName: string;
  };
  account?: {
    id: number;
    name: string;
  };
  // 转账特有字段
  fromAccount?: {
    id: number;
    name: string;
  };
  toAccount?: {
    id: number;
    name: string;
  };
  // 原始数据
  originalFlow?: any;
  originalTransfer?: any;
}

interface Props {
  flows: FlowItem[];
  selectedItems: (string | number)[];
  isAllSelected: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageNumbers: (number | string)[];
  loading?: boolean;
  defaultMonthlyCollapse?: boolean;
  accountId?: number;
  initialBalance?: number;
}

const props = defineProps<Props>();

// 按月收拢相关状态
const monthlyCollapse = ref(
  props.defaultMonthlyCollapse !== undefined ? props.defaultMonthlyCollapse : true
); // 默认启用按月收拢（可由父组件覆盖）
const collapsedMonths = ref<string[]>([]); // 默认所有月份都收拢

// 页码跳转相关状态
const jumpPageInput = ref<number | string>('');

// 列筛选相关状态
const columnFilters = ref({
  flowType: { selectedValues: [], keywordFilter: '' },
  industryType: { selectedValues: [], keywordFilter: '' },
  payType: { selectedValues: [], keywordFilter: '' },
  account: { selectedValues: [], keywordFilter: '' },
  name: { selectedValues: [], keywordFilter: '' },
  description: { selectedValues: [], keywordFilter: '' },
  attribution: { selectedValues: [], keywordFilter: '' }
});

// 筛选选项数据
const flowTypeOptions = computed(() => {
  const types = [...new Set(props.flows.map(flow => flow.displayFlowType || flow.flowType))];
  return types.map(type => ({
    value: type,
    label: type,
    count: props.flows.filter(flow => (flow.displayFlowType || flow.flowType) === type).length
  }));
});

const industryTypeOptions = computed(() => {
  const types = [...new Set(props.flows.map(flow => flow.displayIndustryType || flow.industryType))];
  return types.map(type => ({
    value: type,
    label: type,
    count: props.flows.filter(flow => (flow.displayIndustryType || flow.industryType) === type).length
  }));
});

const payTypeOptions = computed(() => {
  const types = [...new Set(props.flows.map(flow => flow.payType))];
  return types.map(type => ({
    value: type,
    label: type,
    count: props.flows.filter(flow => flow.payType === type).length
  }));
});

const accountOptions = computed(() => {
  const accounts = new Map();
  props.flows.forEach(flow => {
    // 处理转账类型的流水
    if (flow.type === 'transfer' && flow.fromAccount && flow.toAccount) {
      // 添加转出账户
      const fromAccountKey = `account_${flow.fromAccount.id}`;
      accounts.set(fromAccountKey, {
        id: flow.fromAccount.id,
        name: flow.fromAccount.name,
        count: (accounts.get(fromAccountKey)?.count || 0) + 1
      });
      
      // 添加转入账户
      const toAccountKey = `account_${flow.toAccount.id}`;
      accounts.set(toAccountKey, {
        id: flow.toAccount.id,
        name: flow.toAccount.name,
        count: (accounts.get(toAccountKey)?.count || 0) + 1
      });
    } 
    // 处理借贷类型的流水
    else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.fromAccount && flow.toAccount) {
      // 添加转出账户
      const fromAccountKey = `account_${flow.fromAccount.id}`;
      accounts.set(fromAccountKey, {
        id: flow.fromAccount.id,
        name: flow.fromAccount.name,
        count: (accounts.get(fromAccountKey)?.count || 0) + 1
      });
      
      // 添加转入账户
      const toAccountKey = `account_${flow.toAccount.id}`;
      accounts.set(toAccountKey, {
        id: flow.toAccount.id,
        name: flow.toAccount.name,
        count: (accounts.get(toAccountKey)?.count || 0) + 1
      });
    }
    // 处理借贷类型但有relatedAccount的流水
    else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.relatedAccount) {
      // 添加主账户
      const accountKey = `account_${flow.account.id}`;
      accounts.set(accountKey, {
        id: flow.account.id,
        name: flow.account.name,
        count: (accounts.get(accountKey)?.count || 0) + 1
      });
      
      // 添加关联账户
      const relatedAccountKey = `account_${flow.relatedAccount.id}`;
      accounts.set(relatedAccountKey, {
        id: flow.relatedAccount.id,
        name: flow.relatedAccount.name,
        count: (accounts.get(relatedAccountKey)?.count || 0) + 1
      });
    }
    // 处理普通流水
    else if (flow.account) {
      const accountKey = `account_${flow.account.id}`;
      accounts.set(accountKey, {
        id: flow.account.id,
        name: flow.account.name,
        count: (accounts.get(accountKey)?.count || 0) + 1
      });
    }
  });
  
  return Array.from(accounts.values()).map(account => ({
    value: `account_${account.id}`,
    label: account.name,
    count: account.count
  }));
});

const nameOptions = computed(() => {
  const names = [...new Set(props.flows.map(flow => flow.name))];
  return names.map(name => ({
    value: name,
    label: name,
    count: props.flows.filter(flow => flow.name === name).length
  }));
});

const descriptionOptions = computed(() => {
  const descriptions = [...new Set(props.flows.map(flow => flow.description).filter(Boolean))];
  return descriptions.map(desc => ({
    value: desc,
    label: desc,
    count: props.flows.filter(flow => flow.description === desc).length
  }));
});

const attributionOptions = computed(() => {
  const attributions = [...new Set(props.flows.map(flow => flow.book?.bookName || flow.attribution).filter(Boolean))];
  return attributions.map(attr => ({
    value: attr,
    label: attr,
    count: props.flows.filter(flow => (flow.book?.bookName || flow.attribution) === attr).length
  }));
});

// 分页后的筛选数据
const paginatedFilteredFlows = computed(() => {
  if (!filteredFlows.value || filteredFlows.value.length === 0) return [];
  
  const startIndex = (props.currentPage - 1) * props.pageSize;
  const endIndex = startIndex + props.pageSize;
  
  return filteredFlows.value.slice(startIndex, endIndex);
});

// 筛选后的总页数
const filteredTotalPages = computed(() => {
  return Math.ceil(filteredFlows.value.length / props.pageSize);
});

// 按月分组流水数据（使用分页后的数据）
const groupedFlows = computed(() => {
  if (!paginatedFilteredFlows.value || paginatedFilteredFlows.value.length === 0) return [];
  
  const groups: { [key: string]: FlowItem[] } = {};
  
  paginatedFilteredFlows.value.forEach(flow => {
    const date = new Date(flow.day);
    const monthKey = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月`;
    
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(flow);
  });
  
  // 转换为数组并按月份排序（最新的在前）
  return Object.keys(groups)
    .sort((a, b) => {
      const dateA = new Date(a.replace('年', '-').replace('月', ''));
      const dateB = new Date(b.replace('年', '-').replace('月', ''));
      return dateB.getTime() - dateA.getTime();
    })
    .map(month => {
      const flows = groups[month];
      const totalIncome = flows
        .filter(f => f.flowType === '收入')
        .reduce((sum, f) => sum + Number(f.money || 0), 0);
      const totalExpense = flows
        .filter(f => f.flowType === '支出')
        .reduce((sum, f) => sum + Number(f.money || 0), 0);
      
      return {
        month,
        flows,
        totalIncome,
        totalExpense
      };
    });
});

// 切换月份收拢状态
const toggleMonthCollapse = (month: string) => {
  const index = collapsedMonths.value.indexOf(month);
  if (index > -1) {
    collapsedMonths.value.splice(index, 1);
  } else {
    collapsedMonths.value.push(month);
  }
};

// 检查月份是否被选中
const isMonthSelected = (month: string) => {
  const monthGroup = groupedFlows.value.find(g => g.month === month);
  if (!monthGroup) return false;
  
  return monthGroup.flows.every(flow => props.selectedItems.includes(flow.id));
};

// 切换月份选择状态
const toggleMonthSelection = (month: string) => {
  const monthGroup = groupedFlows.value.find(g => g.month === month);
  if (!monthGroup) return;
  
  const isSelected = isMonthSelected(month);
  
  if (isSelected) {
    // 取消选择该月份的所有流水
    monthGroup.flows.forEach(flow => {
      const index = props.selectedItems.indexOf(flow.id);
      if (index > -1) {
        props.selectedItems.splice(index, 1);
      }
    });
  } else {
    // 选择该月份的所有流水
    monthGroup.flows.forEach(flow => {
      if (!props.selectedItems.includes(flow.id)) {
        props.selectedItems.push(flow.id);
      }
    });
  }
};

// 生成移动端友好的页码
const mobileFriendlyPageNumbers = computed(() => {
  return generateMobileFriendlyPageNumbers(
    props.currentPage,
    filteredTotalPages.value,
    3
  );
});

// 页码跳转方法
const jumpToPage = () => {
  const pageNum = Number(jumpPageInput.value);
  if (pageNum >= 1 && pageNum <= filteredTotalPages.value) {
    emit('changePage', pageNum);
    jumpPageInput.value = '';
  } else {
    // 可以添加错误提示
    console.warn('页码超出范围');
  }
};

// 生成账户颜色
const getAccountColor = (accountId: number) => {
  const colors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
  ];
  return colors[accountId % colors.length];
};

// 计算余额缓存
const balanceCache = ref<Map<string, number>>(new Map());
// 完整流水历史缓存
const allFlowsHistory = ref<FlowItem[]>([]);
const historyLoaded = ref(false);

// 获取账户的完整流水历史
const loadAllFlowsHistory = async () => {
  if (!props.accountId || historyLoaded.value) {
    return;
  }

  try {
    // 调用API获取该账户的所有流水记录（不分页）
    const { doApi } = await import('~/utils/api');
    const res = await doApi.post("api/entry/flow/page", {
      accountId: props.accountId,
      pageNum: 1,
      pageSize: -1, // -1表示获取全部
    });
    
    const responseData = res?.d || res;
    if (responseData && responseData.data) {
      allFlowsHistory.value = responseData.data;
      historyLoaded.value = true;
    }
  } catch (error) {
    console.error('获取完整流水历史失败:', error);
  }
};

// 计算指定流水执行后的账户余额
const getBalanceForFlow = (flow: FlowItem): number => {
  if (!props.accountId || props.initialBalance === undefined) {
    return 0;
  }

  const cacheKey = `${props.accountId}_${flow.id}`;
  if (balanceCache.value.has(cacheKey)) {
    return balanceCache.value.get(cacheKey)!;
  }

  // 如果还没有加载完整历史，先加载
  if (!historyLoaded.value) {
    loadAllFlowsHistory();
    return 0; // 暂时返回0，等历史加载完成后再计算
  }

  // 使用完整的流水历史，按时间排序
  const allFlows = [...allFlowsHistory.value].sort((a, b) => {
    const dateA = new Date(a.day).getTime();
    const dateB = new Date(b.day).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // 同一天按ID排序
    return parseInt(a.id.toString().split('_')[1]) - parseInt(b.id.toString().split('_')[1]);
  });

  // 从账户的初始余额开始计算
  // 这里使用账户的真实初始余额，而不是当前余额
  // 对于大多数账户，初始余额应该是0
  let currentBalance = 0;
  
  // 找到当前流水在完整历史中的位置
  const currentIndex = allFlows.findIndex(f => f.id === flow.id);
  
  if (currentIndex === -1) {
    // 如果当前流水不在完整历史中，说明可能是新添加的，返回当前余额
    return currentBalance;
  }
  
  // 计算到当前流水为止的余额
  for (let i = 0; i <= currentIndex; i++) {
    const currentFlow = allFlows[i];
    currentBalance += calculateFlowImpact(currentFlow, props.accountId);
  }

  // 缓存结果
  balanceCache.value.set(cacheKey, currentBalance);
  return currentBalance;
};

// 监听历史数据加载完成，清除缓存以重新计算余额
watch(historyLoaded, (loaded) => {
  if (loaded) {
    // 清除缓存，让余额重新计算
    balanceCache.value.clear();
  }
});

// 计算单条流水对账户余额的影响
const calculateFlowImpact = (flow: FlowItem, accountId: number): number => {
  const money = Number(flow.money || 0);
  
  // 普通流水记录
  if (flow.type === 'flow') {
    // 检查是否是该账户的流水
    if (flow.account && flow.account.id === accountId) {
      if (flow.flowType === '收入') {
        return money;
      } else if (flow.flowType === '支出') {
        return -money;
      }
    }
  }
  
  // 转账记录
  if (flow.type === 'transfer') {
    // 检查是否涉及该账户
    if (flow.fromAccount && flow.fromAccount.id === accountId) {
      // 从该账户转出，减少余额
      return -money;
    } else if (flow.toAccount && flow.toAccount.id === accountId) {
      // 转入该账户，增加余额
      return money;
    }
  }
  
  // 借贷记录（通过转账处理）
  if (flow.attribution === '借贷' || flow.flowType === '借贷') {
    if (flow.fromAccount && flow.fromAccount.id === accountId) {
      // 借出或还款，减少余额
      return -money;
    } else if (flow.toAccount && flow.toAccount.id === accountId) {
      // 借入或收款，增加余额
      return money;
    }
  }
  
  return 0;
};

// 筛选逻辑
const filteredFlows = computed(() => {
  if (!props.flows || props.flows.length === 0) return [];
  
  const result = props.flows.filter(flow => {
    // 流水类型筛选
    if (columnFilters.value.flowType.selectedValues.length > 0) {
      const flowType = flow.displayFlowType || flow.flowType;
      if (!columnFilters.value.flowType.selectedValues.includes(flowType)) {
        return false;
      }
    }
    if (columnFilters.value.flowType.keywordFilter.trim() !== '') {
      const flowType = flow.displayFlowType || flow.flowType;
      const keyword = columnFilters.value.flowType.keywordFilter.toLowerCase();
      if (!flowType.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 支出/收入类型筛选
    if (columnFilters.value.industryType.selectedValues.length > 0) {
      const industryType = flow.displayIndustryType || flow.industryType;
      if (!columnFilters.value.industryType.selectedValues.includes(industryType)) {
        return false;
      }
    }
    if (columnFilters.value.industryType.keywordFilter.trim() !== '') {
      const industryType = flow.displayIndustryType || flow.industryType;
      const keyword = columnFilters.value.industryType.keywordFilter.toLowerCase();
      if (!industryType.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 支付方式筛选
    if (columnFilters.value.payType.selectedValues.length > 0) {
      if (!columnFilters.value.payType.selectedValues.includes(flow.payType)) {
        return false;
      }
    }
    if (columnFilters.value.payType.keywordFilter.trim() !== '') {
      const keyword = columnFilters.value.payType.keywordFilter.toLowerCase();
      if (!flow.payType.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 账户筛选
    if (columnFilters.value.account.selectedValues.length > 0) {
      let accountMatch = false;
      
      // 检查选中的账户ID是否与当前流水的任何账户匹配
      const selectedAccountIds = columnFilters.value.account.selectedValues
        .filter(value => value.startsWith('account_'))
        .map(value => parseInt(value.replace('account_', '')));
      
      if (flow.type === 'transfer' && flow.fromAccount && flow.toAccount) {
        // 转账类型：检查转出账户或转入账户是否匹配
        accountMatch = selectedAccountIds.includes(flow.fromAccount.id) || 
                      selectedAccountIds.includes(flow.toAccount.id);
      } 
      else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.fromAccount && flow.toAccount) {
        // 借贷类型（有fromAccount和toAccount）：检查转出账户或转入账户是否匹配
        accountMatch = selectedAccountIds.includes(flow.fromAccount.id) || 
                      selectedAccountIds.includes(flow.toAccount.id);
      }
      else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.relatedAccount) {
        // 借贷类型（有relatedAccount）：检查主账户或关联账户是否匹配
        accountMatch = selectedAccountIds.includes(flow.account.id) || 
                      selectedAccountIds.includes(flow.relatedAccount.id);
      }
      else if (flow.account) {
        // 普通流水：检查主账户是否匹配
        accountMatch = selectedAccountIds.includes(flow.account.id);
      }
      
      if (!accountMatch) {
        return false;
      }
    }
    
    if (columnFilters.value.account.keywordFilter.trim() !== '') {
      const keyword = columnFilters.value.account.keywordFilter.toLowerCase();
      let accountMatch = false;
      
      if (flow.type === 'transfer' && flow.fromAccount && flow.toAccount) {
        // 转账类型：检查转出账户或转入账户名称是否包含关键字
        accountMatch = flow.fromAccount.name.toLowerCase().includes(keyword) || 
                      flow.toAccount.name.toLowerCase().includes(keyword);
      } 
      else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.fromAccount && flow.toAccount) {
        // 借贷类型（有fromAccount和toAccount）：检查转出账户或转入账户名称是否包含关键字
        accountMatch = flow.fromAccount.name.toLowerCase().includes(keyword) || 
                      flow.toAccount.name.toLowerCase().includes(keyword);
      }
      else if ((flow.attribution === '借贷' || flow.flowType === '借贷') && flow.relatedAccount) {
        // 借贷类型（有relatedAccount）：检查主账户或关联账户名称是否包含关键字
        accountMatch = flow.account.name.toLowerCase().includes(keyword) || 
                      flow.relatedAccount.name.toLowerCase().includes(keyword);
      }
      else if (flow.account) {
        // 普通流水：检查主账户名称是否包含关键字
        accountMatch = flow.account.name.toLowerCase().includes(keyword);
      }
      
      if (!accountMatch) {
        return false;
      }
    }

    // 名称筛选
    if (columnFilters.value.name.selectedValues.length > 0) {
      if (!columnFilters.value.name.selectedValues.includes(flow.name)) {
        return false;
      }
    }
    if (columnFilters.value.name.keywordFilter.trim() !== '') {
      const keyword = columnFilters.value.name.keywordFilter.toLowerCase();
      if (!flow.name.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 备注筛选
    if (columnFilters.value.description.selectedValues.length > 0) {
      if (!columnFilters.value.description.selectedValues.includes(flow.description)) {
        return false;
      }
    }
    if (columnFilters.value.description.keywordFilter.trim() !== '') {
      const keyword = columnFilters.value.description.keywordFilter.toLowerCase();
      if (!flow.description.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // 归属筛选
    if (columnFilters.value.attribution.selectedValues.length > 0) {
      const attribution = flow.book?.bookName || flow.attribution;
      if (!columnFilters.value.attribution.selectedValues.includes(attribution)) {
        return false;
      }
    }
    if (columnFilters.value.attribution.keywordFilter.trim() !== '') {
      const attribution = flow.book?.bookName || flow.attribution;
      const keyword = columnFilters.value.attribution.keywordFilter.toLowerCase();
      if (!attribution.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    return true;
  });
  
  return result;
});

// 列筛选事件处理
const onColumnFilterApply = (columnKey: string, filter: { selectedValues: string[]; keywordFilter: string }) => {
  // 更新本地筛选状态
  columnFilters.value[columnKey as keyof typeof columnFilters.value] = {
    selectedValues: [...filter.selectedValues],
    keywordFilter: filter.keywordFilter
  };
  
  // 发出筛选变化事件，通知父组件更新数据
  emit('columnFilterChange', {
    columnKey,
    filter: { ...filter }
  });
  
  // 筛选后重置到第一页，便于展示筛选结果
  emit('changePage', 1);
};

defineEmits<{
  toggleSelectAll: [];
  toggleSelectItem: [id: string | number];
  editItem: [item: FlowItem];
  editTransfer: [item: FlowItem];
  deleteItem: [item: FlowItem];
  changePage: [page: number | string];
  changePageSize: [size: string];
  columnFilterChange: [data: { columnKey: string; filter: { selectedValues: string[]; keywordFilter: string } }];
}>();

// 初始化时将所有月份设为收拢状态
onMounted(() => {
  // 当数据加载完成后，将所有月份设为收拢状态
  if (groupedFlows.value.length > 0) {
    collapsedMonths.value = groupedFlows.value.map(g => g.month);
  }
});

// 监听分组数据变化，自动收拢新月份
watch(groupedFlows, (newGroups) => {
  if (newGroups.length > 0) {
    const newMonths = newGroups.map(g => g.month);
    // 只添加新的月份到收拢列表，保持用户的手动展开状态
    newMonths.forEach(month => {
      if (!collapsedMonths.value.includes(month)) {
        collapsedMonths.value.push(month);
      }
    });
  }
}, { immediate: true });

// 监听账户ID变化，重新加载完整历史
watch(() => props.accountId, (newAccountId) => {
  if (newAccountId) {
    // 重置缓存和历史数据
    balanceCache.value.clear();
    allFlowsHistory.value = [];
    historyLoaded.value = false;
    // 加载新的完整历史
    loadAllFlowsHistory();
  }
}, { immediate: true });

</script>

