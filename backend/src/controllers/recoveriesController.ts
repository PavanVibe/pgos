import { Request, Response } from 'express';
import prisma from '../utils/prisma';

/**
 * Fetches the detailed damage recoveries ledger list.
 */
export const getRecoveriesLedger = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const recoveries = await prisma.damageRecovery.findMany({
      where: { pgId, tenantProfile: { isActive: true } },
      include: {
        tenantProfile: {
          include: {
            globalTenant: {
              select: {
                name: true,
                phone: true,
              }
            },
            room: {
              select: {
                number: true,
              }
            },
            bed: {
              select: {
                bedNumber: true,
              }
            }
          }
        },
        complaint: {
          select: {
            id: true,
            description: true,
            createdAt: true,
            resolvedAt: true,
          }
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const ledger = recoveries.map((rec) => {
      const tenant = rec.tenantProfile;
      return {
        id: rec.id,
        residentName: tenant?.globalTenant?.name || 'Unknown',
        phone: tenant?.globalTenant?.phone,
        roomNumber: tenant?.room?.number || tenant?.historicalRoomNumber || '-',
        bedNumber: tenant?.bed?.bedNumber || tenant?.historicalBedNumber || '-',
        complaintId: rec.complaintId,
        complaintTitle: rec.complaint?.description || rec.reason || 'Damage Recovery',
        complaintDate: rec.complaint?.createdAt || null,
        resolutionDate: rec.complaint?.resolvedAt || null,
        amount: rec.amount,
        collectedAmount: rec.amountReceived,
        outstandingAmount: Math.max(0, rec.amount - rec.amountReceived),
        status: rec.status, // PENDING, ACCEPTED, DISPUTED, RECOVERED, WAIVED, REFUNDED
        recoveryMethod: rec.recoveryMethod, // DEPOSIT, CASH, UPI, WAIVED
        settlementStatus: tenant?.settlementStatus || 'OPEN',
        date: rec.createdAt,
        attachmentUrls: rec.attachmentUrls,
        disputeReason: rec.disputeReason,
        waivedReason: rec.waivedReason,
        items: rec.items.map(item => ({
          id: item.id,
          title: item.title,
          amount: item.amount,
          notes: item.notes
        }))
      };
    });

    res.status(200).json({ status: 'success', data: ledger });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Aggregates statistics for the damage recoveries dashboard widget.
 */
export const getDamageRecoveryDashboard = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const [
      pendingData,
      recoveredData,
      waivedData,
      disputedData,
      totalSum
    ] = await Promise.all([
      // Pending
      prisma.damageRecovery.aggregate({
        where: { pgId, status: { in: ['PENDING', 'ACCEPTED'] } },
        _count: { id: true },
        _sum: { amount: true }
      }),
      // Recovered
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'RECOVERED' },
        _count: { id: true },
        _sum: { amountReceived: true, amount: true }
      }),
      // Waived
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'WAIVED' },
        _count: { id: true },
        _sum: { amount: true }
      }),
      // Disputed
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'DISPUTED' },
        _count: { id: true },
        _sum: { amount: true }
      }),
      // All
      prisma.damageRecovery.aggregate({
        where: { pgId },
        _sum: { amount: true, amountReceived: true }
      })
    ]);

    const totalDamageAmount = totalSum._sum.amount || 0;
    const totalRecoveredAmount = totalSum._sum.amountReceived || 0;
    const totalOutstandingAmount = Math.max(0, totalDamageAmount - totalRecoveredAmount - (waivedData._sum.amount || 0));

    res.status(200).json({
      status: 'success',
      data: {
        pendingRecoveriesCount: pendingData._count.id || 0,
        pendingRecoveriesAmount: pendingData._sum.amount || 0,
        recoveredCount: recoveredData._count.id || 0,
        recoveredAmount: recoveredData._sum.amountReceived || 0,
        waivedCount: waivedData._count.id || 0,
        waivedAmount: waivedData._sum.amount || 0,
        disputedCount: disputedData._count.id || 0,
        disputedAmount: disputedData._sum.amount || 0,
        totalDamageAmount,
        totalRecoveredAmount,
        totalOutstandingAmount
      }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Transitions dynamic status states (Accepted, Disputed, Waived, Recovered).
 */
export const updateRecoveryStatus = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { recoveryId } = req.params;
    const { 
      status, 
      notes, 
      reason, 
      amountReceived, 
      paymentMode, 
      referenceNumber,
      recoveryMethod 
    } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    const result = await prisma.$transaction(async (tx) => {
      const recovery = await tx.damageRecovery.findUnique({
        where: { id: recoveryId as string },
        include: { tenantProfile: true }
      }) as any;

      if (!recovery) {
        throw new Error('Damage recovery entry not found.');
      }

      // Safeguard check: Immutability lock
      if (recovery.tenantProfile.settlementStatus === 'LOCKED') {
        throw new Error('Resident stay profile is LOCKED. Recovery status cannot be changed.');
      }

      const oldStatus = recovery.status;
      let newStatus = status || oldStatus;
      let finalRecoveryMethod = recoveryMethod || recovery.recoveryMethod;
      
      const updateData: any = {
        status: newStatus,
        recoveryMethod: finalRecoveryMethod,
        updatedAt: new Date()
      };

      // Handle transitions
      if (newStatus === 'ACCEPTED') {
        updateData.acceptedAt = new Date();
        updateData.acceptedBy = actorId;
      } else if (newStatus === 'DISPUTED') {
        updateData.disputedAt = new Date();
        updateData.disputeReason = reason || 'Disputed by tenant';
      } else if (newStatus === 'WAIVED') {
        updateData.waivedAt = new Date();
        updateData.waivedReason = reason || 'Waived by management';
        updateData.recoveryMethod = 'WAIVED';
        finalRecoveryMethod = 'WAIVED';
      } else if (newStatus === 'RECOVERED') {
        updateData.collectedDate = new Date();
        updateData.amountReceived = amountReceived !== undefined ? parseFloat(amountReceived) : recovery.amount;
        updateData.paymentMode = paymentMode || recovery.paymentMode || 'CASH';
        updateData.referenceNumber = referenceNumber || recovery.referenceNumber;
        updateData.collectionNotes = notes || recovery.collectionNotes;
        
        // If recoveryMethod is DEPOSIT, update the depositDeductionAmount structurally!
        if (finalRecoveryMethod === 'DEPOSIT') {
          const targetProfile = recovery.tenantProfile;
          const currentDeductions = targetProfile.depositDeductionAmount || 0;
          const newDeductions = currentDeductions + updateData.amountReceived;

          await tx.pGTenantProfile.update({
            where: { id: recovery.tenantId },
            data: { 
              depositDeductionAmount: newDeductions,
              updatedBy: actorId
            }
          });
        }
      }

      const updated = await tx.damageRecovery.update({
        where: { id: recoveryId as string },
        data: updateData
      });

      // Write Audit Log with old vs. new values
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RECOVERY_UPDATED',
          entityType: 'DamageRecovery',
          entityId: recoveryId as string,
          metadata: {
            pgId,
            tenantId: recovery.tenantId,
            oldStatus,
            newStatus,
            oldMethod: recovery.recoveryMethod,
            newMethod: finalRecoveryMethod,
            amountReceived: updateData.amountReceived
          }
        }
      });

      return updated;
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Locks the stay settlement profile permanently.
 */
export const lockStaySettlement = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';

    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.pGTenantProfile.findUnique({
        where: { id: tenantId as string }
      });

      if (!profile) {
        throw new Error('Resident stay profile not found.');
      }

      const updated = await tx.pGTenantProfile.update({
        where: { id: tenantId as string },
        data: {
          settlementStatus: 'LOCKED',
          updatedBy: actorId
        }
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SETTLEMENT_LOCKED',
          entityType: 'PGTenantProfile',
          entityId: tenantId as string,
          metadata: {
            oldValue: profile.settlementStatus,
            newValue: 'LOCKED'
          }
        }
      });

      return updated;
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
