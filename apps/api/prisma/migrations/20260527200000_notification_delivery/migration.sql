-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "notificationId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "target" TEXT,
    "moduleKey" TEXT,
    "eventKey" TEXT,
    "dedupKey" TEXT,
    "payload" JSONB,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDelivery_companyId_status_idx" ON "NotificationDelivery"("companyId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_dedupKey_idx" ON "NotificationDelivery"("dedupKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextRetryAt_idx" ON "NotificationDelivery"("status", "nextRetryAt");
