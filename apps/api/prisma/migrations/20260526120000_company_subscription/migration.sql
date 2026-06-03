-- Platforma obunasi: sinov / faol / muddati o'tgan
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionNote" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionActivatedAt" TIMESTAMP(3);

UPDATE "Company"
SET "subscriptionStatus" = 'EXPIRED'
WHERE "subscriptionStatus" = 'TRIAL'
  AND "trialEndsAt" < NOW();
