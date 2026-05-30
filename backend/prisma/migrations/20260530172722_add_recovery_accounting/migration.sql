-- AlterTable
ALTER TABLE "DamageRecovery" ADD COLUMN     "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DepositLedgerTransaction" (
    "id" TEXT NOT NULL,
    "tenantProfileId" TEXT NOT NULL,
    "recoveryId" TEXT,
    "complaintId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DepositLedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryTransaction" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RecoveryTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DepositLedgerTransaction" ADD CONSTRAINT "DepositLedgerTransaction_tenantProfileId_fkey" FOREIGN KEY ("tenantProfileId") REFERENCES "PGTenantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerTransaction" ADD CONSTRAINT "DepositLedgerTransaction_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "DamageRecovery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedgerTransaction" ADD CONSTRAINT "DepositLedgerTransaction_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryTransaction" ADD CONSTRAINT "RecoveryTransaction_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "DamageRecovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
