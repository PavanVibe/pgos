import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { ComplaintStatus, TenantStatus } from '@prisma/client';
import { EventType } from '../../types/eventTypes';

export interface DeductionItemInput {
  title: string;
  amount: number;
  notes?: string;
}

export class ResolveComplaintWorkflow {
  /**
   * Resolves an existing complaint and handles damage recovery allocations, owner expenses, or split room charges.
   */
  static async execute(
    pgId: string,
    complaintId: string,
    actorId: string,
    repairCost?: number,
    responsibility?: 'SPECIFIC_RESIDENT' | 'ENTIRE_ROOM' | 'OWNER',
    assignedTenantId?: string,
    billUrl?: string,
    resolvedImageUrl?: string,
    resolutionNotes?: string,
    deductionItems?: DeductionItemInput[],
    recoveryMethodInput: string = 'DEPOSIT' // DEPOSIT, CASH, UPI
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch complaint with resident profile
      const complaint = await tx.complaint.findUnique({
        where: { id: complaintId },
        include: {
          tenantProfile: {
            include: {
              invoices: {
                where: {
                  type: 'SECURITY_DEPOSIT',
                  status: 'PAID',
                  isActive: true
                }
              },
              damageRecoveries: {
                where: {
                  status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                  recoveryMethod: 'DEPOSIT'
                }
              }
            }
          }
        }
      });

      if (!complaint) {
        throw new Error('Complaint not found.');
      }

      if (complaint.status === ComplaintStatus.RESOLVED) {
        return complaint; // Idempotent success
      }

      const tenantProfile = complaint.tenantProfile;

      // Rule 2 & Safeguard: Check Settlement Status Lock
      if (tenantProfile.settlementStatus === 'LOCKED') {
        throw new Error('Stay profile is LOCKED. No modifications allowed.');
      }

      const totalCost = repairCost || 0;
      const parsedDeductionItems = deductionItems || [];

      // 2. Process based on responsibility
      if (responsibility === 'OWNER') {
        // Create a PG Maintenance Expense (Rule 1)
        await tx.expense.create({
          data: {
            pgId,
            category: 'MAINTENANCE_REPAIR',
            amount: totalCost,
            incurredAt: new Date(),
            receiptUrl: billUrl || null,
            createdBy: actorId
          }
        });
      } else if (responsibility === 'SPECIFIC_RESIDENT') {
        const targetTenantId = assignedTenantId || complaint.pgTenantId;
        
        // Fetch target tenant stay details
        const targetProfile = await tx.pGTenantProfile.findUnique({
          where: { id: targetTenantId },
          include: {
            invoices: {
              where: {
                type: 'SECURITY_DEPOSIT',
                status: 'PAID',
                isActive: true
              }
            },
            damageRecoveries: {
              where: {
                status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                recoveryMethod: 'DEPOSIT'
              }
            }
          }
        });

        if (!targetProfile) {
          throw new Error('Target resident profile not found.');
        }

        // Rule 2 & Safeguard: Check Settlement Lock on target profile
        if (targetProfile.settlementStatus === 'LOCKED') {
          throw new Error('Target resident stay profile is LOCKED. Recovery cannot be attached.');
        }

        // Rule 3: Check if deposit already refunded
        if (targetProfile.status === TenantStatus.PAST && targetProfile.securityDepositStatus === 'REFUNDED') {
          throw new Error('Deposit already settled. Recovery cannot be attached.');
        }

        // Rule 4: If method is DEPOSIT, check remaining deposit balance
        if (recoveryMethodInput === 'DEPOSIT') {
          const collectedDeposit = targetProfile.invoices.reduce((sum, inv) => sum + inv.amount, 0);
          const refundedAmount = targetProfile.depositRefundedAmount || 0;
          const previouslyDeducted = targetProfile.depositDeductionAmount || 0;
          const pendingRecoveries = targetProfile.damageRecoveries.reduce((sum, rec) => sum + rec.amount, 0);

          const remainingRefundableDeposit = Math.max(0, collectedDeposit - refundedAmount - previouslyDeducted - pendingRecoveries);

          if (totalCost > remainingRefundableDeposit) {
            throw new Error(`Recovery amount of ₹${totalCost.toLocaleString('en-IN')} exceeds the remaining refundable deposit of ₹${remainingRefundableDeposit.toLocaleString('en-IN')} for method DEPOSIT.`);
          }
        }

        // Create DamageRecovery entry
        const recovery = await tx.damageRecovery.create({
          data: {
            pgId,
            complaintId: complaint.id,
            tenantId: targetTenantId,
            roomId: targetProfile.roomId,
            bedId: targetProfile.bedId,
            amount: totalCost,
            reason: complaint.description || 'Damage Recovery',
            resolutionNotes,
            attachmentUrls: billUrl ? [billUrl] : [],
            status: 'PENDING',
            recoveryMethod: recoveryMethodInput,
            createdBy: actorId,
            items: {
              create: parsedDeductionItems.map(item => ({
                title: item.title,
                amount: item.amount,
                notes: item.notes || null
              }))
            }
          }
        });
      } else if (responsibility === 'ENTIRE_ROOM') {
        // Fetch all active/notice room occupants
        const occupants = await tx.pGTenantProfile.findMany({
          where: {
            roomId: tenantProfile.roomId,
            status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE] },
            isActive: true
          },
          include: {
            invoices: {
              where: {
                type: 'SECURITY_DEPOSIT',
                status: 'PAID',
                isActive: true
              }
            },
            damageRecoveries: {
              where: {
                status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                recoveryMethod: 'DEPOSIT'
              }
            }
          }
        });

