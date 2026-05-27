export declare class MonthlyInvoiceService {
    /**
     * Automatically generates monthly RentInvoices for all ACTIVE/NOTICE tenant profiles.
     * Prevents creating duplicate invoices for the same tenant in the same calendar month.
     */
    static generateMonthlyInvoices(actorId?: string): Promise<{
        generated: number;
        skipped: number;
    }>;
}
//# sourceMappingURL=MonthlyInvoiceService.d.ts.map