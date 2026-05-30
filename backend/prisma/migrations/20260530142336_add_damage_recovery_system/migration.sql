-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "billUrl" TEXT,
ADD COLUMN     "repairCost" DOUBLE PRECISION,
ADD COLUMN     "resolutionNotes" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedImageUrl" TEXT,
ADD COLUMN     "responsibility" TEXT;

-- AlterTable
ALTER TABLE "PGTenantProfile" ADD COLUMN     "settlementStatus" TEXT NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "DamageRecovery" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "complaintId" TEXT,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "attachmentUrls" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recoveryMethod" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "amountReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "referenceNumber" TEXT,
    "collectedDate" TIMESTAMP(3),
    "collectionNotes" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DamageRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageRecoveryItem" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageRecoveryItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DamageRecovery" ADD CONSTRAINT "DamageRecovery_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecovery" ADD CONSTRAINT "DamageRecovery_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecovery" ADD CONSTRAINT "DamageRecovery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PGTenantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecovery" ADD CONSTRAINT "DamageRecovery_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecoveryItem" ADD CONSTRAINT "DamageRecoveryItem_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "DamageRecovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
