import prisma from '../utils/prisma';
import { emitAndLogEvent, CoreEvents } from '../events/eventBus';

export const allocateBed = async (
  bedId: string, 
  globalTenantId: string, 
  pgId: string, 
  securityDeposit: number,
  moveInDate: Date,
  actorId: string
) => {
  // Use Prisma transaction to ensure atomicity
  const profile = await prisma.$transaction(async (tx) => {
    // 1. Verify Bed is active and exists
    const bed = await tx.bed.findFirst({
      where: { id: bedId },
      include: { room: true }
    });
    
    if (!bed || bed.room.pgId !== pgId) {
      throw new Error('Bed not found or does not belong to this PG.');
    }

    // 2. Check for existing active allocation on this bed
    const existingAllocation = await tx.pGTenantProfile.findFirst({
      where: { bedId, status: 'ACTIVE' }
    });

    if (existingAllocation) {
      throw new Error('Bed is already occupied.');
    }

    // 3. Create PG Tenant Profile
    const newProfile = await tx.pGTenantProfile.create({
      data: {
        globalTenantId,
        pgId,
        bedId,
        roomId: bed.roomId,
        historicalRoomNumber: bed.room.number,
        historicalBedNumber: bed.bedNumber,
        securityDeposit,
        moveInDate,
        createdBy: actorId,
        updatedBy: actorId,
        status: 'ACTIVE'
      }
    });

    // 4. Create Audit Log inside transaction
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'BED_ALLOCATED',
        entityType: 'PGTenantProfile',
        entityId: newProfile.id,
        metadata: { bedId, globalTenantId, pgId }
      }
    });

    return newProfile;
  });

  // Emit event outside transaction to avoid blocking
  await emitAndLogEvent(profile.id, CoreEvents.BED_ALLOCATED, { pgId, bedId, globalTenantId });

  return profile;
};
