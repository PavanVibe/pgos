import { InvoiceStatus } from '@prisma/client';
export declare class OverdueService {
    /**
     * Scans for PENDING invoices past their dueDate and marks them PAST_DUE.
     * Logs events and handles automated transitions cleanly.
     */
    static scanAndProcessOverdueInvoices(actorId?: string): Promise<{
        transitioned: number;
    }>;
    /**
     * Returns a prioritized list of overdue invoices/residents for the PG.
     * Features:
     * 1. Dynamic sorting: Overdue first, then by days overdue, highest amount, due-today, and future dues.
     * 2. Automatic behavioral reliability computation (🟢 Reliable, 🟡 Occasionally Late, 🔴 Chronic Delay).
     * 3. Last paid date calculation.
     * 4. Reminder tracking & cooldown window timestamp fetching.
     * 5. Lightweight operational notes foundation via EventLog.
     */
    static getOverdueResidentsList(pgId: string, statusFilter?: InvoiceStatus[], filterType?: string): Promise<{
        id: string;
        tenantProfileId: string;
        tenantName: string;
        phone: string;
        roomNumber: string;
        bedNumber: string;
        amount: number;
        dueDate: Date;
        daysOverdue: number;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        lastPaidDate: Date | null;
        lastPaymentDaysAgo: number | null;
        reliability: "RELIABLE" | "OCCASIONALLY_LATE" | "CHRONIC_DELAY";
        lastReminderSentAt: Date | null;
        note: string | null;
    }[]>;
}
//# sourceMappingURL=OverdueService.d.ts.map