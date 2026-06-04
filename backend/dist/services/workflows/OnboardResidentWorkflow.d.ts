export declare class OnboardResidentWorkflow {
    /**
     * Executes the complete transaction-safe resident onboarding.
     */
    static execute(pgId: string, bedId: string, phone: string, name: string, email: string | undefined, moveInDate: Date, monthlyRent: number, securityDeposit: number, actorId: string, isQuickAdd?: boolean, kycDocUrl?: string, bypassEmailCheck?: boolean, transferResident?: boolean, depositCollected?: boolean, depositPaymentMode?: string, depositCollectedAt?: Date): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        pgId: string;
        roomId: string;
        bedId: string | null;
        monthlyRent: number;
        globalTenantId: string;
        historicalRoomNumber: string | null;
        historicalBedNumber: string | null;
        securityDeposit: number;
        securityDepositStatus: string;
        depositCollectedAt: Date | null;
        depositRefundedAmount: number | null;
        depositDeductionAmount: number | null;
        depositRefundedAt: Date | null;
        depositRefundMode: string | null;
        depositRefundNotes: string | null;
        settlementStatus: string;
        moveInDate: Date;
        moveOutDate: Date | null;
    }>;
}
//# sourceMappingURL=OnboardResidentWorkflow.d.ts.map