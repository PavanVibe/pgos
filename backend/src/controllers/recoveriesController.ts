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
        depositTransactions: {
          orderBy: { createdAt: 'desc' }
        },
        recoveryTransactions: {
          orderBy: { createdAt: 'desc' }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all Security Deposit invoices for these tenants
    const tenantIds = recoveries.map(r => r.tenantId).filter(Boolean) as string[];
    const depositInvoices = await prisma.rentInvoice.findMany({
      where: {
        pgTenantId: { in: tenantIds },
        type: 'SECURITY_DEPOSIT',
        status: 'PAID',
        isActive: true
      }
    });

    const ledger = recoveries.map((rec) => {
      const tenant = rec.tenantProfile;
      const tenantInvoices = depositInvoices.filter(inv => inv.pgTenantId === rec.tenantId);
      const collectedDeposit = tenantInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const totalDeductions = tenant?.depositDeductionAmount || 0;
      const refundedAmount = tenant?.depositRefundedAmount || 0;
      const refundableDeposit = Math.max(0, collectedDeposit - refundedAmount - totalDeductions);

      return {
        id: rec.id,
        tenantProfileId: rec.tenantId,
        residentName: tenant?.globalTenant?.name || 'Unknown',
        phone: tenant?.globalTenant?.phone,
        roomNumber: tenant?.room?.number || tenant?.historicalRoomNumber || '-',
        bedNumber: tenant?.bed?.bedNumber || tenant?.historicalBedNumber || '-',
        complaintId: rec.complaintId,
        complaintTitle: rec.complaint?.description || rec.reason || 'Damage Recovery',
        complaintDate: rec.complaint?.createdAt || null,
        resolutionDate: rec.complaint?.resolvedAt || null,
        amount: rec.totalAmount,
        collectedAmount: rec.recoveredAmount,
        outstandingAmount: rec.outstandingAmount,
        status: rec.status, // PENDING, PARTIALLY_RECOVERED, FULLY_RECOVERED, WAIVED, DISPUTED
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
        })),
        depositTransactions: rec.depositTransactions || [],
        recoveryTransactions: rec.recoveryTransactions || [],
        refundableDeposit
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
      partialData,
      fullyRecoveredData,
      waivedData,
      disputedData,
      totalSum
    ] = await Promise.all([
      // Pending
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'PENDING' },
        _count: { id: true },
        _sum: { outstandingAmount: true }
      }),
      // Partially Recovered
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'PARTIALLY_RECOVERED' },
        _count: { id: true },
        _sum: { outstandingAmount: true }
      }),
      // Fully Recovered
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'FULLY_RECOVERED' },
        _count: { id: true },
        _sum: { recoveredAmount: true }
      }),
      // Waived
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'WAIVED' },
        _count: { id: true },
        _sum: { totalAmount: true }
      }),
      // Disputed
      prisma.damageRecovery.aggregate({
        where: { pgId, status: 'DISPUTED' },
        _count: { id: true },
        _sum: { outstandingAmount: true }
      }),
      // All
      prisma.damageRecovery.aggregate({
        where: { pgId },
        _sum: { totalAmount: true, recoveredAmount: true, outstandingAmount: true }
      })
    ]);

    const totalDamageAmount = totalSum._sum.totalAmount || 0;
    const totalRecoveredAmount = totalSum._sum.recoveredAmount || 0;
    const waivedAmount = waivedData._sum.totalAmount || 0;
    const totalOutstandingAmount = Math.max(0, totalSum._sum.outstandingAmount || 0);

    res.status(200).json({
      status: 'success',
      data: {
        pendingRecoveriesCount: pendingData._count.id || 0,
        pendingRecoveriesAmount: pendingData._sum.outstandingAmount || 0,
        partiallyRecoveredCount: partialData._count.id || 0,
        partiallyRecoveredAmount: partialData._sum.outstandingAmount || 0,
        fullyRecoveredCount: fullyRecoveredData._count.id || 0,
        fullyRecoveredAmount: fullyRecoveredData._sum.recoveredAmount || 0,
        waivedCount: waivedData._count.id || 0,
        waivedAmount,
        disputedCount: disputedData._count.id || 0,
        disputedAmount: disputedData._sum.outstandingAmount || 0,
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
        updatedAt: new Date()
      };

      // Load target profile details for calculations
      const targetProfile = await tx.pGTenantProfile.findUnique({
        where: { id: recovery.tenantId },
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
              status: { in: ['PENDING', 'PARTIALLY_RECOVERED'] },
              recoveryMethod: 'DEPOSIT'
            }
          }
        }
      });

      if (!targetProfile) {
        throw new Error('Target resident profile not found.');
      }

      // Handle transitions
      if (newStatus === 'ACCEPTED') {
        updateData.acceptedAt = new Date();
        updateData.acceptedBy = actorId;
        
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STATUS_CHANGED',
            entityType: 'DamageRecovery',
            entityId: recovery.id,
            metadata: {
              timestamp: new Date(),
              user: actorId,
              action: 'STATUS_CHANGED',
              entity: 'DamageRecovery',
              oldValue: oldStatus,
              newValue: 'ACCEPTED'
            }
          }
        });
      } else if (newStatus === 'DISPUTED') {
        updateData.status = 'DISPUTED';
        updateData.disputedAt = new Date();
        updateData.disputeReason = reason || 'Disputed by tenant';

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DISPUTED',
            entityType: 'DamageRecovery',
            entityId: recovery.id,
            metadata: {
              timestamp: new Date(),
              user: actorId,
              action: 'DISPUTED',
              entity: 'DamageRecovery',
              oldValue: oldStatus,
              newValue: 'DISPUTED'
            }
          }
        });
      } else if (newStatus === 'WAIVED') {
        updateData.status = 'WAIVED';
        updateData.waivedAt = new Date();
        updateData.waivedReason = reason || 'Waived by management';
        updateData.recoveryMethod = 'WAIVED';
        finalRecoveryMethod = 'WAIVED';

        const remainingToWaive = Math.max(0, recovery.totalAmount - recovery.recoveredAmount);
        updateData.outstandingAmount = 0;

        if (remainingToWaive > 0) {
          // Log waived recovery transaction
          await tx.recoveryTransaction.create({
            data: {
              recoveryId: recovery.id,
              amount: remainingToWaive,
              paymentMethod: 'WAIVED',
              notes: reason || 'Waived by management',
              createdBy: actorId
            }
          });
        }

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'WAIVED',
            entityType: 'DamageRecovery',
            entityId: recovery.id,
            metadata: {
              timestamp: new Date(),
              user: actorId,
              action: 'WAIVED',
              entity: 'DamageRecovery',
              oldValue: { status: oldStatus, outstandingAmount: recovery.outstandingAmount },
              newValue: { status: 'WAIVED', outstandingAmount: 0 }
            }
          }
        });
      } else if (newStatus === 'RECOVERED' || newStatus === 'FULLY_RECOVERED' || newStatus === 'PARTIALLY_RECOVERED' || amountReceived !== undefined) {
        const parsedAmount = amountReceived !== undefined ? parseFloat(amountReceived) : (recovery.totalAmount - recovery.recoveredAmount);
        const toAdd = parsedAmount;
        const finalRecovered = recovery.recoveredAmount + toAdd;
        const finalOutstanding = Math.max(0, recovery.totalAmount - finalRecovered);

        updateData.recoveredAmount = finalRecovered;
        updateData.outstandingAmount = finalOutstanding;
        updateData.amountReceived = finalRecovered; // backward compatibility

        // Automatic status normalization
        if (finalOutstanding === 0) {
          updateData.status = 'FULLY_RECOVERED';
        } else if (finalRecovered > 0) {
          updateData.status = 'PARTIALLY_RECOVERED';
        } else {
          updateData.status = 'PENDING';
        }

        updateData.collectedDate = new Date();
        updateData.paymentMode = paymentMode || recovery.paymentMode || 'CASH';
        updateData.referenceNumber = referenceNumber || recovery.referenceNumber;
        updateData.collectionNotes = notes || recovery.collectionNotes;

        // Log Recovery Payment Transaction
        await tx.recoveryTransaction.create({
          data: {
            recoveryId: recovery.id,
            amount: toAdd,
            paymentMethod: paymentMode || 'CASH',
            referenceNumber: referenceNumber || null,
            notes: notes || null,
            createdBy: actorId
          }
        });

        // Audit Log for the recovery collection action
        const actionName = paymentMode === 'UPI' ? 'UPI_COLLECTED' : (paymentMode === 'DEPOSIT' ? 'DEPOSIT_DEDUCTED' : 'CASH_COLLECTED');
        await tx.auditLog.create({
          data: {
            actorId,
            action: actionName,
            entityType: 'DamageRecovery',
            entityId: recovery.id,
            metadata: {
              timestamp: new Date(),
              user: actorId,
              action: actionName,
              entity: 'DamageRecovery',
              oldValue: {
                recoveredAmount: recovery.recoveredAmount,
                outstandingAmount: recovery.outstandingAmount,
                status: oldStatus
              },
              newValue: {
                recoveredAmount: finalRecovered,
                outstandingAmount: finalOutstanding,
                status: updateData.status,
                paymentMode: paymentMode,
                referenceNumber: referenceNumber
              }
            }
          }
        });

        if (oldStatus !== updateData.status) {
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STATUS_CHANGED',
              entityType: 'DamageRecovery',
              entityId: recovery.id,
              metadata: {
                timestamp: new Date(),
                user: actorId,
                action: 'STATUS_CHANGED',
                entity: 'DamageRecovery',
                oldValue: oldStatus,
                newValue: updateData.status
              }
            }
          });
        }

        // Handle DEPOSIT deduction transaction structurally
        if (paymentMode === 'DEPOSIT') {
          const collectedDeposit = targetProfile.invoices.reduce((sum, inv) => sum + inv.amount, 0);
          const refundedAmount = targetProfile.depositRefundedAmount || 0;
          const previouslyDeducted = targetProfile.depositDeductionAmount || 0;
          const pendingRecoveries = targetProfile.damageRecoveries
            .filter((r) => r.id !== recovery.id)
            .reduce((sum, rec) => sum + rec.amount, 0);

          const remainingRefundableDeposit = Math.max(0, collectedDeposit - refundedAmount - previouslyDeducted - pendingRecoveries);

          if (toAdd > remainingRefundableDeposit) {
            throw new Error(`Collection exceeds remaining refundable deposit of ₹${remainingRefundableDeposit.toLocaleString('en-IN')}`);
          }

          // Increment profile's depositDeductionAmount
          await tx.pGTenantProfile.update({
            where: { id: recovery.tenantId },
            data: {
              depositDeductionAmount: previouslyDeducted + toAdd,
              updatedBy: actorId
            }
          });

          // Generate DepositLedgerTransaction
          const depositTx = await tx.depositLedgerTransaction.create({
            data: {
              tenantProfileId: recovery.tenantId,
              recoveryId: recovery.id,
              complaintId: recovery.complaintId,
              type: 'DEPOSIT_DEDUCTION',
              amount: toAdd,
              reason: recovery.reason || 'Damage Deduction',
              notes: notes || null,
              createdBy: actorId
            }
          });

          // Audit log for deposit deduction
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'DEPOSIT_DEDUCTED',
              entityType: 'DepositLedgerTransaction',
              entityId: depositTx.id,
              metadata: {
                timestamp: new Date(),
                user: actorId,
                action: 'DEPOSIT_DEDUCTED',
                entity: 'DepositLedgerTransaction',
                oldValue: null,
                newValue: {
                  tenantProfileId: recovery.tenantId,
                  amount: toAdd,
                  reason: recovery.reason || 'Damage Deduction'
                }
              }
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
            newStatus: updateData.status || recovery.status,
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
          action: 'SETTLEMENT_COMPLETED',
          entityType: 'PGTenantProfile',
          entityId: tenantId as string,
          metadata: {
            timestamp: new Date(),
            user: actorId,
            action: 'SETTLEMENT_COMPLETED',
            entity: 'PGTenantProfile',
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

/**
 * Fetches audit logs for a specific damage recovery entry.
 */
export const getRecoveryAuditLogs = async (req: Request, res: Response) => {
  try {
    const { recoveryId } = req.params;
    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: recoveryId as string,
        entityType: 'DamageRecovery'
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: logs });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
