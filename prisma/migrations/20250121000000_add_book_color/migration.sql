-- 添加颜色字段，设置默认值
ALTER TABLE "Book" ADD COLUMN "color" VARCHAR(7) DEFAULT '#3B82F6';

-- 为现有数据设置默认颜色（使用预定义颜色轮换）
WITH color_cycle AS (
  SELECT 
    id,
    bookId,
    bookName,
    CASE 
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 0 THEN '#3B82F6'  -- 蓝色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 1 THEN '#EF4444'  -- 红色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 2 THEN '#10B981'  -- 绿色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 3 THEN '#F59E0B'  -- 黄色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 4 THEN '#8B5CF6'  -- 紫色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 5 THEN '#EC4899'  -- 粉色
      WHEN (ROW_NUMBER() OVER (ORDER BY id) - 1) % 8 = 6 THEN '#06B6D4'  -- 青色
      ELSE '#84CC16'  -- 青绿色
    END as assigned_color
  FROM "Book"
)
UPDATE "Book" 
SET "color" = color_cycle.assigned_color
FROM color_cycle
WHERE "Book".id = color_cycle.id;

-- 确保字段不为空
ALTER TABLE "Book" ALTER COLUMN "color" SET NOT NULL;

-- 添加索引优化查询性能
CREATE INDEX idx_book_color ON "Book"("color");
CREATE INDEX idx_book_user_color ON "Book"("userId", "color");
