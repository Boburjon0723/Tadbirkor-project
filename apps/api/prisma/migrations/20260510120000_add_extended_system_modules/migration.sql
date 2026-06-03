-- Yangi tizim modullari (EMPLOYEES, STOREFRONT, EXPENSES, REPORTS, INTEGRATIONS)
-- Har bir modulda kamida bitta Feature bo‘lishi kerak (updateFeatureConfig talabi).

-- Xodimlar
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EMPLOYEES', 'Xodimlar', 'Jamoa va rollar boshqaruvi', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'EMPLOYEES');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'TEAM_MANAGEMENT', 'Jamoa boshqaruvi', 'Xodimlar, rollar va kirish huquqlari', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'EMPLOYEES'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'TEAM_MANAGEMENT');

-- Onlayn do'kon / sayt integratsiyasi
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'STOREFRONT', 'Onlayn do''kon', 'Veb-sayt va vitrina bilan sinxron', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'STOREFRONT');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'STOREFRONT_SYNC', 'Vitrina sinxroni', 'Mahsulot va buyurtmalar ulanishi', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'STOREFRONT'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'STOREFRONT_SYNC');

-- Ichki xarajatlar
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'EXPENSES', 'Ichki xarajatlar', 'Ofis, transport va boshqa chiqimlar', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'EXPENSES');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'EXPENSE_TRACKING', 'Xarajat yozuvlari', 'Kategoriyalar va tasdiqlash oqimi', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'EXPENSES'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'EXPENSE_TRACKING');

-- Hisobotlar
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'REPORTS', 'Hisobotlar', 'Yig''ma ko''rinishlar va eksport', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'REPORTS');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'REPORTS_EXPORT', 'Hisobot va eksport', 'Excel/PDF va filtrlash', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'REPORTS'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'REPORTS_EXPORT');

-- Tashqi ulanishlar (Telegram, webhook va hokazo)
INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'INTEGRATIONS', 'Ulanishlar', 'Telegram, API va tashqi tizimlar', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'INTEGRATIONS');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'EXTERNAL_CONNECTIONS', 'Tashqi integratsiyalar', 'Webhook va bildirishnomalar', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'INTEGRATIONS'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'EXTERNAL_CONNECTIONS');

-- Mavjud barcha kompaniyalar uchun Xodimlar modulini (jamoa) sukut bo‘yicha yoqish
INSERT INTO "CompanyFeature" ("id", "companyId", "featureId", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", f."id", true, NOW(), NOW()
FROM "Company" c
CROSS JOIN "Feature" f
WHERE f."key" = 'TEAM_MANAGEMENT'
  AND NOT EXISTS (
    SELECT 1 FROM "CompanyFeature" cf
    WHERE cf."companyId" = c."id" AND cf."featureId" = f."id"
  );
