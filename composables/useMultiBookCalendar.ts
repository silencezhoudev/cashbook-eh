import { ref, computed } from 'vue';
import { multiBookDaily, updateBookColor, getBooksWithColors } from '~/utils/apis';
import type { Book, BookFlowData, MultiBookCalendarData } from '~/utils/model';

export const useMultiBookCalendar = () => {
  // 状态
  const books = ref<Book[]>([]);
  const selectedBooks = ref<string[]>([]);
  const calendarData = ref<MultiBookCalendarData>({});
  const currentDate = ref(new Date());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const selectedBooksData = computed(() => {
    return books.value.filter(book => 
      selectedBooks.value.includes(book.bookId)
    );
  });

  const hasSelectedBooks = computed(() => {
    return selectedBooks.value.length > 0;
  });

  // 方法
  const fetchBooks = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await getBooksWithColors();
      books.value = response || [];
    } catch (err) {
      error.value = '获取账本列表失败';
      console.error('Failed to fetch books:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchCalendarData = async () => {
    if (!hasSelectedBooks.value) {
      calendarData.value = {};
      return;
    }

    try {
      loading.value = true;
      error.value = null;

      const startDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1);
      const endDate = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0);

      const response = await multiBookDaily(selectedBooks.value, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      calendarData.value = response;
    } catch (err) {
      error.value = '获取日历数据失败';
      console.error('Failed to fetch calendar data:', err);
    } finally {
      loading.value = false;
    }
  };

  const updateBookSelection = (bookIds: string[]) => {
    selectedBooks.value = bookIds;
  };

  const updateBookColor = async (bookId: string, color: string) => {
    try {
      await updateBookColor(bookId, color);
      
      // 更新本地状态
      const book = books.value.find(b => b.bookId === bookId);
      if (book) {
        book.color = color;
      }
      
      // 重新获取日历数据以更新显示
      await fetchCalendarData();
    } catch (err) {
      error.value = '更新颜色失败';
      console.error('Failed to update book color:', err);
    }
  };

  const addBook = (book: Book) => {
    books.value.unshift(book);
  };

  const removeBook = (bookId: string) => {
    books.value = books.value.filter(book => book.bookId !== bookId);
    selectedBooks.value = selectedBooks.value.filter(id => id !== bookId);
  };

  // 初始化
  const init = async () => {
    await fetchBooks();
  };

  return {
    // 状态
    books,
    selectedBooks,
    calendarData,
    currentDate,
    loading,
    error,
    
    // 计算属性
    selectedBooksData,
    hasSelectedBooks,
    
    // 方法
    fetchBooks,
    fetchCalendarData,
    updateBookSelection,
    updateBookColor,
    addBook,
    removeBook,
    init
  };
};
