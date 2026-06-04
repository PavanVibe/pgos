import { Request, Response } from 'express';
import { searchTenantByPhone } from '../services/tenantService';
import { OnboardResidentWorkflow } from '../services/workflows/OnboardResidentWorkflow';
import { VacateResidentWorkflow } from '../services/workflows/VacateResidentWorkflow';
import { lockBed } from '../services/lockService';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { TenantStatus } from '@prisma/client';

export const searchByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const tenant = await searchTenantByPhone(phone);
    if (!tenant) {
      return res.status(404).json({ status: 'not_found' });
    }

    res.status(200).json({ status: 'success', data: tenant });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const onboardSchema = z.object({
  bedId: z.string(),
  phone: z.string().min(10),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  moveInDate: z.string(),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().nonnegative(),
  isQuickAdd: z.boolean().default(false),
  kycDocUrl: z.string().optional(),
  bypassEmailCheck: z.boolean().optional(),
  transferResident: z.boolean().optional(),
  depositCollected: z.boolean().default(false),
  depositPaymentMode: z.string().optional(),
  depositCollectedAt: z.string().optional()
});

export const onboard = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const actorId = (req as any).auth?.userId || 'system';
    const payload = onboardSchema.parse(req.body);

    // Pre-flight database check to see if the bed is already occupied by an active, notice, or incomplete profile
    const activeProfile = await prisma.pGTenantProfile.findFirst({
      where: {
        bedId: payload.bedId,
        status: {
          in: [TenantStatus.ACTIVE, TenantStatus.INCOMPLETE, TenantStatus.NOTICE]
        }
      }
    });

    if (activeProfile) {
      return res.status(409).json({ error: 'Bed already occupied. Refresh occupancy map.' });
    }

    const profile = await OnboardResidentWorkflow.execute(
      pgId as string,
      payload.bedId,
      payload.phone,
      payload.name,
      payload.email || undefined,
      new Date(payload.moveInDate),
      payload.monthlyRent,
      payload.securityDeposit,
      actorId,
      payload.isQuickAdd,
      payload.kycDocUrl,
      payload.bypassEmailCheck || false,
      payload.transferResident || false,
      payload.depositCollected,
      payload.depositPaymentMode,
      payload.depositCollectedAt ? new Date(payload.depositCollectedAt) : undefined
    );

    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    if (error.message && error.message.includes('already occupied')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message && error.message.startsWith('WARNING_ACTIVE_OCCUPANCY:')) {
      const parts = error.message.split(':');
      return res.status(200).json({
        status: 'warning',
        code: 'ACTIVE_OCCUPANCY',
        allocation: {
          roomNumber: parts[1],
          bedLabel: parts[2],
          profileId: parts[3]
        }
      });
    }
    if (error.message && error.message.startsWith('WARNING_EMAIL_EXISTS:')) {
      const parts = error.message.split(':');
      return res.status(200).json({
        status: 'warning',
        code: 'EMAIL_EXISTS',
        tenant: {
          id: parts[1],
          name: parts[2],
          phone: parts[3],
          email: parts[4]
        }
      });
    }
    if (error.message && error.message === 'CONFLICT_DIFFERENT_RECORDS') {
      return res.status(409).json({
        error: 'Conflict: Phone number belongs to one resident, while email belongs to another. Automatic merge blocked.'
      });
    }
    res.status(400).json({ error: error.message });
  }
};

