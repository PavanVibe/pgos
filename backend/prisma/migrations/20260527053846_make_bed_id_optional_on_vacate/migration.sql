-- DropForeignKey
ALTER TABLE "PGTenantProfile" DROP CONSTRAINT "PGTenantProfile_bedId_fkey";

-- AlterTable
ALTER TABLE "PGTenantProfile" ALTER COLUMN "bedId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PGTenantProfile_bedId_status_idx" ON "PGTenantProfile"("bedId", "status");

-- AddForeignKey
ALTER TABLE "PGTenantProfile" ADD CONSTRAINT "PGTenantProfile_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
