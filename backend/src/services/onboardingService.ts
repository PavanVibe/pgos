import prisma from '../utils/prisma';
import { emitAndLogEvent, CoreEvents } from '../events/eventBus';
import { canAllocateBed, releaseBedLock } from './lockService';
import { TenantStatus, InvoiceStatus } from '@prisma/client';

export const onboardResident = async (
  pgId: string,
  bedId: string,
  phone: string,
  name: string,
  email: string | undefined,
  moveInDate: Date,
  monthlyRent: number,
  securityDeposit: number,
  actorId: string,
  isQuickAdd: boolean = false
) => {
  // 1. Check Redis Lock
  const isAllowed = await canAllocateBed(bedId, actorId);
  if (!isAllowed) {
    throw new Error('This bed is currently locked by another operator.');
  }

  // 2. Atomic Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Fetch bed and parent room
    const bed = await tx.bed.findUnique({
      where: { id: bedId },
      include: { room: true }
    });
    if (!bed) {
      throw new Error('Bed not found.');
    }

    // Validate bed availability
    const existingAllocation = await tx.pGTenantProfile.findFirst({
      where: { bedId, status: 'ACTIVE' }
    });
    if (existingAllocation) {
      throw new Error('Bed is already occupied.');
    }

    // Upsert Global Tenant
    const globalTenant = await tx.globalTenant.upsert({
      where: { phone },
      update: { name, email },
      create: { phone, name, email }
    });

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

    // Create Rent Invoice for first month
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

    const pg = await tx.pG.findUnique({ where: { id: pgId } });
    // Create Analytics Entry
    await tx.onboardingAnalytics.create({
      data: {
        organizationId: pg?.organizationId || '',
        pgId,
        actorId,
        status: 'SUCCESS',
        isQuickAdd,
      }
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RESIDENT_ONBOARDED',
        entityType: 'PGTenantProfile',
        entityId: profile.id,
      }
    });

    return profile;
  });

  // 3. Post-transaction Cleanup & Events
  await releaseBedLock(bedId, actorId);
  await emitAndLogEvent(result.id, CoreEvents.TENANT_MOVED_IN, { pgId, bedId });
  
  return result;
};
