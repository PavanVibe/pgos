"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardResident = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const eventBus_1 = require("../events/eventBus");
const lockService_1 = require("./lockService");
const client_1 = require("@prisma/client");
const onboardResident = async (pgId, bedId, phone, name, email, moveInDate, monthlyRent, securityDeposit, actorId, isQuickAdd = false) => {
    // 1. Check Redis Lock
    const isAllowed = await (0, lockService_1.canAllocateBed)(bedId, actorId);
    if (!isAllowed) {
        throw new Error('This bed is currently locked by another operator.');
    }
    // 2. Atomic Transaction
    const result = await prisma_1.default.$transaction(async (tx) => {
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
                status: isQuickAdd ? client_1.TenantStatus.INCOMPLETE : client_1.TenantStatus.ACTIVE,
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
                status: client_1.InvoiceStatus.PENDING,
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
    await (0, lockService_1.releaseBedLock)(bedId, actorId);
    await (0, eventBus_1.emitAndLogEvent)(result.id, eventBus_1.CoreEvents.TENANT_MOVED_IN, { pgId, bedId });
    return result;
};
exports.onboardResident = onboardResident;
//# sourceMappingURL=onboardingService.js.map