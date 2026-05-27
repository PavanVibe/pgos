import { InvoiceStatus } from '@prisma/client';
import prisma from '../../utils/prisma';

export class OverdueService {
  /**
   * Scans for PENDING invoices past their dueDate and marks them PAST_DUE.
   * Logs events and handles automated transitions cleanly.
   */
  static async scanAndProcessOverdueInvoices(actorId: string = 'system'): Promise<{ transitioned: number }> {
    console.log(`[OverdueService] Starting overdue invoice scan...`);
    const now = new Date();

    // 1. Fetch pending invoices past their due date
    const overdueInvoices = await prisma.rentInvoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now
        },
        isActive: true
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: {
              select: { name: true }
            }
          }
        }
      }
    });

    let transitionedCount = 0;

    for (const invoice of overdueInvoices) {
      await prisma.$transaction(async (tx) => {
        // Update status to PAST_DUE
        await tx.rentInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAST_DUE',
            updatedBy: actorId
          }
        });

        // Log RENT_OVERDUE event
        await tx.eventLog.create({
          data: {
            entityId: invoice.id,
            eventType: 'RENT_OVERDUE',
            metadata: {
              pgId: invoice.tenantProfile.pgId,
              roomId: invoice.tenantProfile.roomId,
              bedId: invoice.tenantProfile.bedId,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              tenantName: invoice.tenantProfile.globalTenant.name
            }
          }
        });
      });

      console.log(`[OverdueService] Marked invoice ${invoice.id} for tenant ${invoice.tenantProfile.globalTenant.name} as OVERDUE.`);
      transitionedCount++;
    }

    console.log(`[OverdueService] Overdue scan completed. Transitioned: ${transitionedCount}`);
    return { transitioned: transitionedCount };
  }

  /**
   * Returns a prioritized list of overdue invoices/residents for the PG.
   * Features:
   * 1. Dynamic sorting: Overdue first, then by days overdue, highest amount, due-today, and future dues.
   * 2. Automatic behavioral reliability computation (🟢 Reliable, 🟡 Occasionally Late, 🔴 Chronic Delay).
   * 3. Last paid date calculation.
   * 4. Reminder tracking & cooldown window timestamp fetching.
   * 5. Lightweight operational notes foundation via EventLog.
   */
  static async getOverdueResidentsList(pgId: string, statusFilter: InvoiceStatus[] = [InvoiceStatus.PAST_DUE], filterType?: string) {
    const overdueInvoices = await prisma.rentInvoice.findMany({
      where: {
        tenantProfile: { pgId },
        status: { in: statusFilter },
        isActive: true
      },
      include: {
        tenantProfile: {
          include: {
            globalTenant: {
              select: {
                name: true,
                phone: true,
                email: true
              }
            },
            bed: {
              select: {
                bedNumber: true,
                room: {
                  select: { number: true }
                }
              }
            }
          }
        }
      }
    });

    if (overdueInvoices.length === 0) {
      return [];
    }

    const tenantProfileIds = Array.from(new Set(overdueInvoices.map(inv => inv.tenantProfile.id)));

    // 1. Fetch last paid invoice for each tenant profile
    const lastPaidInvoices = await prisma.rentInvoice.findMany({
      where: {
        pgTenantId: { in: tenantProfileIds },
        status: 'PAID',
        isActive: true
      },
      orderBy: { paidAt: 'desc' }
    });

    const lastPaidMap = new Map<string, Date>();
    for (const inv of lastPaidInvoices) {
      if (inv.paidAt && !lastPaidMap.has(inv.pgTenantId)) {
        lastPaidMap.set(inv.pgTenantId, inv.paidAt);
      }
    }

    // 2. Fetch all historical invoices (PAID or PAST_DUE) for behavioral calculation
    const allHistoricalInvoices = await prisma.rentInvoice.findMany({
      where: {
        pgTenantId: { in: tenantProfileIds },
        status: { in: ['PAID', 'PAST_DUE'] },
        isActive: true
      }
    });

    const invoicesByTenant = new Map<string, typeof allHistoricalInvoices>();
    for (const inv of allHistoricalInvoices) {
      const list = invoicesByTenant.get(inv.pgTenantId) || [];
      list.push(inv);
      invoicesByTenant.set(inv.pgTenantId, list);
    }

    // 3. Fetch latest reminder logs
    const reminderLogs = await prisma.eventLog.findMany({
      where: {
        eventType: 'RENT_REMINDER_SENT',
        entityId: { in: tenantProfileIds }
      },
      orderBy: { createdAt: 'desc' }
    });

    const reminderMap = new Map<string, Date>();
    for (const log of reminderLogs) {
      if (!reminderMap.has(log.entityId)) {
        reminderMap.set(log.entityId, log.createdAt);
      }
    }

    // 4. Fetch latest note logs
    const noteLogs = await prisma.eventLog.findMany({
      where: {
        eventType: 'TENANT_NOTE_UPDATED',
        entityId: { in: tenantProfileIds }
      },
      orderBy: { createdAt: 'desc' }
    });

    const noteMap = new Map<string, string>();
    for (const log of noteLogs) {
      if (!noteMap.has(log.entityId)) {
        const metadata = log.metadata as any;
        if (metadata && metadata.note) {
          noteMap.set(log.entityId, metadata.note);
        }
      }
    }

    // 5. Compute metrics & format
    const now = new Date();
    const formatted = overdueInvoices.map((inv) => {
      const dueTime = new Date(inv.dueDate).getTime();
      const diffTime = now.getTime() - dueTime;
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      const tenantProfileId = inv.tenantProfile.id;
      const lastPaidDate = lastPaidMap.get(tenantProfileId) || null;
      let lastPaymentDaysAgo: number | null = null;
      if (lastPaidDate) {
        const paidTime = new Date(lastPaidDate).getTime();
        lastPaymentDaysAgo = Math.max(0, Math.floor((now.getTime() - paidTime) / (1000 * 60 * 60 * 24)));
      }

      // Compute reliability
      const tenantInvoices = invoicesByTenant.get(tenantProfileId) || [];
      const totalInvoicesCount = tenantInvoices.length;
      const lateInvoicesCount = tenantInvoices.filter(i => {
        if (i.status === 'PAST_DUE') return true;
        if (i.status === 'PAID' && i.paidAt && i.dueDate) {
          return new Date(i.paidAt).getTime() > new Date(i.dueDate).getTime();
        }
        return false;
      }).length;

      let reliability: 'RELIABLE' | 'OCCASIONALLY_LATE' | 'CHRONIC_DELAY' = 'RELIABLE';
      if (totalInvoicesCount > 0 && lateInvoicesCount > 0) {
        const ratio = lateInvoicesCount / totalInvoicesCount;
        if (ratio >= 0.5 || lateInvoicesCount >= 3) {
          reliability = 'CHRONIC_DELAY';
        } else {
          reliability = 'OCCASIONALLY_LATE';
        }
      }

      return {
        id: inv.id,
        tenantProfileId,
        tenantName: inv.tenantProfile.globalTenant.name || 'Resident',
        phone: inv.tenantProfile.globalTenant.phone,
        roomNumber: inv.tenantProfile.bed?.room?.number || inv.tenantProfile.historicalRoomNumber || 'N/A',
        bedNumber: inv.tenantProfile.bed?.bedNumber || inv.tenantProfile.historicalBedNumber || 'N/A',
        amount: inv.amount,
        dueDate: inv.dueDate,
        daysOverdue,
        status: inv.status,
        lastPaidDate,
        lastPaymentDaysAgo,
        reliability,
        lastReminderSentAt: reminderMap.get(tenantProfileId) || null,
        note: noteMap.get(tenantProfileId) || null
      };
    });

    // 5.1 Apply filtering based on filterType
    let filteredList = formatted;
    if (filterType === 'due-today') {
      const isDueToday = (dueDateStr: string | Date) => {
        const d = new Date(dueDateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      };
      filteredList = formatted.filter(res => res.status === 'PENDING' && isDueToday(res.dueDate));
    } else if (filterType === 'chronic') {
      filteredList = formatted.filter(res => res.reliability === 'CHRONIC_DELAY');
    }

    // 6. Strict operational sorting
    filteredList.sort((a, b) => {
      // 1. Overdue residents first (PAST_DUE before PENDING)
      if (a.status === 'PAST_DUE' && b.status !== 'PAST_DUE') return -1;
      if (a.status !== 'PAST_DUE' && b.status === 'PAST_DUE') return 1;

      // If both are PAST_DUE
      if (a.status === 'PAST_DUE' && b.status === 'PAST_DUE') {
        // 2. Highest overdue duration
        if (b.daysOverdue !== a.daysOverdue) {
          return b.daysOverdue - a.daysOverdue;
        }
        // 3. Highest pending amount
        return b.amount - a.amount;
      }

      // If both are PENDING
      // Check if due today (daysLeft <= 0)
      const aDueTime = new Date(a.dueDate).getTime();
      const bDueTime = new Date(b.dueDate).getTime();
      
      const aDaysLeft = Math.ceil((aDueTime - now.getTime()) / (1000 * 60 * 60 * 24));
      const bDaysLeft = Math.ceil((bDueTime - now.getTime()) / (1000 * 60 * 60 * 24));

      const aIsDueToday = aDaysLeft <= 0;
      const bIsDueToday = bDaysLeft <= 0;

      // 4. Due-today invoices first
      if (aIsDueToday && !bIsDueToday) return -1;
      if (!aIsDueToday && bIsDueToday) return 1;

      // 5. Future pending invoices (closer due date first)
      if (aDueTime !== bDueTime) {
        return aDueTime - bDueTime;
      }

      // Fallback: highest amount
      return b.amount - a.amount;
    });

    return filteredList;
  }
}
