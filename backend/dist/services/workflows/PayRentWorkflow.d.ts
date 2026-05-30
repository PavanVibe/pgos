export declare class PayRentWorkflow {
    /**
     * Records a rent payment transaction, settling the oldest pending invoice for a tenant.
     */
    static execute(pgId: string, tenantId: string, method: 'upi' | 'cash', actorId: string, amount?: number, invoiceId?: string, referenceId?: string): Promise<{
        id: string;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        pgTenantId: string;
        amount: number;
        dueDate: Date;
        razorpayOrdId: string | null;
        razorpayPayId: string | null;
        paidAt: Date | null;
        paymentMode: string | null;
        referenceId: string | null;
        type: string;
    }>;
}
//# sourceMappingURL=PayRentWorkflow.d.ts.map