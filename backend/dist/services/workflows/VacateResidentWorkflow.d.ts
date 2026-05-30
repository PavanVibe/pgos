export declare class VacateResidentWorkflow {
    /**
     * Safe transaction-wrapped workflow to vacate a resident.
     */
    static execute(pgId: string, tenantId: string, actorId: string): Promise<{
        id: string;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        pgId: string;
        roomId: string;
        monthlyRent: number;
        globalTenantId: string;
        bedId: string | null;
        historicalRoomNumber: string | null;
        historicalBedNumber: string | null;
        status: import(".prisma/client").$Enums.TenantStatus;
        securityDeposit: number;
        securityDepositStatus: string;
        depositCollectedAt: Date | null;
        depositRefundedAmount: number | null;
        depositRefundedAt: Date | null;
        depositRefundMode: string | null;
        moveInDate: Date;
        moveOutDate: Date | null;
    }>;
}
//# sourceMappingURL=VacateResidentWorkflow.d.ts.map