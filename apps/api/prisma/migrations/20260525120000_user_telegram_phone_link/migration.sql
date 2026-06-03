-- User ↔ Telegram: telefon orqali avtomatik tanish
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramChatId_key"
  ON "User"("telegramChatId")
  WHERE "telegramChatId" IS NOT NULL;
