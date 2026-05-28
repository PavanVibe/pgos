"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaiseComplaintWorkflow = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const eventBus_1 = require("../../events/eventBus");
const client_1 = require("@prisma/client");
const eventTypes_1 = require("../../types/eventTypes");
class RaiseComplaintWorkflow {
    /**
     * Raises a new complaint, resolving the tenant ID dynamically from room number or fallbacks.
     */
    static async execute(pgId, roomOrArea, description, priority, category, actorId = 'system') {
        // 1. Resolve PGTenantProfile dynamically
        // Clean and check room number
        const cleanRoomName = roomOrArea.replace(/room/gi, '').trim();
        let tenantProfile = await prisma_1.default.pGTenantProfile.findFirst({
            where: {
                pgId,
                status: 'ACTIVE',
                bed: { room: { number: { equals: cleanRoomName, mode: 'insensitive' } } }
            }
        });
        // If no active tenant in that room, fall back to search room with partial match
        if (!tenantProfile) {
            tenantProfile = await prisma_1.default.pGTenantProfile.findFirst({
                where: {
                    pgId,
                    status: 'ACTIVE',
                    bed: { room: { number: { contains: cleanRoomName, mode: 'insensitive' } } }
                }
            });
        }
        // Secondary fallback: find the first active resident in the entire PG
        if (!tenantProfile) {
            tenantProfile = await prisma_1.default.pGTenantProfile.findFirst({
                where: { pgId, status: 'ACTIVE' }
            });
        }
        // Tertiary fallback: if there are no active residents in the PG at all, return an error
        if (!tenantProfile) {
            throw new Error('No active residents found in this PG. A complaint must be filed by or for a resident.');
        }
        // Map priorities to database ComplaintPriority enum
        let dbPriority = client_1.ComplaintPriority.LOW;
        const lowerPriority = priority.toLowerCase();
        if (lowerPriority === 'high')
            dbPriority = client_1.ComplaintPriority.HIGH;
        else if (lowerPriority === 'urgent')
            dbPriority = client_1.ComplaintPriority.URGENT;
        // Map medium to low or high depending on preference - let's keep it as low or map to HIGH
        else if (lowerPriority === 'medium')
            dbPriority = client_1.ComplaintPriority.HIGH;
        // SLA is 48 hours from now
        const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
        // 2. Database transaction
        const result = await prisma_1.default.$transaction(async (tx) => {
            const complaint = await tx.complaint.create({
                data: {
                    pgId,
                    pgTenantId: tenantProfile.id,
                    category: category || 'MAINTENANCE',
                    description: `[${roomOrArea}] ${description}`,
                    priority: dbPriority,
                    status: client_1.ComplaintStatus.PENDING,
                    slaDeadline,
                    createdBy: actorId,
                    updatedBy: actorId,
                }
            });
            // Write Audit Log
            await tx.auditLog.create({
                data: {
                    actorId,
                    action: 'COMPLAINT_RAISED',
                    entityType: 'Complaint',
                    entityId: complaint.id,
                    metadata: { pgId, tenantId: tenantProfile.id, roomOrArea }
                }
            });
            return complaint;
        });
        // 3. Emit event log
        await (0, eventBus_1.emitAndLogEvent)(result.id, eventTypes_1.EventType.COMPLAINT_CREATED, {
            pgId,
            tenantId: tenantProfile.id,
            roomOrArea,
            description
        });
        return result;
    }
}
exports.RaiseComplaintWorkflow = RaiseComplaintWorkflow;
//# sourceMappingURL=RaiseComplaintWorkflow.js.map