"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayDepositWorkflow = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const eventBus_1 = require("../../events/eventBus");
const PaymentLockService_1 = require("../locks/PaymentLockService");
const client_1 = require("@prisma/client");
const eventTypes_1 = require("../../types/eventTypes");
class PayDepositWorkflow {
    /**
     * Records a security deposit payment transaction, settling a pending deposit invoice for a resident.
     */
    static async execute(pgId, tenantId, method, actorId, amount, invoiceId, referenceId) {
        // 1. Concurrency Check: Prevent duplicate payment submits on this tenant
        const lockAcquired = await PaymentLockService_1.PaymentLockService.acquireLock(tenantId, actorId);
        if (!lockAcquired) {
            throw new Error('A payment is currently being processed for this resident. Please wait.');
        }
        try {
            // 2. Find the specific deposit invoice or the oldest pending deposit invoice
            const invoice = invoiceId
                ? await prisma_1.default.rentInvoice.findFirst({
                    where: {
                        id: invoiceId,
                        pgTenantId: tenantId,
                        type: 'SECURITY_DEPOSIT',
                        status: { in: [client_1.InvoiceStatus.PENDING, client_1.InvoiceStatus.PAST_DUE] }
                    }
                })
                : await prisma_1.default.rentInvoice.findFirst({
                    where: {
                        pgTenantId: tenantId,
                        type: 'SECURITY_DEPOSIT',
                        status: { in: [client_1.InvoiceStatus.PENDING, client_1.InvoiceStatus.PAST_DUE] }
                    },
                    orderBy: { dueDate: 'asc' }
                });
            if (!invoice) {
                throw new Error('No pending security deposit invoices found for this resident.');
            }
            // 3. Process database transaction
            const result = await prisma_1.default.$transaction(async (tx) => {
                const paymentAmount = amount !== undefined && amount !== null ? Math.min(amount, invoice.amount) : invoice.amount;
                const isPartial = paymentAmount < invoice.amount;
                // Update Invoice status to PAID
                const updatedInvoice = await tx.rentInvoice.update({
                    where: { id: invoice.id },
                    data: {
                        status: client_1.InvoiceStatus.PAID,
                        amount: paymentAmount, // actual amount received
                        paidAt: new Date(),
                        paymentMode: method,
                        referenceId: referenceId,
                        updatedBy: actorId,
                    }
                });
                // If it is partial payment, create a new child invoice for the remaining dues
                if (isPartial) {
                    const remainingAmount = invoice.amount - paymentAmount;
                    await tx.rentInvoice.create({
                        data: {
                            pgTenantId: tenantId,
                            amount: remainingAmount,
                            dueDate: invoice.dueDate,
                            status: invoice.status, // preserve status (PENDING or PAST_DUE)
                            type: 'SECURITY_DEPOSIT',
                            razorpayOrdId: `split_parent_deposit:${invoice.id}`,
                            createdBy: actorId,
                            updatedBy: actorId,
                        }
                    });
                }
                // Fetch all PAID deposit invoices for this tenant to compute overall collected deposit
                const paidDepositInvoices = await tx.rentInvoice.findMany({
                    where: {
                        pgTenantId: tenantId,
                        type: 'SECURITY_DEPOSIT',
                        status: 'PAID',
                        isActive: true
                    }
                });
                const totalPaidDeposit = paidDepositInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                // Fetch parent stay profile to verify expected security deposit
                const profile = await tx.pGTenantProfile.findUnique({
                    where: { id: tenantId }
                });
                if (profile) {
                    const expectedDeposit = profile.securityDeposit;
                    let newStatus = 'PENDING';
                    if (totalPaidDeposit >= expectedDeposit) {
                        newStatus = 'COLLECTED';
                    }
                    else if (totalPaidDeposit > 0) {
                        newStatus = 'PARTIALLY_PAID';
                    }
                    // Update parent profile status
                    await tx.pGTenantProfile.update({
                        where: { id: tenantId },
                        data: {
                            securityDepositStatus: newStatus,
                            depositCollectedAt: newStatus === 'COLLECTED' || newStatus === 'PARTIALLY_PAID' ? new Date() : null,
                            updatedBy: actorId
                        }
                    });
                }
                // Write Audit Log
                await tx.auditLog.create({
                    data: {
                        actorId,
                        action: isPartial ? 'DEPOSIT_PARTIAL_PAID' : 'DEPOSIT_PAID',
                        entityType: 'RentInvoice',
                        entityId: invoice.id,
                        metadata: {
                            pgId,
                            tenantId,
                            method,
                            amountPaid: paymentAmount,
                            originalAmount: invoice.amount,
                            isPartial,
                            childRemainingAmount: isPartial ? (invoice.amount - paymentAmount) : 0
                        }
                    }
                });
                return updatedInvoice;
            });
            // 4. Emit event log
            await (0, eventBus_1.emitAndLogEvent)(result.id, eventTypes_1.EventType.DEPOSIT_PAID, {
                pgId,
                tenantId,
                amount: result.amount,
                method
            });
            return result;
        }
        finally {
            // 5. Always release payment lock
            await PaymentLockService_1.PaymentLockService.releaseLock(tenantId, actorId);
        }
    }
}
exports.PayDepositWorkflow = PayDepositWorkflow;
//# sourceMappingURL=PayDepositWorkflow.js.map