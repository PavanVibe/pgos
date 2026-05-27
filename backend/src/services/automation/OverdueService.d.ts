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
     * Requirements:
     * 1. Sorted by longest overdue first (dueDate asc)
     * 2. Sorted by highest due amount second (amount desc)
     */
    static getOverdueResidentsList(pgId: string): Promise<{
        id: string;
        tenantProfileId: string;
        tenantName: string;
        phone: string;
        roomNumber: string;
        bedNumber: string;
        amount: number;
        dueDate: Date;
        daysOverdue: number;
    }[]>;
}
//# sourceMappingURL=OverdueService.d.ts.map