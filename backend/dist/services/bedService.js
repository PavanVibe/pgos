"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateBed = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const eventBus_1 = require("../events/eventBus");
const allocateBed = async (bedId, globalTenantId, pgId, securityDeposit, moveInDate, actorId) => {
    // Use Prisma transaction to ensure atomicity
    const profile = await prisma_1.default.$transaction(async (tx) => {
        // 1. Verify Bed is active and exists
        const bed = await tx.bed.findFirst({
            where: { id: bedId },
            include: { room: true }
        });
        if (!bed || bed.room.pgId !== pgId) {
            throw new Error('Bed not found or does not belong to this PG.');
        }
        // 2. Check for existing active allocation on this bed
        const existingAllocation = await tx.pGTenantProfile.findFirst({
            where: { bedId, status: 'ACTIVE' }
        });
        if (existingAllocation) {
            throw new Error('Bed is already occupied.');
        }
        // 3. Create PG Tenant Profile
        const newProfile = await tx.pGTenantProfile.create({
            data: {
                globalTenantId,
                pgId,
                bedId,
                roomId: bed.roomId,
                historicalRoomNumber: bed.room.number,
                historicalBedNumber: bed.bedNumber,
                securityDeposit,
                moveInDate,
                createdBy: actorId,
                updatedBy: actorId,
                status: 'ACTIVE'
            }
        });
        // 4. Create Audit Log inside transaction
        await tx.auditLog.create({
            data: {
                actorId,
                action: 'BED_ALLOCATED',
                entityType: 'PGTenantProfile',
                entityId: newProfile.id,
                metadata: { bedId, globalTenantId, pgId }
            }
        });
        return newProfile;
    });
    // Emit event outside transaction to avoid blocking
    await (0, eventBus_1.emitAndLogEvent)(profile.id, eventBus_1.CoreEvents.BED_ALLOCATED, { pgId, bedId, globalTenantId });
    return profile;
};
exports.allocateBed = allocateBed;
//# sourceMappingURL=bedService.js.map