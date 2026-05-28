export declare const vacateResident: (tenantId: string, pgId: string, actorId: string) => Promise<{
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
//# sourceMappingURL=vacateService.d.ts.map