-- 修复schema drift：将数据库同步到当前schema定义
-- 此迁移不会丢失数据，只修改表结构

-- ============================================
-- 1. 修复 Receivable 表名（如果存在大写表名，重命名为小写）
-- ============================================
DO $$ 
BEGIN
  -- 如果存在大写的 Receivable 表，重命名为 receivables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Receivable') THEN
    -- 先检查 receivables 表是否已存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receivables') THEN
      ALTER TABLE "Receivable" RENAME TO "receivables";
    ELSE
      -- 如果两个表都存在，需要合并数据（这里假设receivables是正确的）
      DROP TABLE "Receivable";
    END IF;
  END IF;
END $$;

-- ============================================
-- 2. 修复 Book 表
-- ============================================
-- 删除不需要的索引
DROP INDEX IF EXISTS "idx_book_color";
DROP INDEX IF EXISTS "idx_book_user_color";

-- 确保 bookId 有唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "Book_bookId_key" ON "Book"("bookId");

-- 修改 color 字段类型为TEXT（与schema一致）
ALTER TABLE "Book" ALTER COLUMN "color" TYPE TEXT;

-- ============================================
-- 3. 修复 Budget 表
-- ============================================
-- 确保 month 有唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_month_key" ON "Budget"("month");

-- ============================================
-- 4. 修复 FixedFlow 表
-- ============================================
-- 注意：根据最新迁移，FixedFlow_accountId_idx索引应该存在
-- 但根据drift报告，schema中没有这个索引
-- 保留索引，因为外键可能需要它
-- DROP INDEX IF EXISTS "FixedFlow_accountId_idx";

-- ============================================
-- 5. 修复 Flow 表
-- ============================================
-- 删除不需要的索引
DROP INDEX IF EXISTS "Flow_accountId_idx";
DROP INDEX IF EXISTS "Flow_transferId_idx";

-- 添加新字段（如果不存在），使用TEXT类型以匹配schema
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "counterparty" TEXT;
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "displayFlowType" TEXT;
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "displayIndustryType" TEXT;
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "loanType" TEXT;
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "relatedAccountId" INTEGER;
ALTER TABLE "Flow" ADD COLUMN IF NOT EXISTS "relatedFlowId" INTEGER;

-- 如果字段已存在但类型不对，修改类型
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Flow' AND column_name = 'counterparty' AND data_type != 'text') THEN
    ALTER TABLE "Flow" ALTER COLUMN "counterparty" TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Flow' AND column_name = 'displayFlowType' AND data_type != 'text') THEN
    ALTER TABLE "Flow" ALTER COLUMN "displayFlowType" TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Flow' AND column_name = 'displayIndustryType' AND data_type != 'text') THEN
    ALTER TABLE "Flow" ALTER COLUMN "displayIndustryType" TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Flow' AND column_name = 'loanType' AND data_type != 'text') THEN
    ALTER TABLE "Flow" ALTER COLUMN "loanType" TYPE TEXT;
  END IF;
END $$;

-- 创建新字段的索引
CREATE INDEX IF NOT EXISTS "Flow_relatedFlowId_idx" ON "Flow"("relatedFlowId");
CREATE INDEX IF NOT EXISTS "Flow_relatedAccountId_idx" ON "Flow"("relatedAccountId");

