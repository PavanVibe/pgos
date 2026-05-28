export declare class OperationalSummaryService {
    /**
     * Aggregates tasks prioritizing urgency.
     */
    static getTasksSummary(pgId: string): Promise<{
        id: string;
        title: string;
        subtitle: string;
        type: string;
        urgency: string;
        actionLabel: string;
    }[]>;
    /**
     * Aggregates occupancy state from beds.
     */
    static getOccupancySummary(pgId: string): Promise<{
        totalBeds: number;
        occupiedBeds: number;
        vacantBeds: number;
        occupancyPercentage: number;
        moveOutsToday: number;
        blockedBeds: number;
    }>;
    static getActivityFeed(pgId: string, limit?: number): Promise<{
        metadata: any;
        id: string;
        createdAt: Date;
        entityId: string;
        eventType: string;
    }[]>;
}
//# sourceMappingURL=OperationalSummaryService.d.ts.map