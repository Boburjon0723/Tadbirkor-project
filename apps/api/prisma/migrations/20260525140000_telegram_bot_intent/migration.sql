CREATE TABLE IF NOT EXISTS "TelegramBotIntent" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "login" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramBotIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramBotIntent_code_key" ON "TelegramBotIntent"("code");
CREATE INDEX IF NOT EXISTS "TelegramBotIntent_intent_expiresAt_idx" ON "TelegramBotIntent"("intent", "expiresAt");