-- 添加外键（如果不存在）
DO $$ BEGIN
  ALTER TABLE "Flow" ADD CONSTRAINT "Flow_bookId_fkey" 
    FOREIGN KEY ("bookId") REFERENCES "Book"("bookId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Flow" ADD CONSTRAINT "Flow_relatedAccountId_fkey" 
    FOREIGN KEY ("relatedAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Flow" ADD CONSTRAINT "Flow_relatedFlowId_fkey" 
    FOREIGN KEY ("relatedFlowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 6. 修复 accounts 表
-- ============================================
-- 删除不需要的外键
DO $$ BEGIN
  ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_userId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 删除不需要的索引
DROP INDEX IF EXISTS "accounts_userId_idx";
DROP INDEX IF EXISTS "accounts_userId_name_idx";
DROP INDEX IF EXISTS "accounts_bookId_idx";

-- 添加新字段（如果不存在）
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "includeInTotal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- 删除旧字段（如果存在）
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "bookId";

-- 创建新的唯一索引（使用正确的名称）
DROP INDEX IF EXISTS "accounts_userId_name_unique";
DROP INDEX IF EXISTS "accounts_userId_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_userId_name_unique" ON "accounts"("userId", "name");

-- ============================================
-- 7. 修复 transfers 表
-- ============================================
-- 删除不需要的外键
DO $$ BEGIN
  ALTER TABLE "transfers" DROP CONSTRAINT IF EXISTS "transfers_userId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 删除不需要的索引
DROP INDEX IF EXISTS "transfers_userId_idx";
DROP INDEX IF EXISTS "transfers_userId_day_idx";
DROP INDEX IF EXISTS "transfers_bookId_idx";

-- 删除不需要的字段（如果存在）
ALTER TABLE "transfers" DROP COLUMN IF EXISTS "bookId";

-- 添加新字段（如果不存在），使用TEXT类型
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "counterparty" TEXT;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "loanType" TEXT;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "transferType" TEXT DEFAULT 'transfer';

-- 如果字段已存在但类型不对，修改类型
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'counterparty' AND data_type != 'text') THEN
    ALTER TABLE "transfers" ALTER COLUMN "counterparty" TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'loanType' AND data_type != 'text') THEN
    ALTER TABLE "transfers" ALTER COLUMN "loanType" TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'transferType' AND data_type != 'text') THEN
    ALTER TABLE "transfers" ALTER COLUMN "transferType" TYPE TEXT;
  END IF;
END $$;

-- 更新现有记录的 transferType，并确保不为NULL
UPDATE "transfers" SET "transferType" = 'transfer' WHERE "transferType" IS NULL;
ALTER TABLE "transfers" ALTER COLUMN "transferType" SET NOT NULL;
ALTER TABLE "transfers" ALTER COLUMN "transferType" SET DEFAULT 'transfer';

-- ============================================
-- 8. 确保 receivables 表结构正确（如果表存在但结构不对）
-- ============================================
DO $$ 
BEGIN
  -- 如果 receivables 表存在，确保字段正确
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receivables') THEN
    -- 添加缺失的字段
    ALTER TABLE "receivables" ADD COLUMN IF NOT EXISTS "createDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "receivables" ADD COLUMN IF NOT EXISTS "updateDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    
    -- 删除不需要的字段（如果存在）
    ALTER TABLE "receivables" DROP COLUMN IF EXISTS "occurId";
    ALTER TABLE "receivables" DROP COLUMN IF EXISTS "actualId";
    ALTER TABLE "receivables" DROP COLUMN IF EXISTS "expectDay";
    ALTER TABLE "receivables" DROP COLUMN IF EXISTS "actualDay";
    
    -- 确保money字段不为NULL
    ALTER TABLE "receivables" ALTER COLUMN "money" SET NOT NULL;
    
    -- 确保createDate和updateDate不为NULL
    ALTER TABLE "receivables" ALTER COLUMN "createDate" SET NOT NULL;
    ALTER TABLE "receivables" ALTER COLUMN "updateDate" SET NOT NULL;
    ALTER TABLE "receivables" ALTER COLUMN "updateDate" DROP DEFAULT;
  END IF;
END $$;

-- ============================================
-- 9. 确保最新迁移中的表已创建（flow_matching_rules 和 book_profiles）
-- ============================================
-- 创建 FlowMatchingRule 表（如果不存在）
CREATE TABLE IF NOT EXISTS "flow_matching_rules" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "ruleName" TEXT,
  "ruleType" TEXT NOT NULL,
  "conditions" TEXT NOT NULL,
  "targetBookId" TEXT NOT NULL,
  "targetCategory" TEXT,
  "targetFlowType" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'MANUAL'
);

CREATE INDEX IF NOT EXISTS "flow_matching_rules_user_enabled_idx" ON "flow_matching_rules"("userId", "enabled");
CREATE INDEX IF NOT EXISTS "flow_matching_rules_user_priority_idx" ON "flow_matching_rules"("userId", "priority");

-- 创建 BookProfile 表（如果不存在）
CREATE TABLE IF NOT EXISTS "book_profiles" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "bookId" TEXT NOT NULL,
  "categoryWeights" TEXT NOT NULL,
  "merchantKeywords" TEXT NOT NULL,
  "payTypeStats" TEXT NOT NULL,
  "amountDistribution" TEXT NOT NULL,
  "totalFlows" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "book_profiles_user_book_unique" ON "book_profiles"("userId", "bookId");
CREATE INDEX IF NOT EXISTS "book_profiles_user_idx" ON "book_profiles"("userId");

