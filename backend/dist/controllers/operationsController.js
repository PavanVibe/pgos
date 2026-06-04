"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperationsSummary = exports.resetCleaningChecklist = exports.toggleCleaningChecklist = exports.getCleaningChecklist = exports.getFollowUps = exports.getVacancyImpact = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
const getVacancyImpact = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        // Fetch all active beds in the PG
        const beds = await prisma_1.default.bed.findMany({
            where: {
                isActive: true,
                room: {
                    pgId: pgId,
                    isActive: true
                }
            },
            include: {
                tenantProfile: {
                    where: {
                        status: { in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.NOTICE, client_1.TenantStatus.INCOMPLETE] }
                    }
                }
            }
        });
        const totalBeds = beds.length;
        const occupiedBedsList = beds.filter(b => b.tenantProfile !== null);
        const occupiedBeds = occupiedBedsList.length;
        const vacantBedsList = beds.filter(b => b.tenantProfile === null);
        const vacantBeds = vacantBedsList.length;
        // Potential Monthly Revenue Lost = Sum of standard rent of all vacant beds
        const potentialRevenueLost = vacantBedsList.reduce((sum, b) => sum + b.monthlyRent, 0);
        res.status(200).json({
            status: 'success',
            data: {
                totalBeds,
                occupiedBeds,
                vacantBeds,
                potentialRevenueLost
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getVacancyImpact = getVacancyImpact;
const getFollowUps = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const now = new Date();
        // 1. Fetch overdue Rent invoices
        const unpaidRentInvoices = await prisma_1.default.rentInvoice.findMany({
            where: {
                status: { in: ['PENDING', 'PAST_DUE'] },
                isActive: true,
                type: 'RENT',
                tenantProfile: {
                    pgId: pgId,
                    status: { in: ['ACTIVE', 'NOTICE'] }
                }
            },
            include: {
                tenantProfile: {
                    include: {
                        globalTenant: true,
                        room: true
                    }
                }
            }
        });
        // 2. Fetch pending deposits
        const pendingDepositTenants = await prisma_1.default.pGTenantProfile.findMany({
            where: {
                pgId: pgId,
                status: { in: ['ACTIVE', 'NOTICE'] },
                securityDeposit: { gt: 0 },
                NOT: { securityDepositStatus: 'PAID' }
            },
            include: {
                globalTenant: true,
                room: true
            }
        });
        // 3. Fetch outstanding damage recoveries
        const outstandingRecoveries = await prisma_1.default.damageRecovery.findMany({
            where: {
                pgId: pgId,
                status: { in: ['PENDING', 'PARTIALLY_RECOVERED'] }
            },
            include: {
                tenantProfile: {
                    include: {
                        globalTenant: true,
                        room: true
                    }
                }
            }
        });
        const followUps = [];
        // Map Rent Overdues
        unpaidRentInvoices.forEach(inv => {
            const diffTime = now.getTime() - new Date(inv.dueDate).getTime();
            const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            followUps.push({
                id: inv.id,
                tenantId: inv.tenantProfile.id,
                type: 'RENT',
                residentName: inv.tenantProfile.globalTenant.name || 'Resident',
                phone: inv.tenantProfile.globalTenant.phone,
                roomNumber: inv.tenantProfile.room.number,
                amount: inv.amount,
                dueDate: inv.dueDate,
                daysOverdue,
                label: 'Rent Due'
            });
        });
        // Map Deposit Overdues
        pendingDepositTenants.forEach(tenant => {
            const diffTime = now.getTime() - new Date(tenant.moveInDate).getTime();
            const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            followUps.push({
                id: `deposit-${tenant.id}`,
                tenantId: tenant.id,
                type: 'DEPOSIT',
                residentName: tenant.globalTenant.name || 'Resident',
                phone: tenant.globalTenant.phone,
                roomNumber: tenant.room.number,
                amount: tenant.securityDeposit,
                dueDate: tenant.moveInDate,
                daysOverdue,
                label: 'Deposit Due'
            });
        });
        // Map Damage Charges
        outstandingRecoveries.forEach(rec => {
            const diffTime = now.getTime() - new Date(rec.createdAt).getTime();
            const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            followUps.push({
                id: rec.id,
                tenantId: rec.tenantProfile.id,
                type: 'DAMAGE',
                residentName: rec.tenantProfile.globalTenant.name || 'Resident',
                phone: rec.tenantProfile.globalTenant.phone,
                roomNumber: rec.tenantProfile.room.number,
                amount: rec.outstandingAmount,
                dueDate: rec.createdAt,
                daysOverdue,
                label: 'Damage Charges'
            });
        });
        // Sort by daysOverdue descending (most overdue first)
        followUps.sort((a, b) => b.daysOverdue - a.daysOverdue);
        res.status(200).json({
            status: 'success',
            data: followUps
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getFollowUps = getFollowUps;
const getCleaningChecklist = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        let checklist = await prisma_1.default.cleaningChecklist.findUnique({
            where: { pgId: pgId }
        });
        if (!checklist) {
            checklist = await prisma_1.default.cleaningChecklist.create({
                data: {
                    pgId: pgId,
                    roomsCompleted: false,
                    bathroomsCompleted: false,
                    commonAreasCompleted: false,
                    kitchenCompleted: false,
                    waterTankCompleted: false
                }
            });
        }
        res.status(200).json({ status: 'success', data: checklist });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getCleaningChecklist = getCleaningChecklist;
const toggleCleaningChecklist = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const { field } = req.body;
        const allowedFields = ['roomsCompleted', 'bathroomsCompleted', 'commonAreasCompleted', 'kitchenCompleted', 'waterTankCompleted'];
        if (!allowedFields.includes(field)) {
            return res.status(400).json({ error: 'Invalid cleaning checklist field.' });
        }
        const currentChecklist = await prisma_1.default.cleaningChecklist.findUnique({
            where: { pgId: pgId }
        });
        const currentValue = currentChecklist ? currentChecklist[field] : false;
        const updated = await prisma_1.default.cleaningChecklist.upsert({
            where: { pgId: pgId },
            create: {
                pgId: pgId,
                roomsCompleted: field === 'roomsCompleted',
                bathroomsCompleted: field === 'bathroomsCompleted',
                commonAreasCompleted: field === 'commonAreasCompleted',
                kitchenCompleted: field === 'kitchenCompleted',
                waterTankCompleted: field === 'waterTankCompleted'
            },
            update: {
                [field]: !currentValue
            }
        });
        res.status(200).json({ status: 'success', data: updated });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.toggleCleaningChecklist = toggleCleaningChecklist;
const resetCleaningChecklist = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const updated = await prisma_1.default.cleaningChecklist.upsert({
            where: { pgId: pgId },
            create: {
                pgId: pgId,
                roomsCompleted: false,
                bathroomsCompleted: false,
                commonAreasCompleted: false,
                kitchenCompleted: false,
                waterTankCompleted: false
            },
            update: {
                roomsCompleted: false,
                bathroomsCompleted: false,
                commonAreasCompleted: false,
                kitchenCompleted: false,
                waterTankCompleted: false
            }
        });
        res.status(200).json({ status: 'success', data: updated });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.resetCleaningChecklist = resetCleaningChecklist;
const getOperationsSummary = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        // 1. Rent Due (Unpaid Rent Invoices)
        const unpaidRent = await prisma_1.default.rentInvoice.aggregate({
            where: {
                status: { in: ['PENDING', 'PAST_DUE'] },
                isActive: true,
                type: 'RENT',
                tenantProfile: {
                    pgId: pgId,
                    status: { in: ['ACTIVE', 'NOTICE'] }
                }
            },
            _count: { id: true },
            _sum: { amount: true }
        });
        // 2. Deposit Pending (securityDepositStatus !== 'PAID' & securityDeposit > 0)
        const pendingDeposits = await prisma_1.default.pGTenantProfile.aggregate({
            where: {
                pgId: pgId,
                status: { in: ['ACTIVE', 'NOTICE'] },
                securityDeposit: { gt: 0 },
                NOT: { securityDepositStatus: 'PAID' }
            },
            _count: { id: true },
            _sum: { securityDeposit: true }
        });
        // 3. Damage Recoveries Pending (Outstanding recoveries)
        const pendingRecoveries = await prisma_1.default.damageRecovery.aggregate({
            where: {
                pgId: pgId,
                status: { in: ['PENDING', 'PARTIALLY_RECOVERED'] }
            },
            _count: { id: true },
            _sum: { outstandingAmount: true }
        });
        // 4. Complaints Pending (PENDING or ESCALATED)
        const pendingComplaints = await prisma_1.default.complaint.aggregate({
            where: {
                pgId: pgId,
                status: { in: ['PENDING', 'ESCALATED'] },
                isActive: true
            },
            _count: { id: true }
        });
        // 5. Move-Ins this month
        const moveInsCount = await prisma_1.default.pGTenantProfile.count({
            where: {
                pgId: pgId,
                isActive: true,
                moveInDate: { gte: startOfMonth, lte: endOfMonth }
            }
        });
        // 6. Move-Outs this month
        const moveOutsCount = await prisma_1.default.pGTenantProfile.count({
            where: {
                pgId: pgId,
                isActive: true,
                status: { in: ['PAST', 'NOTICE'] },
                moveOutDate: { gte: startOfMonth, lte: endOfMonth }
            }
        });
        res.status(200).json({
            status: 'success',
            data: {
                rentDueCount: unpaidRent._count.id || 0,
                rentDueAmount: unpaidRent._sum.amount || 0,
                depositPendingCount: pendingDeposits._count.id || 0,
                depositPendingAmount: pendingDeposits._sum.securityDeposit || 0,
                damageRecoveriesCount: pendingRecoveries._count.id || 0,
                damageRecoveriesAmount: pendingRecoveries._sum.outstandingAmount || 0,
                complaintsPendingCount: pendingComplaints._count.id || 0,
                moveInsCount,
                moveOutsCount
            }
        });
    }
    catch (error) {
        res.status(550).json({ error: error.message });
    }
};
exports.getOperationsSummary = getOperationsSummary;
//# sourceMappingURL=operationsController.js.map