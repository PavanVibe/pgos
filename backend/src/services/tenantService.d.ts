export declare const searchTenantByPhone: (phone: string) => Promise<{
    id: string;
    name: string | null;
    email: string | null;
    kycDocUrl: string | null;
    trustScore: number;
    profiles: {
        pg: {
            name: string;
        };
        pgId: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        moveOutDate: Date | null;
    }[];
} | null>;
//# sourceMappingURL=tenantService.d.ts.map