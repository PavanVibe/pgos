export declare const onboardResident: (pgId: string, bedId: string, phone: string, name: string, email: string | undefined, moveInDate: Date, monthlyRent: number, securityDeposit: number, actorId: string, isQuickAdd?: boolean) => Promise<{
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
//# sourceMappingURL=onboardingService.d.ts.map