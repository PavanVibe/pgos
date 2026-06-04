-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "pgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "interestedRoomId" TEXT,
    "expectedMoveIn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW_LEAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_pgId_idx" ON "Lead"("pgId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "PG"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestedRoomId_fkey" FOREIGN KEY ("interestedRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
