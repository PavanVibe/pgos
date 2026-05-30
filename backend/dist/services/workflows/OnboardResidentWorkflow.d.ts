export declare class OnboardResidentWorkflow {
    /**
     * Executes the complete transaction-safe resident onboarding.
     */
    static execute(pgId: string, bedId: string, phone: string, name: string, email: string | undefined, moveInDate: Date, monthlyRent: number, securityDeposit: number, actorId: string, isQuickAdd?: boolean, kycDocUrl?: string, bypassEmailCheck?: boolean, transferResident?: boolean): Promise<{
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
//# sourceMappingURL=OnboardResidentWorkflow.d.ts.map