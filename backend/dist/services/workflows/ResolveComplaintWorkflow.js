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
     * Resolves an existing complaint and handles damage recovery allocations, owner expenses, or split room charges.
     */
    static async execute(pgId, complaintId, actorId, repairCost, responsibility, assignedTenantId, billUrl, resolvedImageUrl, resolutionNotes, deductionItems, recoveryMethodInput = 'DEPOSIT' // DEPOSIT, CASH, UPI
    ) {
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Fetch complaint with resident profile
            const complaint = await tx.complaint.findUnique({
                where: { id: complaintId },
                include: {
                    tenantProfile: {
                        include: {
                            invoices: {
                                where: {
                                    type: 'SECURITY_DEPOSIT',
                                    status: 'PAID',
                                    isActive: true
                                }
                            },
                            damageRecoveries: {
                                where: {
                                    status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                                    recoveryMethod: 'DEPOSIT'
                                }
                            }
                        }
                    }
                }
            });
            if (!complaint) {
                throw new Error('Complaint not found.');
            }
            if (complaint.status === client_1.ComplaintStatus.RESOLVED) {
                return complaint; // Idempotent success
            }
            const tenantProfile = complaint.tenantProfile;
            // Rule 2 & Safeguard: Check Settlement Status Lock
            if (tenantProfile.settlementStatus === 'LOCKED') {
                throw new Error('Stay profile is LOCKED. No modifications allowed.');
            }
            const totalCost = repairCost || 0;
            const parsedDeductionItems = deductionItems || [];
            // 2. Process based on responsibility
            if (responsibility === 'OWNER') {
                // Create a PG Maintenance Expense (Rule 1)
                await tx.expense.create({
                    data: {
                        pgId,
                        category: 'MAINTENANCE_REPAIR',
                        amount: totalCost,
                        incurredAt: new Date(),
                        receiptUrl: billUrl || null,
                        createdBy: actorId
                    }
                });
            }
            else if (responsibility === 'SPECIFIC_RESIDENT') {
                const targetTenantId = assignedTenantId || complaint.pgTenantId;
                // Fetch target tenant stay details
                const targetProfile = await tx.pGTenantProfile.findUnique({
                    where: { id: targetTenantId },
                    include: {
                        invoices: {
                            where: {
                                type: 'SECURITY_DEPOSIT',
                                status: 'PAID',
                                isActive: true
                            }
                        },
                        damageRecoveries: {
                            where: {
                                status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                                recoveryMethod: 'DEPOSIT'
                            }
                        }
                    }
                });
                if (!targetProfile) {
                    throw new Error('Target resident profile not found.');
                }
                // Rule 2 & Safeguard: Check Settlement Lock on target profile
                if (targetProfile.settlementStatus === 'LOCKED') {
                    throw new Error('Target resident stay profile is LOCKED. Recovery cannot be attached.');
                }
                // Rule 3: Check if deposit already refunded
                if (targetProfile.status === client_1.TenantStatus.PAST && targetProfile.securityDepositStatus === 'REFUNDED') {
                    throw new Error('Deposit already settled. Recovery cannot be attached.');
                }
                // Calculate remaining refundable deposit
                const collectedDeposit = targetProfile.invoices.reduce((sum, inv) => sum + inv.amount, 0);
                const refundedAmount = targetProfile.depositRefundedAmount || 0;
                const previouslyDeducted = targetProfile.depositDeductionAmount || 0;
                const pendingRecoveries = targetProfile.damageRecoveries.reduce((sum, rec) => sum + rec.amount, 0);
                const remainingRefundableDeposit = Math.max(0, collectedDeposit - refundedAmount - previouslyDeducted - pendingRecoveries);
                let depositDeduction = 0;
                let outstanding = totalCost;
                let recoveryStatus = 'PENDING';
                if (recoveryMethodInput === 'DEPOSIT') {
                    depositDeduction = Math.min(totalCost, remainingRefundableDeposit);
                    outstanding = totalCost - depositDeduction;
                    recoveryStatus = outstanding > 0 ? (depositDeduction > 0 ? 'PARTIALLY_RECOVERED' : 'PENDING') : 'FULLY_RECOVERED';
                }
                // Create DamageRecovery entry
                const recovery = await tx.damageRecovery.create({
                    data: {
                        pgId,
                        complaintId: complaint.id,
                        tenantId: targetTenantId,
                        roomId: targetProfile.roomId,
                        bedId: targetProfile.bedId,
                        amount: totalCost,
                        amountReceived: depositDeduction,
                        totalAmount: totalCost,
                        recoveredAmount: depositDeduction,
                        outstandingAmount: outstanding,
                        reason: complaint.description || 'Damage Recovery',
                        resolutionNotes,
                        attachmentUrls: billUrl ? [billUrl] : [],
                        status: recoveryStatus,
                        recoveryMethod: recoveryMethodInput,
                        createdBy: actorId,
                        items: {
                            create: parsedDeductionItems.map(item => ({
                                title: item.title,
                                amount: item.amount,
                                notes: item.notes || null
                            }))
                        }
                    }
                });
                // Audit log for recovery creation
                await tx.auditLog.create({
                    data: {
                        actorId,
                        action: 'RECOVERY_CREATED',
                        entityType: 'DamageRecovery',
                        entityId: recovery.id,
                        metadata: {
                            timestamp: new Date(),
                            user: actorId,
                            action: 'RECOVERY_CREATED',
                            entity: 'DamageRecovery',
                            oldValue: null,
                            newValue: {
                                id: recovery.id,
                                totalAmount: totalCost,
                                recoveredAmount: depositDeduction,
                                outstandingAmount: outstanding,
                                status: recoveryStatus,
                                recoveryMethod: recoveryMethodInput
                            }
                        }
                    }
                });
                // If DEPOSIT deduction occurred, update profile & log transactions
                if (depositDeduction > 0) {
                    // Increment profile's depositDeductionAmount
                    await tx.pGTenantProfile.update({
                        where: { id: targetTenantId },
                        data: {
                            depositDeductionAmount: previouslyDeducted + depositDeduction,
                            updatedBy: actorId
                        }
                    });
                    // Generate DepositLedgerTransaction
                    const depositTx = await tx.depositLedgerTransaction.create({
                        data: {
                            tenantProfileId: targetTenantId,
                            recoveryId: recovery.id,
                            complaintId: complaint.id,
                            type: 'DEPOSIT_DEDUCTION',
                            amount: depositDeduction,
                            reason: complaint.description || 'Damage Deduction',
                            notes: resolutionNotes || null,
                            createdBy: actorId
                        }
                    });
                    // Generate RecoveryTransaction
                    await tx.recoveryTransaction.create({
                        data: {
                            recoveryId: recovery.id,
                            amount: depositDeduction,
                            paymentMethod: 'DEPOSIT',
                            notes: 'Automatically deducted from security deposit',
                            createdBy: actorId
                        }
                    });
                    // Audit log for deposit deduction
                    await tx.auditLog.create({
                        data: {
                            actorId,
                            action: 'DEPOSIT_DEDUCTED',
                            entityType: 'DepositLedgerTransaction',
                            entityId: depositTx.id,
                            metadata: {
                                timestamp: new Date(),
                                user: actorId,
                                action: 'DEPOSIT_DEDUCTED',
                                entity: 'DepositLedgerTransaction',
                                oldValue: null,
                                newValue: {
                                    tenantProfileId: targetTenantId,
                                    amount: depositDeduction,
                                    reason: complaint.description || 'Damage Deduction'
                                }
                            }
                        }
                    });
                }
            }
            else if (responsibility === 'ENTIRE_ROOM') {
                // Fetch all active/notice room occupants
                const occupants = await tx.pGTenantProfile.findMany({
                    where: {
                        roomId: tenantProfile.roomId,
                        status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.NOTICE] },
                        isActive: true
                    },
                    include: {
                        invoices: {
                            where: {
                                type: 'SECURITY_DEPOSIT',
                                status: 'PAID',
                                isActive: true
                            }
                        },
                        damageRecoveries: {
                            where: {
                                status: { in: ['PENDING', 'ACCEPTED', 'DISPUTED'] },
                                recoveryMethod: 'DEPOSIT'
                            }
                        }
                    }
                });
                if (occupants.length === 0) {
                    throw new Error('No current active occupants found in the room to split cost.');
                }
                const splitCost = totalCost / occupants.length;
                for (const occupant of occupants) {
                    // Rule 2 & Safeguard: Check Settlement Lock on occupant profile
                    if (occupant.settlementStatus === 'LOCKED') {
                        throw new Error(`Room occupant stay profile (${occupant.id}) is LOCKED. Recovery cannot be attached.`);
                    }
                    // Calculate remaining deposit balance for this roommate independently
                    const collectedDeposit = occupant.invoices.reduce((sum, inv) => sum + inv.amount, 0);
                    const refundedAmount = occupant.depositRefundedAmount || 0;
                    const previouslyDeducted = occupant.depositDeductionAmount || 0;
                    const pendingRecoveries = occupant.damageRecoveries.reduce((sum, rec) => sum + rec.amount, 0);
                    const remainingRefundableDeposit = Math.max(0, collectedDeposit - refundedAmount - previouslyDeducted - pendingRecoveries);
                    let depositDeduction = 0;
                    let outstanding = splitCost;
                    let recoveryStatus = 'PENDING';
                    if (recoveryMethodInput === 'DEPOSIT') {
                        depositDeduction = Math.min(splitCost, remainingRefundableDeposit);
                        outstanding = splitCost - depositDeduction;
                        recoveryStatus = outstanding > 0 ? (depositDeduction > 0 ? 'PARTIALLY_RECOVERED' : 'PENDING') : 'FULLY_RECOVERED';
                    }
                    // Create occupant's DamageRecovery entry
                    const recovery = await tx.damageRecovery.create({
                        data: {
                            pgId,
                            complaintId: complaint.id,
                            tenantId: occupant.id,
                            roomId: occupant.roomId,
                            bedId: occupant.bedId,
                            amount: splitCost,
                            amountReceived: depositDeduction,
                            totalAmount: splitCost,
                            recoveredAmount: depositDeduction,
                            outstandingAmount: outstanding,
                            reason: `Room Shared Damage Split: ${complaint.description || 'Damage'}`,
                            resolutionNotes,
                            attachmentUrls: billUrl ? [billUrl] : [],
                            status: recoveryStatus,
                            recoveryMethod: recoveryMethodInput,
                            createdBy: actorId,
                            items: {
                                create: parsedDeductionItems.map(item => ({
                                    title: `${item.title} (Split 1/${occupants.length})`,
                                    amount: item.amount / occupants.length,
                                    notes: item.notes || null
                                }))
                            }
                        }
                    });
                    // Audit log for recovery creation
                    await tx.auditLog.create({
                        data: {
                            actorId,
                            action: 'RECOVERY_CREATED',
                            entityType: 'DamageRecovery',
                            entityId: recovery.id,
                            metadata: {
                                timestamp: new Date(),
                                user: actorId,
                                action: 'RECOVERY_CREATED',
                                entity: 'DamageRecovery',
                                oldValue: null,
                                newValue: {
                                    id: recovery.id,
                                    totalAmount: splitCost,
                                    recoveredAmount: depositDeduction,
                                    outstandingAmount: outstanding,
                                    status: recoveryStatus,
                                    recoveryMethod: recoveryMethodInput
                                }
                            }
                        }
                    });
                    // If DEPOSIT deduction occurred, update profile & log transactions
                    if (depositDeduction > 0) {
                        // Increment profile's depositDeductionAmount
                        await tx.pGTenantProfile.update({
                            where: { id: occupant.id },
                            data: {
                                depositDeductionAmount: previouslyDeducted + depositDeduction,
                                updatedBy: actorId
                            }
                        });
                        // Generate DepositLedgerTransaction
                        const depositTx = await tx.depositLedgerTransaction.create({
                            data: {
                                tenantProfileId: occupant.id,
                                recoveryId: recovery.id,
                                complaintId: complaint.id,
                                type: 'DEPOSIT_DEDUCTION',
                                amount: depositDeduction,
                                reason: `Room Split Damage: ${complaint.description || 'Damage'}`,
                                notes: resolutionNotes || null,
                                createdBy: actorId
                            }
                        });
                        // Generate RecoveryTransaction
                        await tx.recoveryTransaction.create({
                            data: {
                                recoveryId: recovery.id,
                                amount: depositDeduction,
                                paymentMethod: 'DEPOSIT',
                                notes: 'Automatically deducted from security deposit',
                                createdBy: actorId
                            }
                        });
                        // Audit log for deposit deduction
                        await tx.auditLog.create({
                            data: {
                                actorId,
                                action: 'DEPOSIT_DEDUCTED',
                                entityType: 'DepositLedgerTransaction',
                                entityId: depositTx.id,
                                metadata: {
                                    timestamp: new Date(),
                                    user: actorId,
                                    action: 'DEPOSIT_DEDUCTED',
                                    entity: 'DepositLedgerTransaction',
                                    oldValue: null,
                                    newValue: {
                                        tenantProfileId: occupant.id,
                                        amount: depositDeduction,
                                        reason: `Room Split Damage: ${complaint.description || 'Damage'}`
                                    }
                                }
                            }
                        });
                    }
                }
            }
            // Update the complaint record as RESOLVED
            const updatedComplaint = await tx.complaint.update({
                where: { id: complaintId },
                data: {
                    status: client_1.ComplaintStatus.RESOLVED,
                    repairCost: totalCost,
                    responsibility: responsibility || null,
                    billUrl: billUrl || null,
                    resolvedImageUrl: resolvedImageUrl || null,
                    resolutionNotes: resolutionNotes || null,
                    resolvedAt: new Date(),
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
                    metadata: {
                        pgId,
                        tenantId: complaint.pgTenantId,
                        repairCost: totalCost,
                        responsibility,
                        billUrl,
                        notes: resolutionNotes
                    }
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