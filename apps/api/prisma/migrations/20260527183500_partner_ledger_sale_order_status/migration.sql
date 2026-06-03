CREATE TABLE IF NOT EXISTS "PartnerLedgerSaleOrderStatus" (
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "comment" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerLedgerSaleOrderStatus_pkey" PRIMARY KEY ("companyId","batchId"),
  CONSTRAINT "PartnerLedgerSaleOrderStatus_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerLedgerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PartnerLedgerSaleOrderStatus_companyId_contactId_updatedAt_idx"
ON "PartnerLedgerSaleOrderStatus"("companyId","contactId","updatedAt");

CREATE INDEX IF NOT EXISTS "PartnerLedgerSaleOrderStatus_status_idx"
ON "PartnerLedgerSaleOrderStatus"("status");
