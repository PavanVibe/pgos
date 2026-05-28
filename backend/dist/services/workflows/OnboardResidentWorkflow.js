"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardResidentWorkflow = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const eventBus_1 = require("../../events/eventBus");
const BedLockService_1 = require("../locks/BedLockService");
const client_1 = require("@prisma/client");
const eventTypes_1 = require("../../types/eventTypes");
class OnboardResidentWorkflow {
    /**
     * Executes the complete transaction-safe resident onboarding.
     */
    static async execute(pgId, bedId, phone, name, email, moveInDate, monthlyRent, securityDeposit, actorId, isQuickAdd = false, kycDocUrl) {
        // 1. Concurrency Check: Check & acquire Redis lock
        const isAllowed = await BedLockService_1.BedLockService.canMutate(bedId, actorId);
        if (!isAllowed) {
            throw new Error('This bed is currently locked by another operator.');
        }
        // Attempt to acquire lock if not already held
        await BedLockService_1.BedLockService.acquireLock(bedId, actorId);
        try {
            // 2. Atomic Transaction
            const result = await prisma_1.default.$transaction(async (tx) => {
                // Validate Bed availability inside the transaction to prevent concurrent race conditions
                const existingAllocation = await tx.pGTenantProfile.findFirst({
                    where: {
                        bedId,
                        status: {
                            in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.INCOMPLETE, client_1.TenantStatus.NOTICE]
                        }
                    }
                });
                if (existingAllocation) {
                    throw new Error('Bed already occupied. Refresh occupancy map.');
                }
                // Upsert Global Tenant by phone
                const cleanPhone = phone.replace(/\s/g, '');
                const globalTenant = await tx.globalTenant.upsert({
                    where: { phone: cleanPhone },
                    update: { name, email, kycDocUrl },
                    create: { phone: cleanPhone, name, email, kycDocUrl }
                });
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
                        status: isQuickAdd ? client_1.TenantStatus.INCOMPLETE : client_1.TenantStatus.ACTIVE,
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
                        status: client_1.InvoiceStatus.PENDING,
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
            await (0, eventBus_1.emitAndLogEvent)(result.id, eventTypes_1.EventType.TENANT_MOVED_IN, { pgId, bedId });
            await (0, eventBus_1.emitAndLogEvent)(result.id, eventTypes_1.EventType.BED_ALLOCATED, { pgId, bedId });
            return result;
        }
        finally {
            // 4. Always release Redis lock in finally block to avoid deadlocks
            await BedLockService_1.BedLockService.releaseLock(bedId, actorId);
        }
    }
}
exports.OnboardResidentWorkflow = OnboardResidentWorkflow;
//# sourceMappingURL=OnboardResidentWorkflow.js.map