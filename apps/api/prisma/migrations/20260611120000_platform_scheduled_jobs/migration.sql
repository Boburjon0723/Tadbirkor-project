-- Platforma admin: rejalashtirilgan xabar va obuna o'zgarishlari
CREATE TABLE "PlatformScheduledJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "PlatformScheduledJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformScheduledJob_status_runAt_idx" ON "PlatformScheduledJob"("status", "runAt");
