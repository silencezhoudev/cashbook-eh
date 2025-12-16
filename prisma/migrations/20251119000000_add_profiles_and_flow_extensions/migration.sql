-- 增量迁移：账本画像、规则引擎以及流水扩展字段

-- ============================================
-- 1. 扩展 Flow 表（借贷信息 & 显示字段）
-- ============================================
ALTER TABLE "Flow"
  ADD COLUMN IF NOT EXISTS "loanType" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "counterparty" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "relatedFlowId" INTEGER,
  ADD COLUMN IF NOT EXISTS "relatedAccountId" INTEGER,
  ADD COLUMN IF NOT EXISTS "displayFlowType" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "displayIndustryType" VARCHAR(50);

-- 为新列创建索引
CREATE INDEX IF NOT EXISTS "Flow_relatedFlowId_idx" ON "Flow"("relatedFlowId");
CREATE INDEX IF NOT EXISTS "Flow_relatedAccountId_idx" ON "Flow"("relatedAccountId");

-- 添加外键（如已存在则忽略）
DO $$ BEGIN
  ALTER TABLE "Flow" ADD CONSTRAINT "Flow_relatedFlowId_fkey" FOREIGN KEY ("relatedFlowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Flow" ADD CONSTRAINT "Flow_relatedAccountId_fkey" FOREIGN KEY ("relatedAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. 扩展 transfers 表（借贷信息）
-- ============================================
ALTER TABLE "transfers"
  ADD COLUMN IF NOT EXISTS "transferType" VARCHAR(50) DEFAULT 'transfer',
  ADD COLUMN IF NOT EXISTS "loanType" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "counterparty" VARCHAR(255);

UPDATE "transfers" SET "transferType" = 'transfer' WHERE "transferType" IS NULL;

-- ============================================
-- 3. 扩展 FixedFlow 与 accounts 表结构
-- ============================================
ALTER TABLE "FixedFlow"
  ADD COLUMN IF NOT EXISTS "accountId" INTEGER;

CREATE INDEX IF NOT EXISTS "FixedFlow_accountId_idx" ON "FixedFlow"("accountId");

DO $$ BEGIN
  ALTER TABLE "FixedFlow" ADD CONSTRAINT "FixedFlow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "includeInTotal" BOOLEAN NOT NULL DEFAULT true;

-- 旧字段 isActive 若仍存在则删除
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "isActive";

-- 重新创建唯一索引（同一用户下账户名唯一）
DROP INDEX IF EXISTS "accounts_userId_name_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_userId_name_unique" ON "accounts"("userId", "name");

-- ============================================
-- 4. 创建 FlowMatchingRule 表
-- ============================================
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

-- ============================================
-- 5. 创建 BookProfile 表
-- ============================================
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


