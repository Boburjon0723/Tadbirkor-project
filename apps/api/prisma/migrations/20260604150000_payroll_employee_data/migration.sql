-- EmployeePayrollProfile kengaytirish
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "leftAt" DATE;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "EmployeeCompensation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeRole" TEXT NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "effectiveFrom" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompensation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeCompensation_companyId_companyUserId_isActive_idx" ON "EmployeeCompensation"("companyId", "companyUserId", "isActive");

ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "EmployeePayrollAdvance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "advanceDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePayrollAdvance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeePayrollAdvance_companyUserId_year_month_idx" ON "EmployeePayrollAdvance"("companyUserId", "year", "month");

ALTER TABLE "EmployeePayrollAdvance" ADD CONSTRAINT "EmployeePayrollAdvance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePayrollAdvance" ADD CONSTRAINT "EmployeePayrollAdvance_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "EmployeePayrollSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "workedDays" INTEGER NOT NULL,
    "bonus" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "penalties" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paymentConfirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePayrollSettlement_companyUserId_year_month_key" ON "EmployeePayrollSettlement"("companyUserId", "year", "month");
CREATE INDEX IF NOT EXISTS "EmployeePayrollSettlement_companyId_year_month_idx" ON "EmployeePayrollSettlement"("companyId", "year", "month");

ALTER TABLE "EmployeePayrollSettlement" ADD CONSTRAINT "EmployeePayrollSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePayrollSettlement" ADD CONSTRAINT "EmployeePayrollSettlement_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
