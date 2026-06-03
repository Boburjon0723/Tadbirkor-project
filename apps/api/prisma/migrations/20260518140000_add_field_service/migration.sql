-- Field Service: UserStock, FieldTask, FieldTaskReport, FieldTaskApproval
-- FIELD_SERVICE modul va feature

CREATE TABLE IF NOT EXISTS "UserStock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserStock_userId_productVariantId_sourceWarehouseId_key"
ON "UserStock"("userId", "productVariantId", "sourceWarehouseId");

CREATE INDEX IF NOT EXISTS "UserStock_companyId_idx" ON "UserStock"("companyId");
CREATE INDEX IF NOT EXISTS "UserStock_userId_idx" ON "UserStock"("userId");

ALTER TABLE "UserStock" ADD CONSTRAINT "UserStock_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserStock" ADD CONSTRAINT "UserStock_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserStock" ADD CONSTRAINT "UserStock_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserStock" ADD CONSTRAINT "UserStock_sourceWarehouseId_fkey"
FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FieldTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "plannedItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FieldTask_companyId_status_idx" ON "FieldTask"("companyId", "status");
CREATE INDEX IF NOT EXISTS "FieldTask_assigneeId_status_idx" ON "FieldTask"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "FieldTask_sourceWarehouseId_idx" ON "FieldTask"("sourceWarehouseId");

ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_sourceWarehouseId_fkey"
FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldTask" ADD CONSTRAINT "FieldTask_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FieldTaskReport" (
    "id" TEXT NOT NULL,
    "fieldTaskId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsDistanceM" DOUBLE PRECISION,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldTaskReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FieldTaskReport_fieldTaskId_key" ON "FieldTaskReport"("fieldTaskId");

ALTER TABLE "FieldTaskReport" ADD CONSTRAINT "FieldTaskReport_fieldTaskId_fkey"
FOREIGN KEY ("fieldTaskId") REFERENCES "FieldTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FieldTaskApproval" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fieldTaskId" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WEB',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldTaskApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FieldTaskApproval_fieldTaskId_idx" ON "FieldTaskApproval"("fieldTaskId");
CREATE INDEX IF NOT EXISTS "FieldTaskApproval_reportId_idx" ON "FieldTaskApproval"("reportId");

ALTER TABLE "FieldTaskApproval" ADD CONSTRAINT "FieldTaskApproval_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "FieldTaskReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldTaskApproval" ADD CONSTRAINT "FieldTaskApproval_fieldTaskId_fkey"
FOREIGN KEY ("fieldTaskId") REFERENCES "FieldTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FIELD_SERVICE modul
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'FIELD_SERVICE', 'Dala xodimlari', 'Montaj, kuryer va tashqaridagi ishlar', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'FIELD_SERVICE');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'FIELD_TASKS', 'Dala vazifalari', 'Vazifa, tovar biriktirish va hisobot', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'FIELD_SERVICE'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'FIELD_TASKS');

INSERT INTO "CompanyFeature" ("id", "companyId", "featureId", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", f."id", true, NOW(), NOW()
FROM "Company" c
CROSS JOIN "Feature" f
WHERE f."key" = 'FIELD_TASKS'
  AND NOT EXISTS (
    SELECT 1 FROM "CompanyFeature" cf
    WHERE cf."companyId" = c."id" AND cf."featureId" = f."id"
  );
