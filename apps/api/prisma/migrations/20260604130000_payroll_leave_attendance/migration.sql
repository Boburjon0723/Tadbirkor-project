-- Payroll: dam olish so'rovlari va ish kunlari

CREATE TABLE "PayrollCompanySettings" (
    "companyId" TEXT NOT NULL,
    "workedDaysMode" TEXT NOT NULL DEFAULT 'AUTO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollCompanySettings_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "EmployeeLeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysCount" INT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "EmployeeLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeWorkMonth" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "year" INT NOT NULL,
    "month" INT NOT NULL,
    "totalDays" INT NOT NULL,
    "workedDays" INT NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWorkMonth_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeLeaveRequest_companyId_status_idx" ON "EmployeeLeaveRequest"("companyId", "status");
CREATE INDEX "EmployeeLeaveRequest_companyUserId_status_idx" ON "EmployeeLeaveRequest"("companyUserId", "status");
CREATE INDEX "EmployeeLeaveRequest_companyId_startDate_endDate_idx" ON "EmployeeLeaveRequest"("companyId", "startDate", "endDate");

CREATE UNIQUE INDEX "EmployeeWorkMonth_companyUserId_year_month_key" ON "EmployeeWorkMonth"("companyUserId", "year", "month");
CREATE INDEX "EmployeeWorkMonth_companyId_year_month_idx" ON "EmployeeWorkMonth"("companyId", "year", "month");

ALTER TABLE "PayrollCompanySettings" ADD CONSTRAINT "PayrollCompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeaveRequest" ADD CONSTRAINT "EmployeeLeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLeaveRequest" ADD CONSTRAINT "EmployeeLeaveRequest_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeWorkMonth" ADD CONSTRAINT "EmployeeWorkMonth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeWorkMonth" ADD CONSTRAINT "EmployeeWorkMonth_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
