import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { TenantStatus } from '@prisma/client';
import { EventType } from '../../types/eventTypes';

export class VacateResidentWorkflow {
  /**
   * Safe transaction-wrapped workflow to vacate a resident.
   */
  static async execute(
    pgId: string,
    tenantId: string,
    actorId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.pGTenantProfile.findFirst({
        where: {
          id: tenantId,
          pgId,
          status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE, TenantStatus.INCOMPLETE] }
        }
      });

      if (!profile) {
        throw new Error('Active resident stay profile not found.');
      }

      // Update tenant profile status to PAST
      const updatedProfile = await tx.pGTenantProfile.update({
        where: { id: profile.id },
        data: {
          status: TenantStatus.PAST,
          moveOutDate: new Date(),
          bedId: null, // Free up the bed for future onboarding
          updatedBy: actorId,
        }
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RESIDENT_VACATED',
          entityType: 'PGTenantProfile',
          entityId: profile.id,
          metadata: { pgId, bedId: profile.bedId } // Capture original bedId before nulling
        }
      });

      return { updatedProfile, originalBedId: profile.bedId };
    });

    // Post-Transaction Events - ensure we use the original profile's bedId
    if (result.originalBedId) {
      await emitAndLogEvent(result.updatedProfile.id, EventType.TENANT_MOVED_OUT, { pgId, bedId: result.originalBedId });
      await emitAndLogEvent(result.updatedProfile.id, EventType.BED_VACATED, { pgId, bedId: result.originalBedId });
    }

    return result.updatedProfile;
  }
}
