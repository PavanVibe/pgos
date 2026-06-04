export declare class RaiseComplaintWorkflow {
    /**
     * Raises a new complaint, resolving the tenant ID dynamically from room number or fallbacks.
     */
    static execute(pgId: string, roomOrArea: string, description: string, priority: 'low' | 'medium' | 'high' | 'urgent', category?: string, actorId?: string): Promise<{
        id: string;
        pgTenantId: string;
        status: import(".prisma/client").$Enums.ComplaintStatus;
        createdBy: string | null;
        updatedBy: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        pgId: string;
        resolutionNotes: string | null;
        category: string;
        description: string;
        imageUrl: string | null;
        priority: import(".prisma/client").$Enums.ComplaintPriority;
        slaDeadline: Date;
        assignedResolverId: string | null;
        repairCost: number | null;
        responsibility: string | null;
        billUrl: string | null;
        resolvedImageUrl: string | null;
        resolvedAt: Date | null;
    }>;
}
//# sourceMappingURL=RaiseComplaintWorkflow.d.ts.map