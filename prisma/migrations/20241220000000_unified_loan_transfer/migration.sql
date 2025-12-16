-- 统一借贷和转账数据管理
-- 添加转账类型字段到Transfer表（若表存在）
ALTER TABLE IF EXISTS "transfers" ADD COLUMN IF NOT EXISTS "transferType" VARCHAR(50) DEFAULT 'transfer';
ALTER TABLE IF EXISTS "transfers" ADD COLUMN IF NOT EXISTS "loanType" VARCHAR(50);
ALTER TABLE IF EXISTS "transfers" ADD COLUMN IF NOT EXISTS "counterparty" VARCHAR(255);

-- 更新现有转账记录的类型（若表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') THEN
    UPDATE "transfers" SET "transferType" = 'transfer' WHERE "transferType" IS NULL;
  END IF;
END $$;

-- 为Flow表添加新的借贷字段和显示字段（若表存在）
ALTER TABLE IF EXISTS "Flow" ADD COLUMN IF NOT EXISTS "loanType" VARCHAR(50);
ALTER TABLE IF EXISTS "Flow" ADD COLUMN IF NOT EXISTS "counterparty" VARCHAR(255);
ALTER TABLE IF EXISTS "Flow" ADD COLUMN IF NOT EXISTS "displayFlowType" VARCHAR(50);
ALTER TABLE IF EXISTS "Flow" ADD COLUMN IF NOT EXISTS "displayIndustryType" VARCHAR(50);

-- 更新现有流水的显示字段（若列存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Flow' AND column_name = 'displayFlowType'
  ) THEN
    UPDATE "Flow" SET 
      "displayFlowType" = CASE 
        WHEN "flowType" = '转账' THEN '转账'
        WHEN "flowType" = '借贷' THEN '借贷'
        ELSE "flowType"
      END,
      "displayIndustryType" = CASE 
        WHEN "loanType" = '借入' THEN '借入'
        WHEN "loanType" = '借出' THEN '借出'
        WHEN "loanType" = '收款' THEN '收款'
        WHEN "loanType" = '还款' THEN '还款'
        WHEN "flowType" = '转账' THEN '转账'
        ELSE "industryType"
      END
    WHERE "displayFlowType" IS NULL;
  END IF;
END $$;
