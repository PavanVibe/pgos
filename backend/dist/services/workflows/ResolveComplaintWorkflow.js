"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveComplaintWorkflow = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const eventBus_1 = require("../../events/eventBus");
const client_1 = require("@prisma/client");
const eventTypes_1 = require("../../types/eventTypes");
class ResolveComplaintWorkflow {
    /**
     * Resolves a pending complaint.
     */
    static async execute(pgId, complaintId, actorId) {
        const result = await prisma_1.default.$transaction(async (tx) => {
            const complaint = await tx.complaint.findUnique({
                where: { id: complaintId }
            });
            if (!complaint) {
                throw new Error('Complaint not found.');
            }
            if (complaint.status === client_1.ComplaintStatus.RESOLVED) {
                return complaint; // Idempotent success
            }
            // Update complaint status to RESOLVED
            const updatedComplaint = await tx.complaint.update({
                where: { id: complaintId },
                data: {
                    status: client_1.ComplaintStatus.RESOLVED,
                    updatedBy: actorId,
                }
            });
            // Write Audit Log
            await tx.auditLog.create({
                data: {
                    actorId,
                    action: 'COMPLAINT_RESOLVED',
                    entityType: 'Complaint',
                    entityId: complaintId,
                    metadata: { pgId, tenantId: complaint.pgTenantId }
                }
            });
            return updatedComplaint;
        });
        // Emit event log
        await (0, eventBus_1.emitAndLogEvent)(result.id, eventTypes_1.EventType.COMPLAINT_RESOLVED, {
            pgId,
            complaintId,
            tenantId: result.pgTenantId
        });
        return result;
    }
}
exports.ResolveComplaintWorkflow = ResolveComplaintWorkflow;
//# sourceMappingURL=ResolveComplaintWorkflow.js.map