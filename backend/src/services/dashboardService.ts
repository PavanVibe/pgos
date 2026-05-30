import prisma from '../utils/prisma';
import { InvoiceStatus } from '@prisma/client';
import { OverdueService } from './automation/OverdueService';

export const getPGDashboardSummary = async (pgId: string, orgId: string) => {
  // Ensure the PG belongs to the organization
  const pg = await prisma.pG.findFirst({
    where: { id: pgId, organizationId: orgId }
  });

  if (!pg) {
    throw new Error('PG not found or access denied.');
  }

  // Execute aggregations in parallel
  const [
    totalBeds,
    occupiedBeds,
    pendingInvoices,
    unresolvedComplaints,
    highPriorityComplaints,
    expenses,
    overdueInvoicesCount,
    unpaidInvoicesCount,
    overdueInvoicesSum,
    collectedDepositsSum,
    pendingDepositsSum,
    refundLiabilitySum
  ] = await Promise.all([
    // Total Beds (Soft delete filter applies automatically via Prisma Extension)
    prisma.bed.count({
      where: { room: { pgId } }
    }),
    // Occupied Beds
    prisma.pGTenantProfile.count({
      where: { pgId, status: 'ACTIVE' }
    }),
    // Pending/Overdue Rent (summing amount)
    prisma.rentInvoice.aggregate({
      where: { 
        tenantProfile: { pgId },
        status: { in: ['PENDING', 'PAST_DUE'] },
        isActive: true,
        type: 'RENT'
      },
      _sum: { amount: true }
    }),
    // Unresolved Complaints
    prisma.complaint.count({
      where: { pgId, status: { in: ['PENDING', 'ESCALATED'] } }
    }),
    // High Priority / Urgent Complaints
    prisma.complaint.count({
      where: { 
        pgId, 
        priority: { in: ['HIGH', 'URGENT'] },
        status: { in: ['PENDING', 'ESCALATED'] }
      }
    }),
    // Monthly Expenses (Assuming current month)
    prisma.expense.aggregate({
      where: {
        pgId,
        incurredAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Start of current month
        }
      },
      _sum: { amount: true }
    }),
    // Overdue Invoices Count
    prisma.rentInvoice.count({
      where: {
        tenantProfile: { pgId },
        status: 'PAST_DUE',
        isActive: true,
        type: 'RENT'
      }
    }),
    // Unpaid Invoices Count
    prisma.rentInvoice.count({
      where: {
        tenantProfile: { pgId },
        status: { in: ['PENDING', 'PAST_DUE'] },
        isActive: true,
        type: 'RENT'
      }
    }),
    // Overdue Invoices Sum
    prisma.rentInvoice.aggregate({
      where: {
        tenantProfile: { pgId },
        status: 'PAST_DUE',
        isActive: true,
        type: 'RENT'
      },
      _sum: { amount: true }
    }),
    // Collected Deposits (Total Deposits Held)
    prisma.rentInvoice.aggregate({
      where: {
        tenantProfile: { pgId },
        type: 'SECURITY_DEPOSIT',
        status: 'PAID',
        isActive: true
      },
      _sum: { amount: true }
    }),
    // Pending Deposits
    prisma.rentInvoice.aggregate({
      where: {
        tenantProfile: { pgId },
        type: 'SECURITY_DEPOSIT',
        status: { in: ['PENDING', 'PAST_DUE'] },
        isActive: true
      },
      _sum: { amount: true }
    }),
    // Refund Liability (Refunded Deposits)
    prisma.pGTenantProfile.aggregate({
      where: {
        pgId,
        isActive: true
      },
      _sum: { depositRefundedAmount: true }
    })
  ]);

  console.log(`[getPGDashboardSummary] pgId: ${pgId}, pendingRent: ${pendingInvoices._sum.amount || 0}, unpaidInvoicesCount: ${unpaidInvoicesCount}, overdueRent: ${overdueInvoicesSum._sum.amount || 0}, overdueCount: ${overdueInvoicesCount}`);

  // Fetch active/overdue list to avoid duplication and populate collection priority metrics
  const overdueList = await OverdueService.getOverdueResidentsList(pgId, [InvoiceStatus.PENDING, InvoiceStatus.PAST_DUE]);
  
  const isDueToday = (dueDateStr: string | Date) => {
    const d = new Date(dueDateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };
  const dueTodayCount = overdueList.filter(res => res.status === 'PENDING' && isDueToday(res.dueDate)).length;

  const chronicDelayCount = Array.from(new Set(
    overdueList
      .filter(res => res.reliability === 'CHRONIC_DELAY')
      .map(res => res.tenantProfileId)
  )).length;

  // 1. Current calendar month collections
  const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentMonthPaidInvoices = await prisma.rentInvoice.aggregate({
    where: {
      tenantProfile: { pgId },
      status: 'PAID',
      paidAt: { gte: startOfCurrentMonth },
      isActive: true,
      type: 'RENT'
    },
    _sum: { amount: true }
  });
  const collectedThisMonth = currentMonthPaidInvoices._sum.amount || 0;

  // 2. Unique paying residents this month
  const payingResidentsGroup = await prisma.rentInvoice.groupBy({
    by: ['pgTenantId'],
    where: {
      tenantProfile: { pgId },
      status: 'PAID',
      paidAt: { gte: startOfCurrentMonth },
      isActive: true,
      type: 'RENT'
    }
  });
  const payingResidentsCount = payingResidentsGroup.length;

  // 3. Last calendar month collections (for comparison trend)
  const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const endOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);
  const lastMonthPaidInvoices = await prisma.rentInvoice.aggregate({
    where: {
      tenantProfile: { pgId },
      status: 'PAID',
      paidAt: {
        gte: startOfLastMonth,
        lte: endOfLastMonth
      },
      isActive: true,
      type: 'RENT'
    },
    _sum: { amount: true }
  });
  const collectedLastMonth = lastMonthPaidInvoices._sum.amount || 0;

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
    monthlyExpenses: expenses._sum.amount || 0,
    collectedThisMonth,
    payingResidentsCount,
    collectedLastMonth,
    collectedDeposits: collectedDepositsSum._sum.amount || 0,
    pendingDeposits: pendingDepositsSum._sum.amount || 0,
    refundLiability: Math.max(0, (collectedDepositsSum._sum.amount || 0) - (refundLiabilitySum._sum.depositRefundedAmount || 0))
  };
};
