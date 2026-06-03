ALTER TABLE "PartnerLedgerContact"
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramLinkedAt" TIMESTAMP(3),
ADD COLUMN "telegramLinkStatus" TEXT NOT NULL DEFAULT 'UNLINKED';

CREATE INDEX "PartnerLedgerContact_phone_idx" ON "PartnerLedgerContact"("phone");
CREATE INDEX "PartnerLedgerContact_telegramChatId_idx" ON "PartnerLedgerContact"("telegramChatId");
