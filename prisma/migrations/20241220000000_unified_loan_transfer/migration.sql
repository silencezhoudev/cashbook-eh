-- 统一借贷和转账数据管理
-- 添加转账类型字段到Transfer表
ALTER TABLE "transfers" ADD COLUMN "transferType" VARCHAR(50) DEFAULT 'transfer';
ALTER TABLE "transfers" ADD COLUMN "loanType" VARCHAR(50);
ALTER TABLE "transfers" ADD COLUMN "counterparty" VARCHAR(255);

-- 更新现有转账记录的类型
UPDATE "transfers" SET "transferType" = 'transfer' WHERE "transferType" IS NULL;

-- 为Flow表添加新的显示字段
ALTER TABLE "flows" ADD COLUMN "displayFlowType" VARCHAR(50);
ALTER TABLE "flows" ADD COLUMN "displayIndustryType" VARCHAR(50);

-- 更新现有流水的显示字段
UPDATE "flows" SET 
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
