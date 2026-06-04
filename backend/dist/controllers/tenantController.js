"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPGResidents = exports.updateResidentProfile = exports.settleMoveout = exports.getResidentProfile = exports.vacate = exports.lockBedForOnboarding = exports.onboard = exports.searchByPhone = void 0;
const tenantService_1 = require("../services/tenantService");
const OnboardResidentWorkflow_1 = require("../services/workflows/OnboardResidentWorkflow");
const VacateResidentWorkflow_1 = require("../services/workflows/VacateResidentWorkflow");
const lockService_1 = require("../services/lockService");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
const searchByPhone = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        const tenant = await (0, tenantService_1.searchTenantByPhone)(phone);
        if (!tenant) {
            return res.status(404).json({ status: 'not_found' });
        }
        res.status(200).json({ status: 'success', data: tenant });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.searchByPhone = searchByPhone;
const onboardSchema = zod_1.z.object({
    bedId: zod_1.z.string(),
    phone: zod_1.z.string().min(10),
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    moveInDate: zod_1.z.string(),
    monthlyRent: zod_1.z.number().positive(),
    securityDeposit: zod_1.z.number().nonnegative(),
    isQuickAdd: zod_1.z.boolean().default(false),
    kycDocUrl: zod_1.z.string().optional(),
    bypassEmailCheck: zod_1.z.boolean().optional(),
    transferResident: zod_1.z.boolean().optional(),
    depositCollected: zod_1.z.boolean().default(false),
    depositPaymentMode: zod_1.z.string().optional(),
    depositCollectedAt: zod_1.z.string().optional()
});
const onboard = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const actorId = req.auth?.userId || 'system';
        const payload = onboardSchema.parse(req.body);
        // Pre-flight database check to see if the bed is already occupied by an active, notice, or incomplete profile
        const activeProfile = await prisma_1.default.pGTenantProfile.findFirst({
            where: {
                bedId: payload.bedId,
                status: {
                    in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.INCOMPLETE, client_1.TenantStatus.NOTICE]
                }
            }
        });
        if (activeProfile) {
            return res.status(409).json({ error: 'Bed already occupied. Refresh occupancy map.' });
        }
        const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pgId, payload.bedId, payload.phone, payload.name, payload.email || undefined, new Date(payload.moveInDate), payload.monthlyRent, payload.securityDeposit, actorId, payload.isQuickAdd, payload.kycDocUrl, payload.bypassEmailCheck || false, payload.transferResident || false, payload.depositCollected, payload.depositPaymentMode, payload.depositCollectedAt ? new Date(payload.depositCollectedAt) : undefined);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        if (error.message && error.message.includes('already occupied')) {
            return res.status(409).json({ error: error.message });
        }
        if (error.message && error.message.startsWith('WARNING_ACTIVE_OCCUPANCY:')) {
            const parts = error.message.split(':');
            return res.status(200).json({
                status: 'warning',
                code: 'ACTIVE_OCCUPANCY',
                allocation: {
                    roomNumber: parts[1],
                    bedLabel: parts[2],
                    profileId: parts[3]
                }
            });
        }
        if (error.message && error.message.startsWith('WARNING_EMAIL_EXISTS:')) {
            const parts = error.message.split(':');
            return res.status(200).json({
                status: 'warning',
                code: 'EMAIL_EXISTS',
                tenant: {
                    id: parts[1],
                    name: parts[2],
                    phone: parts[3],
                    email: parts[4]
                }
            });
        }
        if (error.message && error.message === 'CONFLICT_DIFFERENT_RECORDS') {
            return res.status(409).json({
                error: 'Conflict: Phone number belongs to one resident, while email belongs to another. Automatic merge blocked.'
            });
        }
        res.status(400).json({ error: error.message });
    }
};
exports.onboard = onboard;
const lockBedForOnboarding = async (req, res) => {
    try {
        const { bedId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const success = await (0, lockService_1.lockBed)(bedId, actorId);
        if (!success) {
            return res.status(409).json({ error: 'Bed is currently locked by another operation.' });
        }
        res.status(200).json({ status: 'success', message: 'Bed locked for 5 minutes.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.lockBedForOnboarding = lockBedForOnboarding;
const vacate = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const { tenantId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const profile = await VacateResidentWorkflow_1.VacateResidentWorkflow.execute(pgId, tenantId, actorId);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.vacate = vacate;
const getResidentProfile = async (req, res) => {
    try {
        const { profileId } = req.params;
        if (!profileId) {
            return res.status(400).json({ error: 'profileId is required.' });
        }
        const profile = await prisma_1.default.pGTenantProfile.findUnique({
            where: { id: profileId },
            include: {
                globalTenant: true,
                bed: {
                    include: {
                        room: true
                    }
                },
                room: true,
                invoices: {
                    orderBy: { dueDate: 'desc' }
                },
                complaints: {
                    orderBy: { createdAt: 'desc' }
                },
                damageRecoveries: {
                    include: { items: true },
                    orderBy: { createdAt: 'desc' }
                },
                paymentReceipts: {
                    orderBy: { paymentDate: 'desc' }
                }
            }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Resident stay profile not found.' });
        }
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getResidentProfile = getResidentProfile;
const settleMoveout = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const { tenantId } = req.params;
        const { action, amount, paymentMode } = req.body;
        const actorId = req.auth?.userId || 'system';
        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required.' });
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const profile = await tx.pGTenantProfile.findUnique({
                where: { id: tenantId },
                include: {
                    invoices: { where: { isActive: true } },
                    damageRecoveries: { where: { status: { in: ['PENDING', 'PARTIALLY_RECOVERED', 'DISPUTED', 'ACCEPTED'] } } }
                }
            });
            if (!profile) {
                throw new Error('Resident stay profile not found.');
            }
            if (action === 'COLLECT') {
                let remainingToDistribute = parseFloat(amount) || 0;
                // 1. Pay rent invoices
                const unpaidRent = profile.invoices.filter(inv => inv.type === 'RENT' && inv.status !== 'PAID');
                for (const rentInv of unpaidRent) {
                    if (remainingToDistribute <= 0)
                        break;
                    const payAmt = Math.min(remainingToDistribute, rentInv.amount);
                    remainingToDistribute -= payAmt;
                    if (payAmt === rentInv.amount) {
                        await tx.rentInvoice.update({
                            where: { id: rentInv.id },
                            data: {
                                status: 'PAID',
                                paymentMode: paymentMode || 'CASH',
                                paidAt: new Date(),
                                updatedBy: actorId
                            }
                        });
                    }
                    else {
                        const remaining = rentInv.amount - payAmt;
                        await tx.rentInvoice.update({
                            where: { id: rentInv.id },
                            data: {
                                amount: payAmt,
                                status: 'PAID',
                                paymentMode: paymentMode || 'CASH',
                                paidAt: new Date(),
                                updatedBy: actorId
                            }
                        });
                        await tx.rentInvoice.create({
                            data: {
                                pgTenantId: profile.id,
                                amount: remaining,
                                dueDate: rentInv.dueDate,
                                status: 'PENDING',
                                type: 'RENT',
                                createdBy: actorId,
                                updatedBy: actorId
                            }
                        });
                    }
                    await tx.auditLog.create({
                        data: {
                            actorId,
                            action: payAmt === rentInv.amount ? 'RENT_PAID' : 'RENT_PARTIAL_PAID',
                            entityType: 'RentInvoice',
                            entityId: rentInv.id,
                            metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
                        }
                    });
                }
                // 2. Pay deposit obligations
                const unpaidDeposit = profile.invoices.filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID');
                for (const depInv of unpaidDeposit) {
                    if (remainingToDistribute <= 0)
                        break;
                    const payAmt = Math.min(remainingToDistribute, depInv.amount);
                    remainingToDistribute -= payAmt;
                    if (payAmt === depInv.amount) {
                        await tx.rentInvoice.update({
                            where: { id: depInv.id },
                            data: {
                                status: 'PAID',
                                paymentMode: paymentMode || 'CASH',
                                paidAt: new Date(),
                                updatedBy: actorId
                            }
                        });
                    }
                    else {
                        const remaining = depInv.amount - payAmt;
                        await tx.rentInvoice.update({
                            where: { id: depInv.id },
                            data: {
                                amount: payAmt,
                                status: 'PAID',
                                paymentMode: paymentMode || 'CASH',
                                paidAt: new Date(),
                                updatedBy: actorId
                            }
                        });
                        await tx.rentInvoice.create({
                            data: {
                                pgTenantId: profile.id,
                                amount: remaining,
                                dueDate: depInv.dueDate,
                                status: 'PENDING',
                                type: 'SECURITY_DEPOSIT',
                                createdBy: actorId,
                                updatedBy: actorId
                            }
                        });
                    }
                    // Compute new deposit status on profile
                    const allPaidDeposits = await tx.rentInvoice.findMany({
                        where: { pgTenantId: profile.id, type: 'SECURITY_DEPOSIT', status: 'PAID', isActive: true }
                    });
                    const totalPaid = allPaidDeposits.reduce((sum, d) => sum + d.amount, 0);
                    let newStatus = 'PENDING';
                    if (totalPaid >= profile.securityDeposit) {
                        newStatus = 'COLLECTED';
                    }
                    else if (totalPaid > 0) {
                        newStatus = 'PARTIALLY_PAID';
                    }
                    await tx.pGTenantProfile.update({
                        where: { id: profile.id },
                        data: {
                            securityDepositStatus: newStatus,
                            depositCollectedAt: newStatus === 'COLLECTED' || newStatus === 'PARTIALLY_PAID' ? new Date() : null,
                            updatedBy: actorId
                        }
                    });
                    await tx.auditLog.create({
                        data: {
                            actorId,
                            action: payAmt === depInv.amount ? 'DEPOSIT_PAID' : 'DEPOSIT_PARTIAL_PAID',
                            entityType: 'RentInvoice',
                            entityId: depInv.id,
                            metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
                        }
                    });
                }
                // 3. Pay damage recoveries
                const unpaidRecoveries = profile.damageRecoveries;
                for (const recovery of unpaidRecoveries) {
                    if (remainingToDistribute <= 0)
                        break;
                    const payAmt = Math.min(remainingToDistribute, recovery.outstandingAmount);
                    remainingToDistribute -= payAmt;
                    const nextRecovered = recovery.recoveredAmount + payAmt;
                    const nextOutstanding = Math.max(0, recovery.totalAmount - nextRecovered);
                    const nextStatus = nextOutstanding === 0 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';
                    await tx.damageRecovery.update({
                        where: { id: recovery.id },
                        data: {
                            recoveredAmount: nextRecovered,
                            outstandingAmount: nextOutstanding,
                            status: nextStatus,
                            collectedDate: new Date(),
                            paymentMode: paymentMode?.toUpperCase() || 'CASH',
                            amountReceived: nextRecovered
                        }
                    });
                    await tx.recoveryTransaction.create({
                        data: {
                            recoveryId: recovery.id,
                            amount: payAmt,
                            paymentMethod: paymentMode?.toUpperCase() || 'CASH',
                            notes: 'Collected during move-out settlement',
                            createdBy: actorId
                        }
                    });
                    await tx.auditLog.create({
                        data: {
                            actorId,
                            action: 'RECOVERY_UPDATED',
                            entityType: 'DamageRecovery',
                            entityId: recovery.id,
                            metadata: { pgId, tenantId, amountPaid: payAmt, method: paymentMode }
                        }
                    });
                }
            }
            else if (action === 'WAIVE') {
                // Waive all Rent, Deposit obligations, and Damage recoveries
                const unpaidRent = profile.invoices.filter(inv => inv.type === 'RENT' && inv.status !== 'PAID');
                for (const rentInv of unpaidRent) {
                    await tx.rentInvoice.update({
                        where: { id: rentInv.id },
                        data: {
                            status: 'PAID',
                            paymentMode: 'WAIVED',
                            paidAt: new Date(),
                            updatedBy: actorId
                        }
                    });
                }
                const unpaidDeposit = profile.invoices.filter(inv => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID');
                for (const depInv of unpaidDeposit) {
                    await tx.rentInvoice.update({
                        where: { id: depInv.id },
                        data: {
                            status: 'PAID',
                            paymentMode: 'WAIVED',
                            paidAt: new Date(),
                            updatedBy: actorId
                        }
                    });
                }
                await tx.pGTenantProfile.update({
                    where: { id: profile.id },
                    data: {
                        securityDepositStatus: 'COLLECTED', // bypass as waived
                        updatedBy: actorId
                    }
                });
                const unpaidRecoveries = profile.damageRecoveries;
                for (const recovery of unpaidRecoveries) {
                    await tx.damageRecovery.update({
                        where: { id: recovery.id },
                        data: {
                            status: 'WAIVED',
                            recoveryMethod: 'WAIVED',
                            outstandingAmount: 0,
                            waivedAt: new Date(),
                            waivedReason: 'Waived during move-out settlement'
                        }
                    });
                    await tx.recoveryTransaction.create({
                        data: {
                            recoveryId: recovery.id,
                            amount: recovery.outstandingAmount,
                            paymentMethod: 'WAIVED',
                            notes: 'Waived during move-out settlement',
                            createdBy: actorId
                        }
                    });
                }
            }
            else if (action === 'REFUND') {
                const refundAmt = parseFloat(amount) || 0;
                await tx.pGTenantProfile.update({
                    where: { id: profile.id },
                    data: {
                        depositRefundedAmount: (profile.depositRefundedAmount || 0) + refundAmt,
                        depositRefundedAt: new Date(),
                        depositRefundMode: paymentMode?.toUpperCase() || 'CASH',
                        depositRefundNotes: 'Refunded during move-out settlement',
                        securityDepositStatus: 'REFUNDED'
                    }
                });
                await tx.depositLedgerTransaction.create({
                    data: {
                        tenantProfileId: profile.id,
                        type: 'DEPOSIT_REFUND',
                        amount: refundAmt,
                        reason: 'Refunded deposit balance during move-out settlement',
                        createdBy: actorId
                    }
                });
            }
            // Return updated profile details
            return tx.pGTenantProfile.findUnique({
                where: { id: profile.id },
                include: {
                    invoices: { where: { isActive: true } },
                    damageRecoveries: true
                }
            });
        });
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.settleMoveout = settleMoveout;
const updateResidentSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
});
const updateResidentProfile = async (req, res) => {
    try {
        const pgId = (req.pg?.id || req.params.pgId);
        const tenantId = req.params.tenantId;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const { name, phone, email } = updateResidentSchema.parse(req.body);
        const profile = await prisma_1.default.pGTenantProfile.findFirst({
            where: { id: tenantId, pgId, isActive: true },
            include: { globalTenant: true }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Resident stay profile not found.' });
        }
        // Update globalTenant and profile
        const result = await prisma_1.default.$transaction(async (tx) => {
            const tenantData = {};
            if (name !== undefined)
                tenantData.name = name;
            if (phone !== undefined)
                tenantData.phone = phone;
            if (email !== undefined)
                tenantData.email = email || null;
            await tx.globalTenant.update({
                where: { id: profile.globalTenantId },
                data: tenantData
            });
            return tx.pGTenantProfile.findUnique({
                where: { id: tenantId },
                include: { globalTenant: true }
            });
        });
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.updateResidentProfile = updateResidentProfile;
/**
 * Fetch all active resident profiles in a PG
 */
const getPGResidents = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const { status } = req.query;
        const profiles = await prisma_1.default.pGTenantProfile.findMany({
            where: {
                pgId: pgId,
                isActive: true,
                status: status ? status : undefined
            },
            include: {
                globalTenant: {
                    select: {
                        name: true,
                        phone: true,
                        email: true
                    }
                },
                room: {
                    select: {
                        number: true,
                        floor: true
                    }
                },
                bed: {
                    select: {
                        bedNumber: true,
                        monthlyRent: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json({ status: 'success', data: profiles });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch PG residents.' });
    }
};
exports.getPGResidents = getPGResidents;
//# sourceMappingURL=tenantController.js.map