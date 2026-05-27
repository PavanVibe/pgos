export declare class VacateResidentWorkflow {
    /**
     * Safe transaction-wrapped workflow to vacate a resident.
     */
    static execute(pgId: string, tenantId: string, actorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
        pgId: string;
        roomId: string;
        historicalRoomNumber: string | null;
        historicalBedNumber: string | null;
        status: import(".prisma/client").$Enums.TenantStatus;
        securityDeposit: number;
        moveInDate: Date;
        moveOutDate: Date | null;
        globalTenantId: string;
        bedId: string | null;
    }>;
}
//# sourceMappingURL=VacateResidentWorkflow.d.ts.map