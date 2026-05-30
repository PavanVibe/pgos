-- AlterTable
ALTER TABLE "PGTenantProfile" ADD COLUMN     "depositCollectedAt" TIMESTAMP(3),
ADD COLUMN     "depositRefundMode" TEXT,
ADD COLUMN     "depositRefundedAmount" DOUBLE PRECISION,
ADD COLUMN     "depositRefundedAt" TIMESTAMP(3),
ADD COLUMN     "securityDepositStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "RentInvoice" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'RENT';
