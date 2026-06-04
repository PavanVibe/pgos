export declare class PayRentWorkflow {
    /**
     * Records a rent payment transaction, settling the oldest pending invoice for a tenant.
     */
    static execute(pgId: string, tenantId: string, method: string, actorId: string, amount?: number, invoiceId?: string, referenceId?: string): Promise<{
        id: string;
        pgTenantId: string;
        amount: number;
        paidAmount: number;
        dueDate: Date;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        razorpayOrdId: string | null;
        razorpayPayId: string | null;
        paidAt: Date | null;
        paymentMode: string | null;
        referenceId: string | null;
        type: string;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
//# sourceMappingURL=PayRentWorkflow.d.ts.map