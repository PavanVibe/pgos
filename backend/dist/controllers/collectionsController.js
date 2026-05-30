"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonthlyCollectionLedger = exports.getCollectionsHistory = void 0;
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
//# sourceMappingURL=collectionsController.js.map