export declare const getPGDashboardSummary: (pgId: string, orgId: string) => Promise<{
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    pendingRent: number;
    unresolvedComplaints: number;
    highPriorityComplaints: number;
    monthlyExpenses: number;
    overdueCount: number;
}>;
//# sourceMappingURL=dashboardService.d.ts.map