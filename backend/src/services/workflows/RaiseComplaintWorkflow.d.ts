export declare class RaiseComplaintWorkflow {
    /**
     * Raises a new complaint, resolving the tenant ID dynamically from room number or fallbacks.
     */
    static execute(pgId: string, roomOrArea: string, description: string, priority: 'low' | 'medium' | 'high' | 'urgent', category?: string, actorId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        deletedAt: Date | null;
        createdBy: string | null;
        updatedBy: string | null;
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
//# sourceMappingURL=RaiseComplaintWorkflow.d.ts.map