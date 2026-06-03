-- Partner warehouse visibility settings
-- Run this in Railway/Supabase SQL editor before deploying backend code.

ALTER TABLE "Partner"
ADD COLUMN IF NOT EXISTS "warehouseVisibilityConfig" JSONB;
