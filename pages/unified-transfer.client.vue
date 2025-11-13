<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            统一转账管理
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            统一管理借贷和转账记录，支持统一的余额计算和显示
          </p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div class="flex flex-wrap gap-4">
            <button
              @click="showTransferDialog = true"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              新增转账/借贷
            </button>

            <button
              @click="loadTransferList"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              刷新列表
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">转账记录列表</h3>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">转账类型</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">借贷类型</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">金额</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">转出账户</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">转入账户</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">借贷对象</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">日期</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="transfer in transferList" :key="transfer.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ transfer.id }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <span :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      transfer.transferType === 'loan' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    ]">
                      {{ transfer.transferType === 'loan' ? '借贷' : '转账' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {{ transfer.loanType || '-' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">¥{{ formatMoney(transfer.amount) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ transfer.fromAccount.name }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ transfer.toAccount.name }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ transfer.counterparty || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{{ transfer.day }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <button
                      @click="deleteTransfer(transfer.id)"
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="pagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div class="text-sm text-gray-700 dark:text-gray-300">
                共 {{ pagination.total }} 条记录，第 {{ pagination.pageNum }} / {{ pagination.totalPages }} 页
              </div>
              <div class="flex space-x-2">
                <button
                  @click="changePage(pagination.pageNum - 1)"
                  :disabled="pagination.pageNum <= 1"
                  class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  @click="changePage(pagination.pageNum + 1)"
                  :disabled="pagination.pageNum >= pagination.totalPages"
                  class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UnifiedTransferDialog
      :show-dialog="showTransferDialog"
      :accounts="accounts"
      :success-callback="onTransferSuccess"
      @close="showTransferDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import UnifiedTransferDialog from '~/components/dialog/UnifiedTransferDialog.vue'

const showTransferDialog = ref(false)
const transferList = ref([])
const accounts = ref([])
const pagination = ref({
  pageNum: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

const formatMoney = (amount) => {
  return (amount || 0).toLocaleString()
}

const loadTransferList = async () => {
  try {
    const response = await $fetch('/api/entry/unified-transfer/list', {
      method: 'POST',
      body: {
        bookId: localStorage.getItem('bookId'),
        pageNum: pagination.value.pageNum,
        pageSize: pagination.value.pageSize
      }
    })
    
    if (response.c === 200) {
      transferList.value = response.d.data
      pagination.value = {
        pageNum: response.d.pageNum,
        pageSize: response.d.pageSize,
        total: response.d.total,
        totalPages: response.d.totalPages
      }
    } else {
      console.error('获取转账列表失败:', response.m)
    }
  } catch (error) {
    console.error('获取转账列表失败:', error)
  }
}

const loadAccounts = async () => {
  try {
    const response = await $fetch('/api/entry/account/list', {
      method: 'POST',
      body: {
        bookId: localStorage.getItem('bookId')
      }
    })
    
    if (response.c === 200) {
      accounts.value = response.d.data
    }
  } catch (error) {
    console.error('获取账户列表失败:', error)
  }
}

const deleteTransfer = async (transferId) => {
  if (!confirm('确定要删除这条转账记录吗？')) {
    return
  }

  try {
    const response = await $fetch('/api/entry/unified-transfer/del', {
      method: 'POST',
      body: {
        id: transferId
      }
    })
    
    if (response.c === 200) {
      alert('删除成功')
      loadTransferList()
    } else {
      alert('删除失败: ' + response.m)
    }
  } catch (error) {
    console.error('删除转账记录失败:', error)
    alert('删除失败')
  }
}

const changePage = (pageNum) => {
  if (pageNum >= 1 && pageNum <= pagination.value.totalPages) {
    pagination.value.pageNum = pageNum
    loadTransferList()
  }
}

const onTransferSuccess = () => {
  loadTransferList()
}

onMounted(() => {
  loadAccounts()
  loadTransferList()
})
</script>
