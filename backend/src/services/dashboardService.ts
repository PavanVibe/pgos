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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

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
    refundLiabilitySum,
    pendingRefundResidentsCount,
    pendingRecoveriesCount,
    totalPendingRecoveryAmountData,
    todaysPayments
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
    // Refund Liability (Refunded Deposits & Damage Deductions)
    prisma.pGTenantProfile.aggregate({
      where: {
        pgId,
        isActive: true
      },
      _sum: { 
        depositRefundedAmount: true,
        depositDeductionAmount: true
      }
    }),
    // Pending Refund Residents (HISTORICAL profiles awaiting refund)
    prisma.pGTenantProfile.count({
      where: {
        pgId,
        status: 'PAST',
        securityDepositStatus: { in: ['COLLECTED', 'PARTIALLY_REFUNDED'] },
        isActive: true
      }
    }),
    // Pending Damage Recoveries Count (unpaid/not waived)
    prisma.damageRecovery.count({
      where: {
        pgId,
        status: { in: ['PENDING', 'PARTIALLY_RECOVERED', 'DISPUTED'] }
      }
    }),
    // Total Pending Damage Recovery Amount
    prisma.damageRecovery.aggregate({
      where: {
        pgId,
        status: { in: ['PENDING', 'PARTIALLY_RECOVERED', 'DISPUTED'] }
      },
      _sum: {
        outstandingAmount: true
      }
    }),
    // Today's Payments (collected today)
    prisma.paymentReceipt.aggregate({
      where: {
        tenantProfile: { pgId },
        paymentDate: { gte: startOfToday }
      },
      _sum: { amount: true },
      _count: { id: true }
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

  const rentDueVal = pendingInvoices._sum.amount || 0;
  const damageChargesVal = totalPendingRecoveryAmountData._sum.outstandingAmount || 0;
  const depositDueVal = pendingDepositsSum._sum.amount || 0;

  return {
    totalBeds,
    occupiedBeds,
    vacantBeds: totalBeds - occupiedBeds,
    pendingRent: rentDueVal,
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
    pendingDeposits: depositDueVal,
    refundedDeposits: refundLiabilitySum._sum.depositRefundedAmount || 0,
    refundLiability: Math.max(0, (collectedDepositsSum._sum.amount || 0) - (refundLiabilitySum._sum.depositRefundedAmount || 0) - (refundLiabilitySum._sum.depositDeductionAmount || 0)),
    pendingRefundResidents: pendingRefundResidentsCount,
    pendingRecoveriesCount,
    totalPendingRecoveryAmount: damageChargesVal,
    totalOutstanding: rentDueVal + damageChargesVal + depositDueVal,
    todaysPaymentsAmount: todaysPayments._sum.amount || 0,
    todaysPaymentsCount: todaysPayments._count.id || 0
  };
};
