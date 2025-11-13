-- 移除账户和转账表中的 bookId 字段，实现账户与账本解耦

-- 1. 移除 accounts 表的 bookId 字段
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bookId";

-- 2. 移除 transfers 表的 bookId 字段  
ALTER TABLE "transfers" DROP COLUMN IF EXISTS "bookId";

-- 3. 移除相关索引
DROP INDEX IF EXISTS "accounts_bookId_idx";
DROP INDEX IF EXISTS "transfers_bookId_idx";

-- 4. 添加新的索引（基于 userId）
CREATE INDEX IF NOT EXISTS "accounts_userId_name_idx" ON "accounts"("userId", "name");
CREATE INDEX IF NOT EXISTS "transfers_userId_day_idx" ON "transfers"("userId", "day");

-- 5. 添加账户名称唯一约束（同一用户下账户名称唯一）
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_userId_name_unique" ON "accounts"("userId", "name") WHERE "isActive" = true;
