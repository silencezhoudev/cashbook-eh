import { ref, computed, watch } from 'vue'
import { getBooksWithColors } from '~/utils/apis'
import type { Book } from '~/utils/model'

export enum BookMode {
  SINGLE = 'single',
  MULTI = 'multi'
}

export interface BookState {
  mode: BookMode
  currentBookId: string
  selectedBookIds: string[]
  books: Book[]
  loading: boolean
  error: string | null
}

const globalBookState = ref<BookState>({
  mode: BookMode.SINGLE,
  currentBookId: '',
  selectedBookIds: [],
  books: [],
  loading: false,
  error: null
})

export const useBookState = () => {
  // 初始化当前账本ID
  const initCurrentBookId = () => {
    if (typeof window !== 'undefined') {
      const storedBookId = localStorage.getItem('bookId')
      if (storedBookId) {
        globalBookState.value.currentBookId = storedBookId
        // 单账本模式下，selectedBookIds 包含当前账本
        if (globalBookState.value.mode === BookMode.SINGLE) {
          globalBookState.value.selectedBookIds = [storedBookId]
        }
      }
    }
  }

  // 获取账本列表
  const fetchBooks = async () => {
    try {
      globalBookState.value.loading = true
      globalBookState.value.error = null
      
      const books = await getBooksWithColors()
      globalBookState.value.books = books || []
      
      // 确保当前账本在列表中
      const currentBook = globalBookState.value.books.find(
        book => book.bookId === globalBookState.value.currentBookId
      )
      if (!currentBook && globalBookState.value.books.length > 0) {
        // 如果当前账本不存在，选择第一个
        globalBookState.value.currentBookId = globalBookState.value.books[0].bookId
        localStorage.setItem('bookId', globalBookState.value.currentBookId)
      }
    } catch (error) {
      globalBookState.value.error = '获取账本列表失败'
      console.error('Failed to fetch books:', error)
    } finally {
      globalBookState.value.loading = false
    }
  }

  // 切换模式
  const switchMode = (mode: BookMode) => {
    globalBookState.value.mode = mode
    
    if (mode === BookMode.SINGLE) {
      // 切换到单账本模式，只保留当前账本
      globalBookState.value.selectedBookIds = [globalBookState.value.currentBookId]
    } else {
      // 切换到多账本模式，保持当前选择
      if (globalBookState.value.selectedBookIds.length === 0) {
        globalBookState.value.selectedBookIds = [globalBookState.value.currentBookId]
      }
    }
  }

  // 更新当前账本（兼容现有逻辑）
  const updateCurrentBook = (bookId: string, bookName: string) => {
    globalBookState.value.currentBookId = bookId
    globalBookState.value.selectedBookIds = [bookId]
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookId', bookId)
      localStorage.setItem('bookName', bookName)
    }
  }

  // 更新多账本选择
  const updateSelectedBooks = (bookIds: string[]) => {
    globalBookState.value.selectedBookIds = bookIds
    
    // 如果多账本模式下只选择了一个账本，更新当前账本
    if (bookIds.length === 1) {
      globalBookState.value.currentBookId = bookIds[0]
    }
  }

  // 兼容性方法：获取有效的账本ID（用于现有API调用）
  const getEffectiveBookId = computed(() => {
    return globalBookState.value.currentBookId || 
           (typeof window !== 'undefined' ? localStorage.getItem('bookId') : '') || 
           ''
  })

  // 获取所有选中的账本ID
  const getAllSelectedBookIds = computed(() => {
    if (globalBookState.value.mode === BookMode.SINGLE) {
      return [getEffectiveBookId.value].filter(Boolean)
    }
    return globalBookState.value.selectedBookIds
  })

  // 监听模式变化，自动调整选择
  watch(() => globalBookState.value.mode, (newMode) => {
    if (newMode === BookMode.SINGLE) {
      globalBookState.value.selectedBookIds = [globalBookState.value.currentBookId]
    }
  })

  // 初始化
  const init = async () => {
    initCurrentBookId()
    await fetchBooks()
  }

  return {
    // 状态
    bookState: globalBookState,
    
    // 计算属性
    getEffectiveBookId,
    getAllSelectedBookIds,
    
    // 方法
    init,
    fetchBooks,
    switchMode,
    updateCurrentBook,
    updateSelectedBooks
  }
}
