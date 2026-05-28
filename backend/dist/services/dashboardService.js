"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPGDashboardSummary = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
const OverdueService_1 = require("./automation/OverdueService");
const getPGDashboardSummary = async (pgId, orgId) => {
    // Ensure the PG belongs to the organization
    const pg = await prisma_1.default.pG.findFirst({
        where: { id: pgId, organizationId: orgId }
    });
    if (!pg) {
        throw new Error('PG not found or access denied.');
    }
    // Execute aggregations in parallel
    const [totalBeds, occupiedBeds, pendingInvoices, unresolvedComplaints, highPriorityComplaints, expenses, overdueInvoicesCount, unpaidInvoicesCount, overdueInvoicesSum] = await Promise.all([
        // Total Beds (Soft delete filter applies automatically via Prisma Extension)
        prisma_1.default.bed.count({
            where: { room: { pgId } }
        }),
        // Occupied Beds
        prisma_1.default.pGTenantProfile.count({
            where: { pgId, status: 'ACTIVE' }
        }),
        // Pending/Overdue Rent (summing amount)
        prisma_1.default.rentInvoice.aggregate({
            where: {
                tenantProfile: { pgId },
                status: { in: ['PENDING', 'PAST_DUE'] },
                isActive: true
            },
            _sum: { amount: true }
        }),
        // Unresolved Complaints
        prisma_1.default.complaint.count({
            where: { pgId, status: { in: ['PENDING', 'ESCALATED'] } }
        }),
        // High Priority / Urgent Complaints
        prisma_1.default.complaint.count({
            where: {
                pgId,
                priority: { in: ['HIGH', 'URGENT'] },
                status: { in: ['PENDING', 'ESCALATED'] }
            }
        }),
        // Monthly Expenses (Assuming current month)
        prisma_1.default.expense.aggregate({
            where: {
                pgId,
                incurredAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Start of current month
                }
            },
            _sum: { amount: true }
        }),
        // Overdue Invoices Count
        prisma_1.default.rentInvoice.count({
            where: {
                tenantProfile: { pgId },
                status: 'PAST_DUE',
                isActive: true
            }
        }),
        // Unpaid Invoices Count
        prisma_1.default.rentInvoice.count({
            where: {
                tenantProfile: { pgId },
                status: { in: ['PENDING', 'PAST_DUE'] },
                isActive: true
            }
        }),
        // Overdue Invoices Sum
        prisma_1.default.rentInvoice.aggregate({
            where: {
                tenantProfile: { pgId },
                status: 'PAST_DUE',
                isActive: true
            },
            _sum: { amount: true }
        })
    ]);
    console.log(`[getPGDashboardSummary] pgId: ${pgId}, pendingRent: ${pendingInvoices._sum.amount || 0}, unpaidInvoicesCount: ${unpaidInvoicesCount}, overdueRent: ${overdueInvoicesSum._sum.amount || 0}, overdueCount: ${overdueInvoicesCount}`);
    // Fetch active/overdue list to avoid duplication and populate collection priority metrics
    const overdueList = await OverdueService_1.OverdueService.getOverdueResidentsList(pgId, [client_1.InvoiceStatus.PENDING, client_1.InvoiceStatus.PAST_DUE]);
    const isDueToday = (dueDateStr) => {
        const d = new Date(dueDateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };
    const dueTodayCount = overdueList.filter(res => res.status === 'PENDING' && isDueToday(res.dueDate)).length;
    const chronicDelayCount = Array.from(new Set(overdueList
        .filter(res => res.reliability === 'CHRONIC_DELAY')
        .map(res => res.tenantProfileId))).length;
    return {
        totalBeds,
        occupiedBeds,
        vacantBeds: totalBeds - occupiedBeds,
        pendingRent: pendingInvoices._sum.amount || 0,
        unpaidInvoicesCount,
        overdueRent: overdueInvoicesSum._sum.amount || 0,
        overdueCount: overdueInvoicesCount,
        dueTodayCount,
        chronicDelayCount,
        unresolvedComplaints,
        highPriorityComplaints,
        monthlyExpenses: expenses._sum.amount || 0
    };
};
exports.getPGDashboardSummary = getPGDashboardSummary;
//# sourceMappingURL=dashboardService.js.map