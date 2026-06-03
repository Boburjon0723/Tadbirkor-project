-- Hamkor daftari (tizimda bo'lmagan hamkorlar uchun qo'lda hisob)

CREATE TABLE "PartnerLedgerContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "tag" TEXT,
    "notes" TEXT,
    "linkedPartnerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerLedgerContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerLedgerOperation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "operationDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerLedgerOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerLedgerContact_companyId_isActive_idx" ON "PartnerLedgerContact"("companyId", "isActive");
CREATE INDEX "PartnerLedgerContact_companyId_name_idx" ON "PartnerLedgerContact"("companyId", "name");

CREATE INDEX "PartnerLedgerOperation_companyId_contactId_idx" ON "PartnerLedgerOperation"("companyId", "contactId");
CREATE INDEX "PartnerLedgerOperation_contactId_operationDate_idx" ON "PartnerLedgerOperation"("contactId", "operationDate");
CREATE INDEX "PartnerLedgerOperation_companyId_operationDate_idx" ON "PartnerLedgerOperation"("companyId", "operationDate");

ALTER TABLE "PartnerLedgerContact" ADD CONSTRAINT "PartnerLedgerContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerLedgerOperation" ADD CONSTRAINT "PartnerLedgerOperation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerLedgerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerLedgerOperation" ADD CONSTRAINT "PartnerLedgerOperation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'PARTNER_LEDGER', 'Hamkor daftari', 'Tizimda bo''lmagan hamkorlar uchun qo''lda hisob-kitob', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'PARTNER_LEDGER');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'PARTNER_LEDGER_TRACKING', 'Hamkor hisobi', 'Kirim, sotuv, tushum va to''lovlar', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'PARTNER_LEDGER'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'PARTNER_LEDGER_TRACKING');
