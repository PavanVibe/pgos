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
        moveInDate: Date;
        moveOutDate: Date | null;
    }>;
}
//# sourceMappingURL=VacateResidentWorkflow.d.ts.map