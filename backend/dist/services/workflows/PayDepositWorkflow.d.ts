export declare class PayDepositWorkflow {
    /**
     * Records a security deposit payment transaction, settling a pending deposit invoice for a resident.
     */
    static execute(pgId: string, tenantId: string, method: string, actorId: string, amount?: number, invoiceId?: string, referenceId?: string): Promise<{
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
//# sourceMappingURL=PayDepositWorkflow.d.ts.map