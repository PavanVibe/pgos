"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VacateResidentWorkflow = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const eventBus_1 = require("../../events/eventBus");
const client_1 = require("@prisma/client");
const eventTypes_1 = require("../../types/eventTypes");
class VacateResidentWorkflow {
    /**
     * Safe transaction-wrapped workflow to vacate a resident.
     */
    static async execute(pgId, tenantId, actorId) {
        const result = await prisma_1.default.$transaction(async (tx) => {
            const profile = await tx.pGTenantProfile.findFirst({
                where: { id: tenantId, pgId, status: client_1.TenantStatus.ACTIVE }
            });
            if (!profile) {
                throw new Error('Active tenant profile not found.');
            }
            // Update tenant profile status to PAST
            const updatedProfile = await tx.pGTenantProfile.update({
                where: { id: profile.id },
                data: {
                    status: client_1.TenantStatus.PAST,
                    moveOutDate: new Date(),
                    bedId: null, // Free up the bed for future onboarding
                    updatedBy: actorId,
                }
            });
            // Write Audit Log
            await tx.auditLog.create({
                data: {
                    actorId,
                    action: 'RESIDENT_VACATED',
                    entityType: 'PGTenantProfile',
                    entityId: profile.id,
                    metadata: { pgId, bedId: profile.bedId } // Capture original bedId before nulling
                }
            });
            return { updatedProfile, originalBedId: profile.bedId };
        });
        // Post-Transaction Events - ensure we use the original profile's bedId
        if (result.originalBedId) {
            await (0, eventBus_1.emitAndLogEvent)(result.updatedProfile.id, eventTypes_1.EventType.TENANT_MOVED_OUT, { pgId, bedId: result.originalBedId });
            await (0, eventBus_1.emitAndLogEvent)(result.updatedProfile.id, eventTypes_1.EventType.BED_VACATED, { pgId, bedId: result.originalBedId });
        }
        return result.updatedProfile;
    }
}
exports.VacateResidentWorkflow = VacateResidentWorkflow;
//# sourceMappingURL=VacateResidentWorkflow.js.map