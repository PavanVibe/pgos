export interface DeductionItemInput {
    title: string;
    amount: number;
    notes?: string;
}
export declare class ResolveComplaintWorkflow {
    /**
     * Resolves an existing complaint and handles damage recovery allocations, owner expenses, or split room charges.
     */
    static execute(pgId: string, complaintId: string, actorId: string, repairCost?: number, responsibility?: 'SPECIFIC_RESIDENT' | 'ENTIRE_ROOM' | 'OWNER', assignedTenantId?: string, billUrl?: string, resolvedImageUrl?: string, resolutionNotes?: string, deductionItems?: DeductionItemInput[], recoveryMethodInput?: string): Promise<{
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
//# sourceMappingURL=ResolveComplaintWorkflow.d.ts.map