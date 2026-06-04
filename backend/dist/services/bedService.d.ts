export declare const allocateBed: (bedId: string, globalTenantId: string, pgId: string, securityDeposit: number, moveInDate: Date, actorId: string) => Promise<{
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
//# sourceMappingURL=bedService.d.ts.map