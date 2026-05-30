"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepositLedger = exports.getMonthlyCollectionLedger = exports.getCollectionsHistory = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getCollectionsHistory = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const { type } = req.query;
        const invoiceWhere = {
            tenantProfile: { pgId },
            isActive: true,
        };
        if (type === 'RENT' || type === 'SECURITY_DEPOSIT') {
            invoiceWhere.type = type;
        }
        // 1. Fetch all active invoices for this PG
        const invoices = await prisma_1.default.rentInvoice.findMany({
            where: invoiceWhere,
            orderBy: {
                dueDate: 'desc',
            },
        });
        // 2. Fetch total beds to compute occupancy rate
        const totalBeds = await prisma_1.default.bed.count({
            where: {
                room: { pgId },
                isActive: true,
            },
        });
        // 3. Group invoices by calendar month-year of their dueDate
        const monthlyGroups = {};
        invoices.forEach((inv) => {
            const date = new Date(inv.dueDate);
            const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`; // "YYYY-MM"
            if (!monthlyGroups[key]) {
                monthlyGroups[key] = [];
            }
            monthlyGroups[key].push(inv);
        });
        // 4. Compute metrics for each month-year bucket
        const history = await Promise.all(Object.keys(monthlyGroups).map(async (key) => {
            const [yearStr, monthStr] = key.split('-');
            const year = parseInt(yearStr || '0');
            const monthIndex = parseInt(monthStr || '0');
            const startOfMonth = new Date(year, monthIndex, 1);
            const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
            const monthName = startOfMonth.toLocaleString('en-US', { month: 'long' });
            const group = monthlyGroups[key] || [];
            const expectedRent = group.reduce((sum, inv) => sum + inv.amount, 0);
            const actualCollected = group
                .filter((inv) => inv.status === 'PAID')
                .reduce((sum, inv) => sum + inv.amount, 0);
            const pendingAmount = group
                .filter((inv) => inv.status === 'PENDING')
                .reduce((sum, inv) => sum + inv.amount, 0);
            const overdueAmount = group
                .filter((inv) => inv.status === 'PAST_DUE')
                .reduce((sum, inv) => sum + inv.amount, 0);
            const paymentsCount = group.filter((inv) => inv.status === 'PAID').length;
            // Compute Collection Efficiency (%)
            const collectionEfficiency = expectedRent > 0 ? Math.round((actualCollected / expectedRent) * 100) : 0;
            // Compute precise occupancy percentage for that historical month
            const activeTenantsCount = await prisma_1.default.pGTenantProfile.count({
                where: {
                    pgId,
                    isActive: true,
                    moveInDate: { lte: endOfMonth },
                    OR: [
                        { moveOutDate: null },
                        { moveOutDate: { gte: startOfMonth } },
                    ],
                },
            });
            const occupancyRate = totalBeds > 0 ? Math.min(100, Math.round((activeTenantsCount / totalBeds) * 100)) : 0;
            return {
                month: monthName,
                year,
                monthIndex,
                expectedRent,
                actualCollected,
                collectionEfficiency,
                pendingAmount,
                overdueAmount,
                occupancyRate,
                paymentsCount,
            };
        }));
        // Sort newest month first
        history.sort((a, b) => {
            if (a.year !== b.year) {
                return b.year - a.year;
            }
            return b.monthIndex - a.monthIndex;
        });
        res.status(200).json({ status: 'success', data: history });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getCollectionsHistory = getCollectionsHistory;
const getMonthlyCollectionLedger = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const { year: yearStr, month: monthStr } = req.params;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const year = parseInt(yearStr || '0');
        const monthIndex = parseInt(monthStr || '0'); // 0-indexed
        if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
            return res.status(400).json({ error: 'Invalid year or month query parameter.' });
        }
        const startOfMonth = new Date(year, monthIndex, 1);
        const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        const { type } = req.query;
        const invoiceWhere = {
            tenantProfile: { pgId },
            dueDate: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
            isActive: true,
        };
        if (type === 'RENT' || type === 'SECURITY_DEPOSIT') {
            invoiceWhere.type = type;
        }
        // Fetch all invoices due in this calendar month
        const invoices = await prisma_1.default.rentInvoice.findMany({
            where: invoiceWhere,
            include: {
                tenantProfile: {
                    include: {
                        globalTenant: {
                            select: { name: true },
                        },
                        room: {
                            select: { number: true },
                        },
                        bed: {
                            select: { bedNumber: true },
                        },
                    },
                },
            },
            orderBy: {
                dueDate: 'desc',
            },
        });
        const ledger = invoices.map((inv) => {
            const profile = inv.tenantProfile;
            return {
                id: inv.id,
                residentName: profile.globalTenant.name || 'Unknown',
                roomNumber: profile.room?.number || profile.historicalRoomNumber || '-',
                bedNumber: profile.bed?.bedNumber || profile.historicalBedNumber || '-',
                amountPaid: inv.status === 'PAID' ? inv.amount : 0,
                dueAmount: inv.status !== 'PAID' ? inv.amount : 0,
                dueDate: inv.dueDate,
                paymentDate: inv.paidAt || null,
                paymentMode: inv.paymentMode || null,
                referenceId: inv.referenceId || inv.id,
                status: inv.status,
                type: inv.type,
            };
        });
        res.status(200).json({ status: 'success', data: ledger });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getMonthlyCollectionLedger = getMonthlyCollectionLedger;
const getDepositLedger = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const profiles = await prisma_1.default.pGTenantProfile.findMany({
            where: {
                pgId,
                isActive: true,
            },
            include: {
                globalTenant: {
                    select: {
                        name: true,
                        phone: true,
                    },
                },
                room: {
                    select: {
                        number: true,
                    },
                },
                bed: {
                    select: {
                        bedNumber: true,
                    },
                },
                invoices: {
                    where: {
                        type: 'SECURITY_DEPOSIT',
                        isActive: true,
                    },
                },
            },
            orderBy: {
                moveInDate: 'desc',
            },
        });
        // Group profiles by globalTenantId to prioritize the active stay record when one exists
        const tenantProfilesMap = new Map();
        for (const p of profiles) {
            const tenantId = p.globalTenantId;
            const list = tenantProfilesMap.get(tenantId) || [];
            list.push(p);
            tenantProfilesMap.set(tenantId, list);
        }
        const consolidatedProfiles = Array.from(tenantProfilesMap.values()).map((tenantProfiles) => {
            // Find if there is an active/notice/incomplete stay record (any stay that is not PAST)
            const activeProfile = tenantProfiles.find((p) => p.status !== 'PAST');
            // If an active stay exists, use it. Otherwise use the most recent stay (first in array since we ordered by moveInDate desc)
            return activeProfile || tenantProfiles[0];
        });
        const ledger = consolidatedProfiles.map((profile) => {
            const depositInvoice = profile.invoices.find((inv) => inv.type === 'SECURITY_DEPOSIT' && inv.status !== 'PAID') || profile.invoices.find((inv) => inv.type === 'SECURITY_DEPOSIT');
            return {
                id: profile.id,
                residentName: profile.globalTenant.name || 'Unknown',
                phone: profile.globalTenant.phone,
                roomNumber: profile.room?.number || profile.historicalRoomNumber || '-',
                bedNumber: profile.bed?.bedNumber || profile.historicalBedNumber || '-',
                depositAmount: profile.securityDeposit,
                status: profile.securityDepositStatus, // COLLECTED / PENDING / PARTIALLY_PAID
                collectedDate: profile.depositCollectedAt || null,
                paymentMode: depositInvoice?.status === 'PAID' ? depositInvoice?.paymentMode : null,
                refundStatus: profile.depositRefundedAt ? 'REFUNDED' : 'NOT_REFUNDED',
                refundedAmount: profile.depositRefundedAmount || null,
                refundedAt: profile.depositRefundedAt || null,
                refundMode: profile.depositRefundMode || null,
                tenantStatus: profile.status === 'PAST' ? 'PAST' : (profile.status === 'NOTICE' ? 'NOTICE' : 'ACTIVE'), // Normalize active/incomplete stays
                invoiceId: (depositInvoice && depositInvoice.status !== 'PAID') ? depositInvoice.id : null,
                invoiceDueDate: depositInvoice?.dueDate || null,
                pendingAmount: (depositInvoice && depositInvoice.status !== 'PAID') ? depositInvoice.amount : 0
            };
        });
        res.status(200).json({ status: 'success', data: ledger });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getDepositLedger = getDepositLedger;
//# sourceMappingURL=collectionsController.js.map