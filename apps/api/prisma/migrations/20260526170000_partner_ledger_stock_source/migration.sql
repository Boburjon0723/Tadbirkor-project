-- AlterTable
ALTER TABLE "PartnerLedgerOperation" ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "reversedById" TEXT,
ADD COLUMN "quantity" DECIMAL(15,4),
ADD COLUMN "productSummary" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "partner_ledger_op_stock_source" ON "PartnerLedgerOperation"("companyId", "sourceType", "sourceId", "currency");

-- CreateIndex
CREATE INDEX "PartnerLedgerOperation_companyId_sourceType_sourceId_idx" ON "PartnerLedgerOperation"("companyId", "sourceType", "sourceId");
