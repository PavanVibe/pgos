/*
  Warnings:

  - Added the required column `roomId` to the `PGTenantProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PGTenantProfile" ADD COLUMN     "historicalBedNumber" TEXT,
ADD COLUMN     "historicalRoomNumber" TEXT,
ADD COLUMN     "roomId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PGTenantProfile_roomId_idx" ON "PGTenantProfile"("roomId");

-- AddForeignKey
ALTER TABLE "PGTenantProfile" ADD CONSTRAINT "PGTenantProfile_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
