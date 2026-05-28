export declare const allocateBed: (bedId: string, globalTenantId: string, pgId: string, securityDeposit: number, moveInDate: Date, actorId: string) => Promise<{
    id: string;
    createdBy: string | null;
    updatedBy: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    pgId: string;
    roomId: string;
    globalTenantId: string;
    bedId: string | null;
    historicalRoomNumber: string | null;
    historicalBedNumber: string | null;
    status: import(".prisma/client").$Enums.TenantStatus;
    securityDeposit: number;
    moveInDate: Date;
    moveOutDate: Date | null;
}>;
//# sourceMappingURL=bedService.d.ts.map