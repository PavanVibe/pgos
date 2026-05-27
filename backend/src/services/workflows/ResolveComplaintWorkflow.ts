import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { ComplaintStatus } from '@prisma/client';
import { EventType } from '../../types/eventTypes';

export class ResolveComplaintWorkflow {
  /**
   * Resolves a pending complaint.
   */
  static async execute(
    pgId: string,
    complaintId: string,
    actorId: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findUnique({
        where: { id: complaintId }
      });

      if (!complaint) {
        throw new Error('Complaint not found.');
      }

      if (complaint.status === ComplaintStatus.RESOLVED) {
        return complaint; // Idempotent success
      }

      // Update complaint status to RESOLVED
      const updatedComplaint = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          status: ComplaintStatus.RESOLVED,
          updatedBy: actorId,
        }
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COMPLAINT_RESOLVED',
          entityType: 'Complaint',
          entityId: complaintId,
          metadata: { pgId, tenantId: complaint.pgTenantId }
        }
      });

      return updatedComplaint;
    });

    // Emit event log
    await emitAndLogEvent(result.id, EventType.COMPLAINT_RESOLVED, {
      pgId,
      complaintId,
      tenantId: result.pgTenantId
    });

    return result;
  }
}
