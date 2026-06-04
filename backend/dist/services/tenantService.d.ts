export declare const searchTenantByPhone: (phone: string) => Promise<{
    name: string | null;
    id: string;
    profiles: {
        status: import(".prisma/client").$Enums.TenantStatus;
        pg: {
            name: string;
        };
        pgId: string;
        moveOutDate: Date | null;
    }[];
    email: string | null;
    kycDocUrl: string | null;
    trustScore: number;
} | null>;
//# sourceMappingURL=tenantService.d.ts.map