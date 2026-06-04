-- Kirimlar moduli

CREATE TABLE IF NOT EXISTS "IncomeCategory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Income" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amount" DECIMAL(15, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "incomeDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IncomeCategory_companyId_name_key"
  ON "IncomeCategory"("companyId", "name");

CREATE INDEX IF NOT EXISTS "IncomeCategory_companyId_isActive_idx"
  ON "IncomeCategory"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "Income_companyId_incomeDate_idx"
  ON "Income"("companyId", "incomeDate");

CREATE INDEX IF NOT EXISTS "Income_categoryId_idx"
  ON "Income"("categoryId");

CREATE INDEX IF NOT EXISTS "Income_createdById_idx"
  ON "Income"("createdById");

ALTER TABLE "IncomeCategory"
  ADD CONSTRAINT "IncomeCategory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Income"
  ADD CONSTRAINT "Income_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Income"
  ADD CONSTRAINT "Income_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "IncomeCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Income"
  ADD CONSTRAINT "Income_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'INCOME', 'Kirimlar', 'Savdo, qarz qaytimi va boshqa tushumlar', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'INCOME');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'INCOME_MAIN', 'Kirimlar', 'Savdo, qarz qaytimi va boshqa tushumlar', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'INCOME'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'INCOME_MAIN');

-- Mavjud kompaniyalar uchun sukut: kirimlar moduli yoqilgan
INSERT INTO "CompanyFeature" ("id", "companyId", "featureId", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", f."id", true, NOW(), NOW()
FROM "Company" c
CROSS JOIN "Feature" f
WHERE f."key" = 'INCOME_MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM "CompanyFeature" cf
    WHERE cf."companyId" = c."id" AND cf."featureId" = f."id"
  );
