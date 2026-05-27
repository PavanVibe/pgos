export declare const vacateResident: (tenantId: string, pgId: string, actorId: string) => Promise<{
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
//# sourceMappingURL=vacateService.d.ts.map