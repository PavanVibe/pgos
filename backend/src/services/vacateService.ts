import prisma from '../utils/prisma';
import { emitAndLogEvent, CoreEvents } from '../events/eventBus';
import { TenantStatus } from '@prisma/client';

export const vacateResident = async (
  tenantId: string, 
  pgId: string, 
  actorId: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.pGTenantProfile.findFirst({
      where: { id: tenantId, pgId, status: TenantStatus.ACTIVE }
    });

    if (!profile) {
      throw new Error('Active tenant profile not found.');
    }

    // Update profile
    const updatedProfile = await tx.pGTenantProfile.update({
      where: { id: profile.id },
      data: {
        status: TenantStatus.PAST,
        moveOutDate: new Date(),
        updatedBy: actorId,
      }
    });

    // Create Audit Log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RESIDENT_VACATED',
        entityType: 'PGTenantProfile',
        entityId: profile.id,
      }
    });

    return updatedProfile;
  });

  // Emit event
  await emitAndLogEvent(result.id, CoreEvents.TENANT_MOVED_OUT, { pgId, bedId: result.bedId });

  return result;
};
