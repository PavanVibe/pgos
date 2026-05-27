import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { ComplaintPriority, ComplaintStatus } from '@prisma/client';
import { EventType } from '../../types/eventTypes';

export class RaiseComplaintWorkflow {
  /**
   * Raises a new complaint, resolving the tenant ID dynamically from room number or fallbacks.
   */
  static async execute(
    pgId: string,
    roomOrArea: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    category?: string,
    actorId = 'system'
  ) {
    // 1. Resolve PGTenantProfile dynamically
    // Clean and check room number
    const cleanRoomName = roomOrArea.replace(/room/gi, '').trim();

    let tenantProfile = await prisma.pGTenantProfile.findFirst({
      where: {
        pgId,
        status: 'ACTIVE',
        bed: { room: { number: { equals: cleanRoomName, mode: 'insensitive' } } }
      }
    });

    // If no active tenant in that room, fall back to search room with partial match
    if (!tenantProfile) {
      tenantProfile = await prisma.pGTenantProfile.findFirst({
        where: {
          pgId,
          status: 'ACTIVE',
          bed: { room: { number: { contains: cleanRoomName, mode: 'insensitive' } } }
        }
      });
    }

    // Secondary fallback: find the first active resident in the entire PG
    if (!tenantProfile) {
      tenantProfile = await prisma.pGTenantProfile.findFirst({
        where: { pgId, status: 'ACTIVE' }
      });
    }

    // Tertiary fallback: if there are no active residents in the PG at all, return an error
    if (!tenantProfile) {
      throw new Error('No active residents found in this PG. A complaint must be filed by or for a resident.');
    }

    // Map priorities to database ComplaintPriority enum
    let dbPriority: ComplaintPriority = ComplaintPriority.LOW;
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'high') dbPriority = ComplaintPriority.HIGH;
    else if (lowerPriority === 'urgent') dbPriority = ComplaintPriority.URGENT;
    // Map medium to low or high depending on preference - let's keep it as low or map to HIGH
    else if (lowerPriority === 'medium') dbPriority = ComplaintPriority.HIGH;

    // SLA is 48 hours from now
    const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 2. Database transaction
    const result = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          pgId,
          pgTenantId: tenantProfile!.id,
          category: category || 'MAINTENANCE',
          description: `[${roomOrArea}] ${description}`,
          priority: dbPriority,
          status: ComplaintStatus.PENDING,
          slaDeadline,
          createdBy: actorId,
          updatedBy: actorId,
        }
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COMPLAINT_RAISED',
          entityType: 'Complaint',
          entityId: complaint.id,
          metadata: { pgId, tenantId: tenantProfile!.id, roomOrArea }
        }
      });

      return complaint;
    });

    // 3. Emit event log
    await emitAndLogEvent(result.id, EventType.COMPLAINT_CREATED, {
      pgId,
      tenantId: tenantProfile.id,
      roomOrArea,
      description
    });

    return result;
  }
}
