export declare class ResolveComplaintWorkflow {
    /**
     * Resolves a pending complaint.
     */
    static execute(pgId: string, complaintId: string, actorId: string): Promise<{
        id: string;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        pgId: string;
        status: import(".prisma/client").$Enums.ComplaintStatus;
        pgTenantId: string;
        category: string;
        description: string;
        imageUrl: string | null;
        priority: import(".prisma/client").$Enums.ComplaintPriority;
        slaDeadline: Date;
        assignedResolverId: string | null;
    }>;
}
//# sourceMappingURL=ResolveComplaintWorkflow.d.ts.map