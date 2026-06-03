-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "moduleKey" TEXT,
ADD COLUMN "eventKey" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx"
ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_moduleKey_createdAt_idx"
ON "Notification"("userId", "moduleKey", "createdAt" DESC);
