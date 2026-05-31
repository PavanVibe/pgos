/*
  Warnings:

  - The `role` column on the `Staff` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Expense';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "monthlySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pgId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'CARETAKER';

-- CreateTable
CREATE TABLE "StaffSalaryPayment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salaryMonth" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningChecklist" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "roomsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "bathroomsCompleted" BOOLEAN NOT NULL DEFAULT false,
    "commonAreasCompleted" BOOLEAN NOT NULL DEFAULT false,
    "kitchenCompleted" BOOLEAN NOT NULL DEFAULT false,
    "waterTankCompleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBusinessSnapshot" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "occupancyPercent" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "expenses" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "rentCollected" DOUBLE PRECISION NOT NULL,
    "damageRecoveries" DOUBLE PRECISION NOT NULL,
    "depositsCollected" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBusinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffSalaryPayment_staffId_idx" ON "StaffSalaryPayment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningChecklist_pgId_key" ON "CleaningChecklist"("pgId");

-- CreateIndex
CREATE INDEX "MonthlyBusinessSnapshot_pgId_idx" ON "MonthlyBusinessSnapshot"("pgId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBusinessSnapshot_pgId_month_year_key" ON "MonthlyBusinessSnapshot"("pgId", "month", "year");

-- CreateIndex
CREATE INDEX "Staff_pgId_idx" ON "Staff"("pgId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PG"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryPayment" ADD CONSTRAINT "StaffSalaryPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningChecklist" ADD CONSTRAINT "CleaningChecklist_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBusinessSnapshot" ADD CONSTRAINT "MonthlyBusinessSnapshot_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PG"("id") ON DELETE CASCADE ON UPDATE CASCADE;
