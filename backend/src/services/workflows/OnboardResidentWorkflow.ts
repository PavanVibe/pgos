import prisma from '../../utils/prisma';
import { emitAndLogEvent } from '../../events/eventBus';
import { BedLockService } from '../locks/BedLockService';
import { TenantStatus, InvoiceStatus } from '@prisma/client';
import { EventType } from '../../types/eventTypes';

export class OnboardResidentWorkflow {
  /**
   * Executes the complete transaction-safe resident onboarding.
   */
  static async execute(
    pgId: string,
    bedId: string,
    phone: string,
    name: string,
    email: string | undefined,
    moveInDate: Date,
    monthlyRent: number,
    securityDeposit: number,
    actorId: string,
    isQuickAdd = false,
    kycDocUrl?: string,
    bypassEmailCheck = false,
    transferResident = false,
    depositCollected = false,
    depositPaymentMode?: string,
    depositCollectedAt?: Date
  ) {
    // 1. Concurrency Check: Check & acquire Redis lock
    const isAllowed = await BedLockService.canMutate(bedId, actorId);
    if (!isAllowed) {
      throw new Error('This bed is currently locked by another operator.');
    }

    // Attempt to acquire lock if not already held
    await BedLockService.acquireLock(bedId, actorId);

    try {
      // 2. Atomic Transaction
      const result = await prisma.$transaction(async (tx) => {
        // Validate Bed availability inside the transaction to prevent concurrent race conditions
        const existingAllocation = await tx.pGTenantProfile.findFirst({
          where: {
            bedId,
            status: {
              in: [TenantStatus.ACTIVE, TenantStatus.INCOMPLETE, TenantStatus.NOTICE]
            }
          }
        });
        if (existingAllocation) {
          throw new Error('Bed already occupied. Refresh occupancy map.');
        }

        // Clean values
        const cleanPhone = phone.replace(/\s/g, '');
        const cleanEmail = email ? email.trim() : undefined;

        // Fetch existing tenants
        const tenantByPhone = await tx.globalTenant.findUnique({
          where: { phone: cleanPhone }
        });

        const tenantByEmail = cleanEmail
          ? await tx.globalTenant.findUnique({ where: { email: cleanEmail } })
          : null;

        // Block identity mismatch (Rule 3)
        if (tenantByPhone && tenantByEmail && tenantByPhone.id !== tenantByEmail.id) {
          throw new Error('CONFLICT_DIFFERENT_RECORDS');
        }

        // Check for active stays on the resolved/matching tenant BEFORE creating a new profile
        const matchedTenant = tenantByPhone || tenantByEmail;
        if (matchedTenant) {
          const activeStay = await tx.pGTenantProfile.findFirst({
            where: {
              globalTenantId: matchedTenant.id,
              status: { in: [TenantStatus.ACTIVE, TenantStatus.NOTICE] }
            },
            include: { room: true, bed: true }
          });

          if (activeStay) {
            if (!transferResident) {
              const activeRoomNum = activeStay.historicalRoomNumber || activeStay.room?.number || 'N/A';
              const activeBedLabel = activeStay.historicalBedNumber || activeStay.bed?.bedNumber || 'N/A';
              throw new Error(`WARNING_ACTIVE_OCCUPANCY:${activeRoomNum}:${activeBedLabel}:${activeStay.id}`);
            }

            // Auto-transfer: vacate from old bed
            await tx.pGTenantProfile.update({
              where: { id: activeStay.id },
              data: {
                status: TenantStatus.PAST,
                moveOutDate: new Date(),
                bedId: null, // Free the old bed
                updatedBy: actorId,
              }
            });

            // Write transfer audit log
            await tx.auditLog.create({
              data: {
                actorId,
                action: 'RESIDENT_TRANSFERRED_OUT',
                entityType: 'PGTenantProfile',
                entityId: activeStay.id,
                metadata: { pgId, bedId: activeStay.bedId }
              }
            });
          }
        }

        let globalTenant;

        if (tenantByPhone) {
          // Rule 1: Phone Match
          // Do NOT mutate or overwrite existing email or name if they are already present!
          let updatedEmail = tenantByPhone.email;
          if (!updatedEmail && cleanEmail) {
            updatedEmail = cleanEmail;
          }
          globalTenant = await tx.globalTenant.update({
            where: { id: tenantByPhone.id },
            data: {
              name: tenantByPhone.name || name, // Keep existing name
              email: updatedEmail,
              kycDocUrl: kycDocUrl || tenantByPhone.kycDocUrl
            }
          });
        } else if (tenantByEmail) {
          // Rule 2: Email Match Only
          if (!bypassEmailCheck) {
            throw new Error(`WARNING_EMAIL_EXISTS:${tenantByEmail.id}:${tenantByEmail.name || 'Unknown'}:${tenantByEmail.phone}:${tenantByEmail.email || ''}`);
          }
          // Reuse existing resident - owner explicitly clicked Reuse, so they consent to updating phone
          globalTenant = await tx.globalTenant.update({
            where: { id: tenantByEmail.id },
            data: {
              phone: cleanPhone, // Consent given
              name: tenantByEmail.name || name, // Keep existing name
              kycDocUrl: kycDocUrl || tenantByEmail.kycDocUrl
            }
          });
        } else {
          // Rule 4: No Match
          globalTenant = await tx.globalTenant.create({
            data: {
              phone: cleanPhone,
              name,
              email: cleanEmail,
              kycDocUrl
            }
          });
        }

        // Fetch bed to resolve parent room number and roomId
        const bed = await tx.bed.findUnique({
          where: { id: bedId },
          include: { room: true }
        });
        if (!bed) {
          throw new Error('Bed not found.');
        }

        // Create PGTenantProfile
        const profile = await tx.pGTenantProfile.create({
          data: {
            globalTenantId: globalTenant.id,
            pgId,
            bedId,
            roomId: bed.roomId,
            historicalRoomNumber: bed.room.number,
            historicalBedNumber: bed.bedNumber,
            status: isQuickAdd ? TenantStatus.INCOMPLETE : TenantStatus.ACTIVE,
            monthlyRent,
            securityDeposit,
            securityDepositStatus: depositCollected ? 'COLLECTED' : 'PENDING',
            depositCollectedAt: depositCollected ? (depositCollectedAt || new Date()) : null,
            createdBy: actorId,
            updatedBy: actorId,
          }
        });

        // 1. Create first month's Rent Invoice
        await tx.rentInvoice.create({
          data: {
            pgTenantId: profile.id,
            amount: monthlyRent,
            dueDate: moveInDate,
            status: InvoiceStatus.PENDING,
            type: 'RENT',
            createdBy: actorId,
            updatedBy: actorId,
          }
        });

        // 2. Create Security Deposit Invoice
        await tx.rentInvoice.create({
          data: {
            pgTenantId: profile.id,
            amount: securityDeposit,
            dueDate: moveInDate,
            status: depositCollected ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
            paidAt: depositCollected ? (depositCollectedAt || new Date()) : null,
            paymentMode: depositCollected ? (depositPaymentMode || 'CASH') : null,
            type: 'SECURITY_DEPOSIT',
            createdBy: actorId,
            updatedBy: actorId,
          }
        });

        // Create Analytics Entry
        const pg = await tx.pG.findUnique({ where: { id: pgId } });
        await tx.onboardingAnalytics.create({
          data: {
            organizationId: pg?.organizationId || '',
            pgId,
            actorId,
            status: 'SUCCESS',
            isQuickAdd,
          }
        });

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'RESIDENT_ONBOARDED',
            entityType: 'PGTenantProfile',
            entityId: profile.id,
            metadata: { pgId, bedId }
          }
        });

        return profile;
      });

      // 3. Post-Transaction Events
      await emitAndLogEvent(result.id, EventType.TENANT_MOVED_IN, { pgId, bedId });
      await emitAndLogEvent(result.id, EventType.BED_ALLOCATED, { pgId, bedId });

      return result;
    } finally {
      // 4. Always release Redis lock in finally block to avoid deadlocks
      await BedLockService.releaseLock(bedId, actorId);
    }
  }
}
