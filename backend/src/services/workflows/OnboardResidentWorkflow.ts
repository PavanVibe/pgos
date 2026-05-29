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
    bypassEmailCheck = false
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

        let globalTenant;

        if (tenantByPhone && tenantByEmail && tenantByPhone.id !== tenantByEmail.id) {
          // Rule 3: Identity Mismatch
          throw new Error('CONFLICT_DIFFERENT_RECORDS');
        } else if (tenantByPhone) {
          // Rule 1: Phone Match
          // Do not silently overwrite existing email if it differs
          let updatedEmail = tenantByPhone.email;
          if (!updatedEmail && cleanEmail) {
            updatedEmail = cleanEmail;
          }
          globalTenant = await tx.globalTenant.update({
            where: { id: tenantByPhone.id },
            data: {
              name: name || tenantByPhone.name,
              email: updatedEmail,
              kycDocUrl: kycDocUrl || tenantByPhone.kycDocUrl
            }
          });
        } else if (tenantByEmail) {
          // Rule 2: Email Match Only
          if (!bypassEmailCheck) {
            throw new Error(`WARNING_EMAIL_EXISTS:${tenantByEmail.id}:${tenantByEmail.name || 'Unknown'}:${tenantByEmail.phone}:${tenantByEmail.email || ''}`);
          }
          // If bypassEmailCheck is true, reuse and update the profile with the new phone
          globalTenant = await tx.globalTenant.update({
            where: { id: tenantByEmail.id },
            data: {
              phone: cleanPhone,
              name: name || tenantByEmail.name,
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
            securityDeposit,
            moveInDate,
            createdBy: actorId,
            updatedBy: actorId,
          }
        });

        // Create initial Rent Invoice
        const invoiceAmount = monthlyRent + securityDeposit;
        await tx.rentInvoice.create({
          data: {
            pgTenantId: profile.id,
            amount: invoiceAmount,
            dueDate: new Date(), // Due immediately
            status: InvoiceStatus.PENDING,
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
