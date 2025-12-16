-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" SERIAL NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fromAccountId" INTEGER NOT NULL,
    "toAccountId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "day" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- Ensure FixedFlow table exists before altering it later
CREATE TABLE IF NOT EXISTS "FixedFlow" (
    "id" SERIAL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" TEXT,
    "money" DOUBLE PRECISION,
    "name" TEXT,
    "description" TEXT,
    "flowType" TEXT,
    "industryType" TEXT,
    "payType" TEXT,
    "attribution" TEXT
);

-- AlterTable
ALTER TABLE "Flow" ADD COLUMN "accountId" INTEGER;
ALTER TABLE "Flow" ADD COLUMN "transferId" INTEGER;

-- CreateIndex
CREATE INDEX "accounts_bookId_idx" ON "accounts"("bookId");
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX "transfers_bookId_idx" ON "transfers"("bookId");
CREATE INDEX "transfers_userId_idx" ON "transfers"("userId");
CREATE INDEX "Flow_accountId_idx" ON "Flow"("accountId");
CREATE INDEX "Flow_transferId_idx" ON "Flow"("transferId");
-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transfers" ADD CONSTRAINT "transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Flow" ADD CONSTRAINT "Flow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "FixedFlow" ADD COLUMN "accountId" INTEGER;

-- CreateIndex
CREATE INDEX "FixedFlow_accountId_idx" ON "FixedFlow"("accountId");

-- AddForeignKey
ALTER TABLE "FixedFlow" ADD CONSTRAINT "FixedFlow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