export const lockBedForOnboarding = async (req: Request, res: Response) => {
  try {
    const { bedId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';
    
    const success = await lockBed(bedId as string, actorId);
    if (!success) {
      return res.status(409).json({ error: 'Bed is currently locked by another operation.' });
    }

    res.status(200).json({ status: 'success', message: 'Bed locked for 5 minutes.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const vacate = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const actorId = (req as any).auth?.userId || 'system';

    const profile = await VacateResidentWorkflow.execute(pgId as string, tenantId as string, actorId);

    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getResidentProfile = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required.' });
    }

    const profile = await prisma.pGTenantProfile.findUnique({
      where: { id: profileId as string },
      include: {
        globalTenant: true,
        bed: {
          include: {
            room: true
          }
        },
        room: true,
        invoices: {
          orderBy: { dueDate: 'desc' }
        },
        complaints: {
          orderBy: { createdAt: 'desc' }
        },
        damageRecoveries: {
          include: { items: true },
          orderBy: { createdAt: 'desc' }
        },
        paymentReceipts: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Resident stay profile not found.' });
    }

    res.status(200).json({ status: 'success', data: profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const settleMoveout = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    const { tenantId } = req.params;
    const { action, amount, paymentMode } = req.body;
    const actorId = (req as any).auth?.userId || 'system';

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.pGTenantProfile.findUnique({
        where: { id: tenantId as string },
        include: {
          invoices: { where: { isActive: true } },
          damageRecoveries: { where: { status: { in: ['PENDING', 'PARTIALLY_RECOVERED', 'DISPUTED', 'ACCEPTED'] } } }
        }
      });

      if (!profile) {
        throw new Error('Resident stay profile not found.');
      }

      if (action === 'COLLECT') {
        let remainingToDistribute = parseFloat(amount) || 0;

        // 1. Pay rent invoices
        const unpaidRent = profile.invoices.filter(inv => inv.type === 'RENT' && inv.status !== 'PAID');
        for (const rentInv of unpaidRent) {
          if (remainingToDistribute <= 0) break;
          const payAmt = Math.min(remainingToDistribute, rentInv.amount);
          remainingToDistribute -= payAmt;

          if (payAmt === rentInv.amount) {
            await tx.rentInvoice.update({
              where: { id: rentInv.id },
              data: {
                status: 'PAID',
                paymentMode: paymentMode || 'CASH',
                paidAt: new Date(),
                updatedBy: actorId
              }
            });
          } else {
            const remaining = rentInv.amount - payAmt;
            await tx.rentInvoice.update({
              where: { id: rentInv.id },
              data: {
                amount: payAmt,
                status: 'PAID',
                paymentMode: paymentMode || 'CASH',
                paidAt: new Date(),
                updatedBy: actorId
              }
            });
            await tx.rentInvoice.create({
              data: {
                pgTenantId: profile.id,
                amount: remaining,
                dueDate: rentInv.dueDate,
                status: 'PENDING',
                type: 'RENT',
                createdBy: actorId,
                updatedBy: actorId
              }
            });
          }

          await tx.auditLog.create({
            data: {
              actorId,
              action: payAmt === rentInv.amount ? 'RENT_PAID' : 'RENT_PARTIAL_PAID',
              entityType: 'RentInvoice',
              entityId: rentInv.id,
              metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
            }
          });
        }

        // 2. Pay deposit obligations
        const unpaidDeposit = profile.invoices.filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID');
        for (const depInv of unpaidDeposit) {
          if (remainingToDistribute <= 0) break;
          const payAmt = Math.min(remainingToDistribute, depInv.amount);
          remainingToDistribute -= payAmt;

          if (payAmt === depInv.amount) {
            await tx.rentInvoice.update({
              where: { id: depInv.id },
              data: {
                status: 'PAID',
                paymentMode: paymentMode || 'CASH',
                paidAt: new Date(),
                updatedBy: actorId
              }
            });
          } else {
            const remaining = depInv.amount - payAmt;
            await tx.rentInvoice.update({
              where: { id: depInv.id },
              data: {
                amount: payAmt,
                status: 'PAID',
                paymentMode: paymentMode || 'CASH',
                paidAt: new Date(),
                updatedBy: actorId
              }
            });
            await tx.rentInvoice.create({
              data: {
                pgTenantId: profile.id,
                amount: remaining,
                dueDate: depInv.dueDate,
                status: 'PENDING',
                type: 'SECURITY_DEPOSIT',
                createdBy: actorId,
                updatedBy: actorId
              }
            });
          }

          // Compute new deposit status on profile
          const allPaidDeposits = await tx.rentInvoice.findMany({
            where: { pgTenantId: profile.id, type: 'SECURITY_DEPOSIT', status: 'PAID', isActive: true }
          });
          const totalPaid = allPaidDeposits.reduce((sum, d) => sum + d.amount, 0);
          let newStatus = 'PENDING';
          if (totalPaid >= profile.securityDeposit) {
            newStatus = 'COLLECTED';
          } else if (totalPaid > 0) {
            newStatus = 'PARTIALLY_PAID';
          }

          await tx.pGTenantProfile.update({
            where: { id: profile.id },
            data: {
              securityDepositStatus: newStatus,
              depositCollectedAt: newStatus === 'COLLECTED' || newStatus === 'PARTIALLY_PAID' ? new Date() : null,
              updatedBy: actorId
            }
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: payAmt === depInv.amount ? 'DEPOSIT_PAID' : 'DEPOSIT_PARTIAL_PAID',
              entityType: 'RentInvoice',
              entityId: depInv.id,
              metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
            }
          });
        }

        // 3. Pay damage recoveries
        const unpaidRecoveries = profile.damageRecoveries;
        for (const recovery of unpaidRecoveries) {
          if (remainingToDistribute <= 0) break;
          const payAmt = Math.min(remainingToDistribute, recovery.outstandingAmount);
          remainingToDistribute -= payAmt;

          const nextRecovered = recovery.recoveredAmount + payAmt;
          const nextOutstanding = Math.max(0, recovery.totalAmount - nextRecovered);
          const nextStatus = nextOutstanding === 0 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';

          await tx.damageRecovery.update({
            where: { id: recovery.id },
            data: {
              recoveredAmount: nextRecovered,
              outstandingAmount: nextOutstanding,
              status: nextStatus,
              collectedDate: new Date(),
              paymentMode: paymentMode?.toUpperCase() || 'CASH',
              amountReceived: nextRecovered
            }
          });

          await tx.recoveryTransaction.create({
            data: {
              recoveryId: recovery.id,
              amount: payAmt,
              paymentMethod: paymentMode?.toUpperCase() || 'CASH',
              notes: 'Collected during move-out settlement',
              createdBy: actorId
            }
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'RECOVERY_UPDATED',
              entityType: 'DamageRecovery',
              entityId: recovery.id,
              metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
            }
          });
        }
      } else if (action === 'WAIVE') {
        // Waive all Rent, Deposit obligations, and Damage recoveries
        const unpaidRent = profile.invoices.filter(inv => inv.type === 'RENT' && inv.status !== 'PAID');
        for (const rentInv of unpaidRent) {
          await tx.rentInvoice.update({
            where: { id: rentInv.id },
            data: {
              status: 'PAID',
              paymentMode: 'WAIVED',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
        }

        const unpaidDeposit = profile.invoices.filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID');
        for (const depInv of unpaidDeposit) {
          await tx.rentInvoice.update({
            where: { id: depInv.id },
            data: {
              status: 'PAID',
              paymentMode: 'WAIVED',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
        }

        await tx.pGTenantProfile.update({
          where: { id: profile.id },
          data: {
            securityDepositStatus: 'COLLECTED', // bypass as waived
            updatedBy: actorId
          }
        });

        const unpaidRecoveries = profile.damageRecoveries;
        for (const recovery of unpaidRecoveries) {
          await tx.damageRecovery.update({
            where: { id: recovery.id },
            data: {
              status: 'WAIVED',
              recoveryMethod: 'WAIVED',
              outstandingAmount: 0,
              waivedAt: new Date(),
              waivedReason: 'Waived during move-out settlement'
            }
          });

          await tx.recoveryTransaction.create({
            data: {
              recoveryId: recovery.id,
              amount: recovery.outstandingAmount,
              paymentMethod: 'WAIVED',
              notes: 'Waived during move-out settlement',
              createdBy: actorId
            }
          });
        }
      } else if (action === 'REFUND') {
        const refundAmt = parseFloat(amount) || 0;
        await tx.pGTenantProfile.update({
          where: { id: profile.id },
          data: {
            depositRefundedAmount: (profile.depositRefundedAmount || 0) + refundAmt,
            depositRefundedAt: new Date(),
            depositRefundMode: paymentMode?.toUpperCase() || 'CASH',
            depositRefundNotes: 'Refunded during move-out settlement',
            securityDepositStatus: 'REFUNDED'
          }
        });

        await tx.depositLedgerTransaction.create({
          data: {
            tenantProfileId: profile.id,
            type: 'DEPOSIT_REFUND',
            amount: refundAmt,
            reason: 'Refunded deposit balance during move-out settlement',
            createdBy: actorId
          }
        });
      }

      // Return updated profile details
      return tx.pGTenantProfile.findUnique({
        where: { id: profile.id },
        include: {
          invoices: { where: { isActive: true } },
          damageRecoveries: true
        }
      });
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

const updateResidentSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

export const updateResidentProfile = async (req: Request, res: Response) => {
  try {
    const pgId = ((req as any).pg?.id || req.params.pgId) as string;
    const tenantId = req.params.tenantId as string;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const { name, phone, email } = updateResidentSchema.parse(req.body);

    const profile = await prisma.pGTenantProfile.findFirst({
      where: { id: tenantId, pgId, isActive: true },
      include: { globalTenant: true }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Resident stay profile not found.' });
    }

    // Update globalTenant and profile
    const result = await prisma.$transaction(async (tx) => {
      const tenantData: any = {};
      if (name !== undefined) tenantData.name = name;
      if (phone !== undefined) tenantData.phone = phone;
      if (email !== undefined) tenantData.email = email || null;

      await tx.globalTenant.update({
        where: { id: profile.globalTenantId },
        data: tenantData
      });

      return tx.pGTenantProfile.findUnique({
        where: { id: tenantId },
        include: { globalTenant: true }
      });
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Fetch all active resident profiles in a PG
 */
export const getPGResidents = async (req: Request, res: Response) => {
  try {
    const pgId = (req as any).pg?.id || req.params.pgId;
    if (!pgId) {
      return res.status(400).json({ error: 'PG ID context is required.' });
    }

    const { status } = req.query;

    const profiles = await prisma.pGTenantProfile.findMany({
      where: {
        pgId: pgId as string,
        isActive: true,
        status: status ? (status as any) : undefined
      },
      include: {
        globalTenant: {
          select: {
            name: true,
            phone: true,
            email: true
          }
        },
        room: {
          select: {
            number: true,
            floor: true
          }
        },
        bed: {
          select: {
            bedNumber: true,
            monthlyRent: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ status: 'success', data: profiles });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch PG residents.' });
  }
};


