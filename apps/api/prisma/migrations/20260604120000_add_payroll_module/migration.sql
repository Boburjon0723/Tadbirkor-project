-- Oylik (Payroll) moduli

INSERT INTO "Module" ("id", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'PAYROLL', 'Oylik', 'Xodimlar maoshi hisoblash va tasdiqlash', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Module" WHERE "key" = 'PAYROLL');

INSERT INTO "Feature" ("id", "moduleId", "key", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m.id, 'PAYROLL_MAIN', 'Oylik hisoblash', 'Davr bo''yicha maosh, bonus va tasdiqlash', NOW(), NOW()
FROM "Module" m
WHERE m.key = 'PAYROLL'
  AND NOT EXISTS (SELECT 1 FROM "Feature" WHERE "key" = 'PAYROLL_MAIN');
