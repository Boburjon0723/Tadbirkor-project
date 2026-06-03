-- POS / kassa moduli (do‘kon rejimi; ishlab chiqarish uchun o‘chirilishi mumkin)

INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'POS', 'POS / Kassa', 'Chakana sotuv va kassa interfeysi', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'POS');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'POS_TERMINAL', 'POS interfeysi', 'Sotuvchi uchun kassa ekrani', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'POS'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'POS_TERMINAL');

-- Mavjud kompaniyalar uchun sukut: POS yoqilgan (oldingi xatti-harakat saqlansin)
INSERT INTO "CompanyFeature" ("id", "companyId", "featureId", "enabled", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", f."id", true, NOW(), NOW()
FROM "Company" c
CROSS JOIN "Feature" f
WHERE f."key" = 'POS_TERMINAL'
  AND NOT EXISTS (
    SELECT 1 FROM "CompanyFeature" cf
    WHERE cf."companyId" = c."id" AND cf."featureId" = f."id"
  );
