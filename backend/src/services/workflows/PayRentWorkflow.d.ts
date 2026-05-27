export declare class PayRentWorkflow {
    /**
     * Records a rent payment transaction, settling the oldest pending invoice for a tenant.
     */
    static execute(pgId: string, tenantId: string, method: 'upi' | 'cash', actorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        amount: number;
        dueDate: Date;
        razorpayOrdId: string | null;
        razorpayPayId: string | null;
        paidAt: Date | null;
        pgTenantId: string;
    }>;
}
//# sourceMappingURL=PayRentWorkflow.d.ts.map