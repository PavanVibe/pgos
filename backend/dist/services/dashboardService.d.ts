export declare const getPGDashboardSummary: (pgId: string, orgId: string) => Promise<{
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    pendingRent: number;
    unpaidInvoicesCount: number;
    overdueRent: number;
    overdueCount: number;
    dueTodayCount: number;
    chronicDelayCount: number;
    unresolvedComplaints: number;
    highPriorityComplaints: number;
    monthlyExpenses: number;
    collectedThisMonth: number;
    payingResidentsCount: number;
    collectedLastMonth: number;
}>;
//# sourceMappingURL=dashboardService.d.ts.map