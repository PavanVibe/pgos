-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "residentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
