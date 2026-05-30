import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { TenantStatus, InvoiceStatus } from '@prisma/client';
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
      // 1. Fetch complete stay profile including invoices and recoveries
      const profile = await tx.pGTenantProfile.findFirst({
        where: {
          id: tenantId,
          pgId,
          status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE, TenantStatus.INCOMPLETE] }
        },
        include: {
          invoices: {
            where: { isActive: true }
          },
          damageRecoveries: {
            where: { status: { in: ['PENDING', 'PARTIALLY_RECOVERED', 'DISPUTED', 'ACCEPTED'] } }
          }
        }
      });

      if (!profile) {
        throw new Error('Active resident stay profile not found.');
      }

      // 2. Separate RentInvoices to calculate Expected & Collected Security Deposit, Outstanding Rent, and Outstanding Utilities
      const depositInvoices = profile.invoices.filter(inv => inv.type === 'SECURITY_DEPOSIT');
      const paidDepositInvoices = depositInvoices.filter(inv => inv.status === InvoiceStatus.PAID);
      const collectedDeposit = paidDepositInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      const unpaidRentInvoices = profile.invoices.filter(inv => inv.type === 'RENT' && inv.status !== InvoiceStatus.PAID);
      const unpaidUtilityInvoices = profile.invoices.filter(inv => (inv.type === 'UTILITY' || inv.type === 'UTILITIES') && inv.status !== InvoiceStatus.PAID);

      const outstandingRent = unpaidRentInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const outstandingUtilities = unpaidUtilityInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const outstandingDamage = profile.damageRecoveries.reduce((sum, rec) => sum + rec.outstandingAmount, 0);

      const totalDeductions = outstandingRent + outstandingUtilities + outstandingDamage;
      const refundableDeposit = Math.max(0, collectedDeposit - totalDeductions);
      const actualDeductionApplied = collectedDeposit - refundableDeposit;

      let remainingCollectedDeposit = collectedDeposit;

      // 3. Sequentially deduct Outstanding Rent from collected deposit
      for (const rentInv of unpaidRentInvoices) {
        if (remainingCollectedDeposit <= 0) break;
        const deductAmt = Math.min(remainingCollectedDeposit, rentInv.amount);
        remainingCollectedDeposit -= deductAmt;

        if (deductAmt === rentInv.amount) {
          // Fully paid by deposit deduction
          await tx.rentInvoice.update({
            where: { id: rentInv.id },
            data: {
              status: InvoiceStatus.PAID,
              paymentMode: 'DEPOSIT',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
        } else {
          // Partially paid: split the invoice
          const remainingAmt = rentInv.amount - deductAmt;
          // Update parent rent invoice as paid with the deducted amount
          await tx.rentInvoice.update({
            where: { id: rentInv.id },
            data: {
              amount: deductAmt,
              status: InvoiceStatus.PAID,
              paymentMode: 'DEPOSIT',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
          // Create child invoice for outstanding remaining portion
          await tx.rentInvoice.create({
            data: {
              pgTenantId: profile.id,
              amount: remainingAmt,
              dueDate: rentInv.dueDate,
              status: InvoiceStatus.PENDING,
              type: 'RENT',
              createdBy: actorId,
              updatedBy: actorId
            }
          });
        }

        // Log Deposit Ledger transaction for Rent deduction
        await tx.depositLedgerTransaction.create({
          data: {
            tenantProfileId: profile.id,
            type: 'DEPOSIT_DEDUCTION',
            amount: deductAmt,
            reason: `Deducted for Outstanding Rent (Invoice due: ${rentInv.dueDate.toLocaleDateString()})`,
            createdBy: actorId
          }
        });
      }

      // 4. Sequentially deduct Outstanding Utilities from collected deposit
      for (const utilInv of unpaidUtilityInvoices) {
        if (remainingCollectedDeposit <= 0) break;
        const deductAmt = Math.min(remainingCollectedDeposit, utilInv.amount);
        remainingCollectedDeposit -= deductAmt;

        if (deductAmt === utilInv.amount) {
          // Fully paid by deposit deduction
          await tx.rentInvoice.update({
            where: { id: utilInv.id },
            data: {
              status: InvoiceStatus.PAID,
              paymentMode: 'DEPOSIT',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
        } else {
          // Partially paid: split the invoice
          const remainingAmt = utilInv.amount - deductAmt;
          await tx.rentInvoice.update({
            where: { id: utilInv.id },
            data: {
              amount: deductAmt,
              status: InvoiceStatus.PAID,
              paymentMode: 'DEPOSIT',
              paidAt: new Date(),
              updatedBy: actorId
            }
          });
          await tx.rentInvoice.create({
            data: {
              pgTenantId: profile.id,
              amount: remainingAmt,
              dueDate: utilInv.dueDate,
              status: InvoiceStatus.PENDING,
              type: utilInv.type,
              createdBy: actorId,
              updatedBy: actorId
            }
          });
        }

        // Log Deposit Ledger transaction for Utility deduction
        await tx.depositLedgerTransaction.create({
          data: {
            tenantProfileId: profile.id,
            type: 'DEPOSIT_DEDUCTION',
            amount: deductAmt,
            reason: `Deducted for Outstanding Utilities (Invoice due: ${utilInv.dueDate.toLocaleDateString()})`,
            createdBy: actorId
          }
        });
      }

      // 5. Sequentially deduct Outstanding Damage Recoveries from collected deposit
      for (const recovery of profile.damageRecoveries) {
        if (remainingCollectedDeposit <= 0) break;
        const deductAmt = Math.min(remainingCollectedDeposit, recovery.outstandingAmount);
        remainingCollectedDeposit -= deductAmt;

        const nextRecovered = recovery.recoveredAmount + deductAmt;
        const nextOutstanding = recovery.outstandingAmount - deductAmt;
        const nextStatus = nextOutstanding === 0 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';

        // Update DamageRecovery record
        await tx.damageRecovery.update({
          where: { id: recovery.id },
          data: {
            recoveredAmount: nextRecovered,
            outstandingAmount: nextOutstanding,
            status: nextStatus,
            recoveryMethod: 'DEPOSIT',
            amountReceived: recovery.amountReceived + deductAmt,
            paymentMode: 'DEPOSIT',
            collectedDate: new Date(),
            collectionNotes: 'Deducted from security deposit upon vacate settlement'
          }
        });

        // Log RecoveryTransaction
        await tx.recoveryTransaction.create({
          data: {
            recoveryId: recovery.id,
            amount: deductAmt,
            paymentMethod: 'DEPOSIT',
            notes: 'Automatically deducted from security deposit upon vacate settlement',
            createdBy: actorId
          }
        });

        // Log Deposit Ledger transaction for Damage deduction
        await tx.depositLedgerTransaction.create({
          data: {
            tenantProfileId: profile.id,
            recoveryId: recovery.id,
            type: 'DEPOSIT_DEDUCTION',
            amount: deductAmt,
            reason: `Deducted for Damage Recovery: ${recovery.reason}`,
            createdBy: actorId
          }
        });
      }

      // 6. Log DEPOSIT_REFUND if there is any remaining refundable deposit
      if (refundableDeposit > 0) {
        await tx.depositLedgerTransaction.create({
          data: {
            tenantProfileId: profile.id,
            type: 'DEPOSIT_REFUND',
            amount: refundableDeposit,
            reason: 'Refundable security deposit balance paid to resident upon vacate settlement',
            createdBy: actorId
          }
        });
      }

      // 7. Update tenant profile status to PAST, null bed, store refund & deduction totals
      const updatedProfile = await tx.pGTenantProfile.update({
        where: { id: profile.id },
        data: {
          status: TenantStatus.PAST,
          moveOutDate: new Date(),
          bedId: null, // Free up the bed for future onboarding
          depositRefundedAmount: refundableDeposit,
          depositDeductionAmount: actualDeductionApplied,
          depositRefundedAt: refundableDeposit > 0 ? new Date() : null,
          depositRefundMode: refundableDeposit > 0 ? 'BANK_TRANSFER' : null,
          depositRefundNotes: refundableDeposit > 0 ? 'Automatic vacate settlement refund' : null,
          securityDepositStatus: 'REFUNDED',
          settlementStatus: 'SETTLED',
          updatedBy: actorId,
        }
      });

      // 8. Write Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RESIDENT_VACATED',
          entityType: 'PGTenantProfile',
          entityId: profile.id,
          metadata: {
            pgId,
            bedId: profile.bedId,
            collectedDeposit,
            totalDeductions,
            refundableDeposit,
            actualDeductionApplied
          }
        }
      });

      return { updatedProfile, originalBedId: profile.bedId };
    });

    // 9. Post-Transaction Events - ensure we use the original profile's bedId
    if (result.originalBedId) {
      await emitAndLogEvent(result.updatedProfile.id, EventType.TENANT_MOVED_OUT, { pgId, bedId: result.originalBedId });
      await emitAndLogEvent(result.updatedProfile.id, EventType.BED_VACATED, { pgId, bedId: result.originalBedId });
    }

    return result.updatedProfile;
  }
}
