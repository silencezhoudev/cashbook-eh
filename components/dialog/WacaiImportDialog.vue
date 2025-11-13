<template>
  <!-- 挖财导入专用对话框 -->
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-y-auto"
  >
    <!-- 标题栏 -->
    <div
      class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        挖财数据导入
      </h3>
      <button
        @click="closeDialog"
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- 步骤导航 -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex justify-center space-x-8 px-4" aria-label="步骤">
        <button
          v-for="step in steps"
          :key="step.id"
          @click="currentStep = step.id"
          :class="[
            'py-4 px-2 border-b-2 font-medium text-sm transition-colors',
            currentStep === step.id
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
        >
          <span class="flex items-center gap-2">
            <span
              :class="[
                'flex items-center justify-center w-6 h-6 rounded-full text-xs',
                currentStep === step.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400',
              ]"
            >
              {{ step.id }}
            </span>
            {{ step.title }}
          </span>
        </button>
      </nav>
    </div>

    <!-- 步骤内容 -->
    <div class="p-6">
      <!-- 步骤 1: 文件选择和账本选择 -->
      <div v-if="currentStep === 1" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 文件选择 -->
          <div class="space-y-4">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white">
              选择Excel文件
            </h4>
            <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                @change="onFileChange"
                class="hidden"
              />
              <button
                @click="selectFile"
                class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <DocumentArrowUpIcon class="h-5 w-5" />
                {{ selectedFile ? '重新选择文件' : '选择Excel文件' }}
              </button>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                支持 .xlsx 和 .xls 格式
              </p>
              <p v-if="selectedFile" class="mt-2 text-sm text-green-600 dark:text-green-400">
                已选择: {{ selectedFile.name }}
              </p>
            </div>
          </div>

          <!-- 账本选择 -->
          <div class="space-y-4">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white">
              选择目标账本
            </h4>
            <div class="space-y-3">
              <select
                v-model="selectedBookId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">请选择账本</option>
                <option v-for="book in books" :key="book.id" :value="book.bookId">
                  {{ book.bookName }}
                </option>
              </select>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                数据将导入到选定的账本中
              </p>
            </div>
          </div>
        </div>

        <!-- 导入选项 -->
        <div class="space-y-4">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">
            导入选项
          </h4>
          <div class="space-y-3">
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="autoCreateAccounts"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                自动创建不存在的账户
              </span>
            </label>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              如果Excel中的账户不存在，系统将自动创建
            </p>
          </div>
        </div>

        <div class="text-center pt-4">
          <button
            @click="toStep2"
            :disabled="!selectedFile || !selectedBookId"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            下一步
          </button>
        </div>
      </div>

      <!-- 步骤 2: 数据预览和验证 -->
      <div v-if="currentStep === 2" class="space-y-6">
        <div class="text-center">
          <button
            @click="parseAndValidateData"
            :disabled="!selectedFile || parsing"
            class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
          >
            <div
              v-if="parsing"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
            ></div>
            <MagnifyingGlassIcon class="h-5 w-5" />
            {{ parsing ? '解析中...' : '解析并验证数据' }}
          </button>
        </div>

        <!-- 解析进度 -->
        <div v-if="parsing" class="space-y-4">
          <div class="text-center">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ parsingStatus }}</p>
            <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: parsingProgress + '%' }"
              ></div>
            </div>
            <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
              {{ parsingProgress }}% 完成
            </p>
          </div>
        </div>

        <!-- 解析结果 -->
        <div v-if="parsedData" class="space-y-6">
          <!-- 元数据信息 -->
          <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">
              文件信息
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">账本名称:</span>
                <span class="ml-2 text-gray-900 dark:text-white">{{ parsedData.metadata.bookName }}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">总笔数:</span>
                <span class="ml-2 text-gray-900 dark:text-white">{{ parsedData.metadata.totalCount }}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">时间范围:</span>
                <span class="ml-2 text-gray-900 dark:text-white">
                  {{ parsedData.metadata.dateRange.start }} ~ {{ parsedData.metadata.dateRange.end }}
                </span>
              </div>
            </div>
          </div>

          <!-- 验证结果 -->
          <div v-if="validationResult" class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-lg font-medium text-gray-900 dark:text-white">
                验证结果
              </h4>
              <span
                :class="[
                  'px-3 py-1 rounded-full text-sm font-medium',
                  validationResult.isValid
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                ]"
              >
                {{ validationResult.isValid ? '验证通过' : '验证失败' }}
              </span>
            </div>

            <!-- 统计信息 -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div class="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {{ validationResult.stats.totalRows }}
                </div>
                <div class="text-sm text-blue-600 dark:text-blue-400">总行数</div>
              </div>
              <div class="bg-green-50 dark:bg-green-900 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {{ validationResult.stats.validRows }}
                </div>
                <div class="text-sm text-green-600 dark:text-green-400">有效行</div>
              </div>
              <div 
                class="bg-red-50 dark:bg-red-900 p-3 rounded-lg text-center cursor-pointer hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                @click="toggleInvalidRowsDetails"
              >
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">
                  {{ validationResult.stats.invalidRows }}
                </div>
                <div class="text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                  无效行
                  <ChevronDownIcon 
                    :class="[
                      'w-4 h-4 transition-transform',
                      showInvalidRowsDetails ? 'rotate-180' : ''
                    ]"
                  />
                </div>
              </div>
              <div 
                class="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-lg text-center cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
                @click="toggleNewAccountsDetails"
              >
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {{ validationResult.stats.newAccounts }}
                </div>
                <div class="text-sm text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
                  新账户
                  <ChevronDownIcon 
                    :class="[
                      'w-4 h-4 transition-transform',
                      showNewAccountsDetails ? 'rotate-180' : ''
                    ]"
                  />
                </div>
              </div>
              <div 
                class="bg-green-50 dark:bg-green-900 p-3 rounded-lg text-center cursor-pointer hover:bg-green-100 dark:hover:bg-green-800 transition-colors"
                @click="toggleExistingAccountsDetails"
              >
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {{ validationResult.stats.existingAccounts }}
                </div>
                <div class="text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                  已存在账户
                  <ChevronDownIcon 
                    :class="[
                      'w-4 h-4 transition-transform',
                      showExistingAccountsDetails ? 'rotate-180' : ''
                    ]"
                  />
                </div>
              </div>
            </div>

            <!-- 错误和警告 -->
            <div v-if="validationResult?.errors?.length > 0" class="space-y-2">
              <h5 class="font-medium text-red-600 dark:text-red-400">错误信息</h5>
              <div class="max-h-40 overflow-y-auto space-y-1">
                <div
                  v-for="error in validationResult.errors.slice(0, 10)"
                  :key="error.row"
                  class="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 rounded"
                >
                  第{{ error.row }}行: {{ error.message }}
                </div>
                <div v-if="validationResult.errors.length > 10" class="text-sm text-gray-500">
                  还有 {{ validationResult.errors.length - 10 }} 个错误...
                </div>
              </div>
            </div>

            <div v-if="validationResult?.warnings?.length > 0" class="space-y-2">
              <h5 class="font-medium text-yellow-600 dark:text-yellow-400">警告信息</h5>
              <div class="max-h-40 overflow-y-auto space-y-1">
                <div
                  v-for="warning in validationResult.warnings.slice(0, 5)"
                  :key="warning.row"
                  class="text-sm text-yellow-600 dark:text-yellow-400 p-2 bg-yellow-50 dark:bg-yellow-900 rounded"
                >
                  第{{ warning.row }}行: {{ warning.message }}
                </div>
                <div v-if="validationResult.warnings.length > 5" class="text-sm text-gray-500">
                  还有 {{ validationResult.warnings.length - 5 }} 个警告...
                </div>
              </div>
            </div>
          </div>

          <!-- 无效行详情 -->
          <div v-if="showInvalidRowsDetails && validationResult?.errors?.length > 0" class="space-y-4">
            <div class="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
              <h5 class="font-medium text-red-600 dark:text-red-400 mb-3">
                无效行详情 ({{ validationResult.errors.length }} 条)
              </h5>
              <div class="max-h-60 overflow-y-auto space-y-2">
                <div
                  v-for="error in validationResult.errors"
                  :key="error.row"
                  class="text-sm p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700"
                >
                  <div class="font-medium text-red-600 dark:text-red-400 mb-1">
                    第{{ error.row }}行: {{ error.message }}
                  </div>
                  <div v-if="error.data" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span class="font-medium">原始数据:</span>
                    {{ error.data.join(' | ') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 新账户详情 -->
          <div v-if="showNewAccountsDetails && validationResult?.newAccounts?.length > 0" class="space-y-4">
            <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
              <h5 class="font-medium text-yellow-600 dark:text-yellow-400 mb-3">
                新账户详情 ({{ validationResult.newAccounts.length }} 个)
              </h5>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div
                  v-for="account in validationResult.newAccounts"
                  :key="account"
                  class="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700"
                >
                  <div class="font-medium text-yellow-600 dark:text-yellow-400">
                    {{ account }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    系统将自动创建此账户
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 已存在账户详情 -->
          <div v-if="showExistingAccountsDetails && validationResult?.existingAccounts?.length > 0" class="space-y-4">
            <div class="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
              <h5 class="font-medium text-green-600 dark:text-green-400 mb-3">
                已存在账户详情 ({{ validationResult.existingAccounts.length }} 个)
              </h5>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div
                  v-for="account in validationResult.existingAccounts"
                  :key="account"
                  class="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700"
                >
                  <div class="font-medium text-green-600 dark:text-green-400">
                    {{ account }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    账户已存在，将直接使用
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 数据编辑表格 -->
          <div v-if="validationResult?.allData" class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-lg font-medium text-gray-900 dark:text-white">
                数据编辑 ({{ validationResult.allData.length }} 条记录)
              </h4>
              <div class="flex gap-2">
                <button
                  @click="toggleEditMode"
                  :class="[
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    editMode 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300'
                  ]"
                >
                  {{ editMode ? '完成编辑' : '编辑数据' }}
                </button>
                <button
                  v-if="editMode"
                  @click="resetEdits"
                  class="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                >
                  重置
                </button>
              </div>
            </div>
            
            <!-- 账户预览 -->
            <div v-if="validationResult?.newAccounts?.length > 0 || validationResult?.existingAccounts?.length > 0" class="space-y-2">
              <div v-if="validationResult?.newAccounts?.length > 0" class="space-y-2">
                <h5 class="font-medium text-yellow-600 dark:text-yellow-400">即将创建的新账户 ({{ validationResult.newAccounts.length }} 个)</h5>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="account in validationResult.newAccounts"
                    :key="account"
                    class="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md text-sm"
                  >
                    {{ account }}
                  </span>
                </div>
              </div>
              <div v-if="validationResult?.existingAccounts?.length > 0" class="space-y-2">
                <h5 class="font-medium text-green-600 dark:text-green-400">已存在的账户 ({{ validationResult.existingAccounts.length }} 个)</h5>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="account in validationResult.existingAccounts"
                    :key="account"
                    class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-md text-sm"
                  >
                    {{ account }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="overflow-x-auto border rounded-lg max-h-96">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      行号
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      日期
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      类型
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      类别
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      金额
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      账户
                    </th>
                    <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      备注
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="item in validationResult.allData" :key="item.row">
                    <td class="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {{ item.row }}
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <input
                        v-if="editMode"
                        v-model="item.data.day"
                        type="date"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.day }}</span>
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <select
                        v-if="editMode"
                        v-model="item.data.flowType"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="收入">收入</option>
                        <option value="支出">支出</option>
                        <option value="转账">转账</option>
                      </select>
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.flowType }}</span>
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <input
                        v-if="editMode"
                        v-model="item.data.industryType"
                        type="text"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.industryType }}</span>
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <input
                        v-if="editMode"
                        v-model.number="item.data.money"
                        type="number"
                        step="0.01"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.money }}</span>
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <div v-if="item.data.isTransfer" class="space-y-1">
                        <div class="text-xs text-blue-600 dark:text-blue-400">转账</div>
                        <div v-if="editMode" class="space-y-1">
                          <input
                            v-model="item.data.fromAccount"
                            type="text"
                            placeholder="转出账户"
                            class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            v-model="item.data.toAccount"
                            type="text"
                            placeholder="转入账户"
                            class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div v-else class="text-xs">
                          <div class="text-red-600 dark:text-red-400">{{ item.data.fromAccount }} →</div>
                          <div class="text-green-600 dark:text-green-400">{{ item.data.toAccount }}</div>
                        </div>
                      </div>
                      <div v-else>
                        <input
                          v-if="editMode"
                          v-model="item.data.accountName"
                          type="text"
                          class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.accountName }}</span>
                      </div>
                    </td>
                    <td class="px-2 py-2 text-sm">
                      <input
                        v-if="editMode"
                        v-model="item.data.description"
                        type="text"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span v-else class="text-gray-900 dark:text-gray-100">{{ item.data.description }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="flex justify-center gap-4 pt-4">
          <button
            @click="toStep1"
            class="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            上一步
          </button>
          <button
            @click="toStep3"
            :disabled="!validationResult || !validationResult.isValid"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            下一步
          </button>
        </div>
      </div>

      <!-- 步骤 3: 确认导入 -->
      <div v-if="currentStep === 3" class="space-y-6">
        <div class="text-center">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            确认导入
          </h4>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            即将导入 {{ validationResult?.stats.validRows }} 条有效流水记录
          </p>
          
          <button
            @click="startImport"
            :disabled="importing"
            class="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
          >
            <div
              v-if="importing"
              class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
            ></div>
            <CheckIcon class="h-5 w-5" />
            {{ importing ? '导入中...' : '开始导入' }}
          </button>
        </div>

        <!-- 导入进度 -->
        <div v-if="importing" class="space-y-4">
          <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: importProgress + '%' }"
            ></div>
          </div>
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            {{ importProgress }}% 完成
          </p>
        </div>

        <!-- 导入结果 -->
        <div v-if="importResult" class="space-y-4">
          <div
            :class="[
              'p-4 rounded-lg',
              importResult.success
                ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
            ]"
          >
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="importResult.success"
                class="h-5 w-5 text-green-600 dark:text-green-400 mr-2"
              />
              <XCircleIcon
                v-else
                class="h-5 w-5 text-red-600 dark:text-red-400 mr-2"
              />
              <h5
                :class="[
                  'font-medium',
                  importResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                ]"
              >
                {{ importResult.success ? '导入成功' : '导入失败' }}
              </h5>
            </div>
            <p
              :class="[
                'mt-2 text-sm',
                importResult.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              ]"
            >
              {{ importResult.message }}
            </p>
          </div>

          <!-- 详细结果 -->
          <div v-if="importResult.success && importResult.data" class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div class="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {{ importResult.data.stats.successCount }}
                </div>
                <div class="text-sm text-blue-600 dark:text-blue-400">成功导入</div>
              </div>
              <div 
                class="bg-red-50 dark:bg-red-900 p-3 rounded-lg text-center cursor-pointer hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                @click="toggleFailedDataDetails"
              >
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">
                  {{ importResult.data.stats.errorCount }}
                </div>
                <div class="text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                  导入失败
                  <ChevronDownIcon 
                    :class="[
                      'w-4 h-4 transition-transform',
                      showFailedDataDetails ? 'rotate-180' : ''
                    ]"
                  />
                </div>
              </div>
              <div 
                v-if="importResult.data.stats.skippedCount > 0"
                class="bg-orange-50 dark:bg-orange-900 p-3 rounded-lg text-center cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-800 transition-colors"
                @click="toggleSkippedDataDetails"
              >
                <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {{ importResult.data.stats.skippedCount }}
                </div>
                <div class="text-sm text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                  跳过行数
                  <ChevronDownIcon 
                    :class="[
                      'w-4 h-4 transition-transform',
                      showSkippedDataDetails ? 'rotate-180' : ''
                    ]"
                  />
                </div>
              </div>
              <div class="bg-green-50 dark:bg-green-900 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {{ importResult.data.stats.accountCount }}
                </div>
                <div class="text-sm text-green-600 dark:text-green-400">创建账户</div>
              </div>
              <div class="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-lg text-center">
                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {{ importResult.data.stats.totalRows }}
                </div>
                <div class="text-sm text-yellow-600 dark:text-yellow-400">总行数</div>
              </div>
            </div>

            <!-- 失败数据详情 -->
            <div v-if="showFailedDataDetails && importResult.data.errors.length > 0" class="space-y-4">
              <div class="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
                <h5 class="font-medium text-red-600 dark:text-red-400 mb-3">
                  导入失败详情 ({{ importResult.data.errors.length }} 条)
                </h5>
                <div class="max-h-60 overflow-y-auto space-y-2">
                  <div
                    v-for="error in importResult.data.errors"
                    :key="error.row"
                    class="text-sm p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700"
                  >
                    <div class="font-medium text-red-600 dark:text-red-400 mb-1">
                      第{{ error.row }}行: {{ error.error }}
                    </div>
                    <div v-if="error.data" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span class="font-medium">原始数据:</span>
                      {{ error.data.join(' | ') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 跳过数据详情 -->
            <div v-if="showSkippedDataDetails && importResult.data.skippedRows && importResult.data.skippedRows.length > 0" class="space-y-4">
              <div class="bg-orange-50 dark:bg-orange-900 p-4 rounded-lg">
                <h5 class="font-medium text-orange-600 dark:text-orange-400 mb-3">
                  跳过数据详情 ({{ importResult.data.skippedRows.length }} 条)
                </h5>
                <div class="max-h-60 overflow-y-auto space-y-2">
                  <div
                    v-for="skipped in importResult.data.skippedRows"
                    :key="skipped.row"
                    class="text-sm p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700"
                  >
                    <div class="font-medium text-orange-600 dark:text-orange-400 mb-1">
                      第{{ skipped.row }}行: {{ skipped.error }}
                    </div>
                    <div v-if="skipped.data" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span class="font-medium">原始数据:</span>
                      {{ skipped.data.join(' | ') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center pt-4">
          <button
            @click="toStep2"
            :disabled="importing"
            class="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            上一步
          </button>
          <button
            @click="closeDialog"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ml-4"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline';
import { doApi } from "~/utils/api";

// ESC键监听
useEscapeKey(() => {
  closeDialog();
});

const emits = defineEmits(['success-callback', 'close']);

// 步骤配置
const steps = [
  { id: 1, title: '文件选择' },
  { id: 2, title: '数据验证' },
  { id: 3, title: '确认导入' },
];

// 响应式数据
const currentStep = ref(1);
const selectedFile = ref<File | null>(null);
const selectedBookId = ref('');
const autoCreateAccounts = ref(true);
const books = ref<any[]>([]);
const fileInput = ref<HTMLInputElement>();

// 解析和验证相关
const parsing = ref(false);
const parsingProgress = ref(0);
const parsingStatus = ref('');
const parsedData = ref<any>(null);
const validationResult = ref<any>(null);

// 导入相关
const importing = ref(false);
const importProgress = ref(0);
const importResult = ref<any>(null);

// 编辑相关
const editMode = ref(false);
const originalData = ref<any[]>([]);
const newAccounts = ref<string[]>([]);

// 详情展开状态
const showInvalidRowsDetails = ref(false);
const showNewAccountsDetails = ref(false);
const showExistingAccountsDetails = ref(false);
const showFailedDataDetails = ref(false);
const showSkippedDataDetails = ref(false);

// 选择文件
const selectFile = () => {
  fileInput.value?.click();
};

// 文件变化处理
const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFile.value = file;
  }
};

// 步骤切换
const toStep1 = () => {
  currentStep.value = 1;
};

const toStep2 = () => {
  currentStep.value = 2;
};

const toStep3 = () => {
  currentStep.value = 3;
};

// 编辑相关方法
const toggleEditMode = () => {
  if (!editMode.value) {
    // 进入编辑模式，保存原始数据
    originalData.value = JSON.parse(JSON.stringify(validationResult.value.allData));
    extractNewAccounts();
  }
  editMode.value = !editMode.value;
};

const resetEdits = () => {
  if (originalData.value.length > 0) {
    validationResult.value.allData = JSON.parse(JSON.stringify(originalData.value));
  }
};

const extractNewAccounts = () => {
  const accounts = new Set<string>();
  console.log('开始提取新账户，数据行数:', validationResult.value?.allData?.length);
  
  if (validationResult.value?.allData) {
    validationResult.value.allData.forEach((item: any, index: number) => {
      console.log(`第${index}行数据:`, item.data);
      
      if (item.data.isTransfer) {
        // 转账类型：提取转出和转入账户
        if (item.data.fromAccount) {
          const cleanAccount = cleanAccountName(item.data.fromAccount);
          if (cleanAccount) {
            accounts.add(cleanAccount);
            console.log('添加转账转出账户:', cleanAccount);
          }
        }
        if (item.data.toAccount) {
          const cleanAccount = cleanAccountName(item.data.toAccount);
          if (cleanAccount) {
            accounts.add(cleanAccount);
            console.log('添加转账转入账户:', cleanAccount);
          }
        }
      } else if (item.data.isLoan) {
        // 借贷类型：提取借贷账户
        if (item.data.loanAccountName) {
          const cleanAccount = cleanAccountName(item.data.loanAccountName);
          if (cleanAccount) {
            accounts.add(cleanAccount);
            console.log('添加借贷账户:', cleanAccount);
          }
        }
      } else if (item.data.accountName) {
        // 普通账户
        const cleanAccount = cleanAccountName(item.data.accountName);
        if (cleanAccount) {
          accounts.add(cleanAccount);
          console.log('添加普通账户:', cleanAccount);
        }
      }
    });
  }
  
  newAccounts.value = Array.from(accounts).sort();
  console.log('提取到的新账户:', newAccounts.value);
};

// 清理账户名称的辅助函数
const cleanAccountName = (name: string): string => {
  if (!name) return '';
  
  let cleanName = String(name).trim();
  
  // 移除开头的逗号、空格等无效字符
  cleanName = cleanName.replace(/^[，,、\s]+/, '');
  
  // 移除结尾的逗号、空格等无效字符
  cleanName = cleanName.replace(/[，,、\s]+$/, '');
  
  // 移除明显的后缀，保留银行名称等关键信息
  cleanName = cleanName.replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$|现金$|支付宝$|微信$/g, '');
  
  // 合并多个空格
  cleanName = cleanName.replace(/\s+/g, ' ');
  
  // 移除特殊字符，但保留中文、英文、数字和空格
  cleanName = cleanName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
  
  return cleanName.trim();
};

// 详情展开/收起方法
const toggleInvalidRowsDetails = () => {
  showInvalidRowsDetails.value = !showInvalidRowsDetails.value;
  console.log('切换无效行详情显示:', showInvalidRowsDetails.value);
  console.log('无效行数据:', validationResult.value?.errors);
};

const toggleNewAccountsDetails = () => {
  showNewAccountsDetails.value = !showNewAccountsDetails.value;
  console.log('切换新账户详情显示:', showNewAccountsDetails.value);
  console.log('新账户数据:', validationResult.value?.newAccounts);
};

const toggleExistingAccountsDetails = () => {
  showExistingAccountsDetails.value = !showExistingAccountsDetails.value;
  console.log('切换已存在账户详情显示:', showExistingAccountsDetails.value);
  console.log('已存在账户数据:', validationResult.value?.existingAccounts);
};

const toggleFailedDataDetails = () => {
  showFailedDataDetails.value = !showFailedDataDetails.value;
  console.log('切换失败数据详情显示:', showFailedDataDetails.value);
  console.log('失败数据:', importResult.value?.data?.errors);
};

const toggleSkippedDataDetails = () => {
  showSkippedDataDetails.value = !showSkippedDataDetails.value;
  console.log('切换跳过数据详情显示:', showSkippedDataDetails.value);
  console.log('跳过数据:', importResult.value?.data?.skippedRows);
};

// 解析和验证数据
const parseAndValidateData = async () => {
  if (!selectedFile.value) {
    alert('请先选择Excel文件');
    return;
  }
  
  if (!selectedBookId.value) {
    alert('请先选择目标账本');
    return;
  }

  parsing.value = true;
  parsedData.value = null;
  validationResult.value = null;
  
  try {
    console.log('=== 开始解析和验证数据 ===');
    console.log('文件名:', selectedFile.value.name);
    console.log('文件大小:', selectedFile.value.size, 'bytes');
    console.log('目标账本ID:', selectedBookId.value);
    
    // 读取文件为ArrayBuffer
    console.log('步骤1: 读取文件为ArrayBuffer...');
    const buffer = await selectedFile.value.arrayBuffer();
    console.log('✓ 文件读取完成，大小:', buffer.byteLength, 'bytes');

    // 将ArrayBuffer转换为Uint8Array以便JSON传输
    const uint8Array = new Uint8Array(buffer);
    console.log('✓ ArrayBuffer转换为Uint8Array完成，长度:', uint8Array.length);

    // 验证数据
    console.log('步骤2: 发送验证请求到服务器...');
    const response = await doApi.post('api/entry/book/validate-import-flows', {
      fileBuffer: Array.from(uint8Array), // 转换为普通数组以便JSON传输
      bookId: selectedBookId.value
    });

    console.log('✓ 验证API响应:', response);
    console.log('响应类型:', typeof response);
    console.log('响应内容:', JSON.stringify(response, null, 2));

    if (response && typeof response === 'object') {
      // 检查响应结构
      if (response.d) {
        // 如果响应有d字段，说明是标准API响应格式
        validationResult.value = response.d;
        parsedData.value = {
          metadata: response.d.metadata,
          sampleData: response.d.sampleData
        };
        console.log('✓ 数据验证完成，使用d字段数据');
      } else if (response.metadata) {
        // 直接返回验证结果
        validationResult.value = response;
        parsedData.value = {
          metadata: response.metadata,
          sampleData: response.sampleData
        };
        console.log('✓ 数据验证完成，使用直接返回数据');
      } else {
        console.error('❌ 响应格式错误，缺少必要字段:', Object.keys(response));
        throw new Error('验证响应格式错误：缺少必要字段');
      }
      
      console.log('验证结果统计:', {
        isValid: validationResult.value.isValid,
        totalRows: validationResult.value.stats?.totalRows,
        validRows: validationResult.value.stats?.validRows,
        invalidRows: validationResult.value.stats?.invalidRows,
        errors: validationResult.value.errors?.length,
        warnings: validationResult.value.warnings?.length
      });
      
      // 不再需要手动提取新账户信息，服务器已经提供了
      console.log('服务器返回的账户信息:', {
        newAccounts: validationResult.value.newAccounts,
        existingAccounts: validationResult.value.existingAccounts
      });
    } else {
      console.error('❌ 响应不是对象类型:', typeof response, response);
      throw new Error('验证响应格式错误');
    }
  } catch (error) {
    console.error('=== 数据验证失败 ===');
    console.error('错误对象:', error);
    console.error('错误类型:', typeof error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    
    // 尝试从错误中提取更详细的信息
    let errorMessage = '数据验证失败';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // 如果是API响应错误
      if (error.message) {
        errorMessage = error.message;
      } else if (error.m) {
        errorMessage = error.m;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.data) {
        errorMessage = error.data.message || error.data.error || '未知错误';
      }
      
      // 添加更多错误详情
      errorDetails = JSON.stringify(error, null, 2);
    }
    
    console.error('最终错误消息:', errorMessage);
    console.error('错误详情:', errorDetails);
    
    // 显示详细的错误信息
    alert(`数据验证失败: ${errorMessage}\n\n详细信息请查看浏览器控制台`);
  } finally {
    parsing.value = false;
    console.log('=== 解析和验证流程结束 ===');
  }
};

// 开始导入
const startImport = async () => {
  if (!selectedFile.value || !selectedBookId.value) return;

  importing.value = true;
  importProgress.value = 0;
  importResult.value = null;

  try {
    // 模拟进度更新
    const progressInterval = setInterval(() => {
      if (importProgress.value < 90) {
        importProgress.value += Math.random() * 10;
      }
    }, 200);

    let requestData: any = {
      bookId: selectedBookId.value,
      autoCreateAccounts: autoCreateAccounts.value
    };

    // 如果有编辑数据，发送编辑数据；否则发送文件
    if (validationResult.value?.allData && editMode.value) {
      requestData.editedData = validationResult.value.allData;
      console.log('使用编辑数据导入，行数:', requestData.editedData.length);
    } else {
      // 读取文件为ArrayBuffer
      const buffer = await selectedFile.value.arrayBuffer();
      
      // 将ArrayBuffer转换为Uint8Array以便JSON传输
      const uint8Array = new Uint8Array(buffer);
      requestData.fileBuffer = Array.from(uint8Array);
      console.log('使用文件数据导入');
    }

    // 执行导入
    const response = await doApi.post('api/entry/book/import-flows', requestData);

    clearInterval(progressInterval);
    importProgress.value = 100;

    if (response && typeof response === 'object') {
      importResult.value = {
        success: true,
        message: `导入成功！共导入 ${response.stats?.successCount || 0} 条流水记录`,
        data: response
      };
      emits('success-callback');
    } else {
      throw new Error('导入响应格式错误');
    }
  } catch (error) {
    console.error('导入失败:', error);
    
    // 尝试从错误中提取更详细的信息
    let errorMessage = '导入失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // 如果是API响应错误
      if (error.message) {
        errorMessage = error.message;
      } else if (error.m) {
        errorMessage = error.m;
      } else if (error.error) {
        errorMessage = error.error;
      }
    }
    
    importResult.value = {
      success: false,
      message: `导入失败: ${errorMessage}`
    };
  } finally {
    importing.value = false;
  }
};

// 关闭对话框
const closeDialog = () => {
  emits('close');
};

// 加载账本列表
const loadBooks = async () => {
  try {
    console.log('开始加载账本列表...');
    const booksData = await doApi.post<any[]>("api/entry/book/list", {});
    
    console.log('加载到的账本:', booksData);
    
    if (Array.isArray(booksData)) {
      books.value = booksData;
      console.log('账本列表已更新:', books.value);
    } else {
      console.error('账本数据格式错误:', booksData);
    }
  } catch (error) {
    console.error('加载账本列表失败:', error);
    // 显示错误提示
    alert('加载账本列表失败，请检查登录状态');
  }
};

// 组件挂载时加载数据
onMounted(() => {
  loadBooks();
});
</script>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar,
.overflow-auto::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track,
.overflow-auto::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-700;
}

.overflow-y-auto::-webkit-scrollbar-thumb,
.overflow-auto::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover,
.overflow-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}
</style>