        if (occupants.length === 0) {
          throw new Error('No current active occupants found in the room to split cost.');
        }

        const splitCost = totalCost / occupants.length;

        for (const occupant of occupants) {
          // Rule 2 & Safeguard: Check Settlement Lock on occupant profile
          if (occupant.settlementStatus === 'LOCKED') {
            throw new Error(`Room occupant stay profile (${occupant.id}) is LOCKED. Recovery cannot be attached.`);
          }

          // Rule 4: If method is DEPOSIT, check remaining deposit balance
          if (recoveryMethodInput === 'DEPOSIT') {
            const collectedDeposit = occupant.invoices.reduce((sum, inv) => sum + inv.amount, 0);
            const refundedAmount = occupant.depositRefundedAmount || 0;
            const previouslyDeducted = occupant.depositDeductionAmount || 0;
            const pendingRecoveries = occupant.damageRecoveries.reduce((sum, rec) => sum + rec.amount, 0);

            const remainingRefundableDeposit = Math.max(0, collectedDeposit - refundedAmount - previouslyDeducted - pendingRecoveries);

            if (splitCost > remainingRefundableDeposit) {
              throw new Error(`Split recovery cost of ₹${splitCost.toLocaleString('en-IN')} exceeds the remaining refundable deposit of ₹${remainingRefundableDeposit.toLocaleString('en-IN')} for room occupant.`);
            }
          }

          // Create split DamageRecovery entry
          await tx.damageRecovery.create({
            data: {
              pgId,
              complaintId: complaint.id,
              tenantId: occupant.id,
              roomId: occupant.roomId,
              bedId: occupant.bedId,
              amount: splitCost,
              reason: `Room Shared Damage Split: ${complaint.description || 'Damage'}`,
              resolutionNotes,
              attachmentUrls: billUrl ? [billUrl] : [],
              status: 'PENDING',
              recoveryMethod: recoveryMethodInput,
              createdBy: actorId,
              items: {
                create: parsedDeductionItems.map(item => ({
                  title: `${item.title} (Split 1/${occupants.length})`,
                  amount: item.amount / occupants.length,
                  notes: item.notes || null
                }))
              }
            }
          });
        }
      }

      // Update the complaint record as RESOLVED
      const updatedComplaint = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          status: ComplaintStatus.RESOLVED,
          repairCost: totalCost,
          responsibility: responsibility || null,
          billUrl: billUrl || null,
          resolvedImageUrl: resolvedImageUrl || null,
          resolutionNotes: resolutionNotes || null,
          resolvedAt: new Date(),
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
          metadata: { 
            pgId, 
            tenantId: complaint.pgTenantId,
            repairCost: totalCost,
            responsibility,
            billUrl,
            notes: resolutionNotes
          }
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
