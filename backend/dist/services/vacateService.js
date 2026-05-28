"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vacateResident = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const eventBus_1 = require("../events/eventBus");
const client_1 = require("@prisma/client");
const vacateResident = async (tenantId, pgId, actorId) => {
    const result = await prisma_1.default.$transaction(async (tx) => {
        const profile = await tx.pGTenantProfile.findFirst({
            where: { id: tenantId, pgId, status: client_1.TenantStatus.ACTIVE }
        });
        if (!profile) {
            throw new Error('Active tenant profile not found.');
        }
        // Update profile
        const updatedProfile = await tx.pGTenantProfile.update({
            where: { id: profile.id },
            data: {
                status: client_1.TenantStatus.PAST,
                moveOutDate: new Date(),
                updatedBy: actorId,
            }
        });
        // Create Audit Log
        await tx.auditLog.create({
            data: {
                actorId,
                action: 'RESIDENT_VACATED',
                entityType: 'PGTenantProfile',
                entityId: profile.id,
            }
        });
        return updatedProfile;
    });
    // Emit event
    await (0, eventBus_1.emitAndLogEvent)(result.id, eventBus_1.CoreEvents.TENANT_MOVED_OUT, { pgId, bedId: result.bedId });
    return result;
};
exports.vacateResident = vacateResident;
//# sourceMappingURL=vacateService.js.map