export declare const searchTenantByPhone: (phone: string) => Promise<{
    id: string;
    name: string | null;
    profiles: {
        pg: {
            name: string;
        };
        pgId: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        moveOutDate: Date | null;
    }[];
    email: string | null;
    kycDocUrl: string | null;
    trustScore: number;
} | null>;
//# sourceMappingURL=tenantService.d.ts.map