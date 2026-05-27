export const queryKeys = {
  dashboard: {
    tasks: (pgId: string) => ['dashboard', 'tasks', pgId],
    activity: (pgId: string) => ['dashboard', 'activity', pgId],
    occupancy: (pgId: string) => ['dashboard', 'occupancy', pgId],
    summary: (pgId: string) => ['dashboard', 'summary', pgId],
  },
  complaints: (pgId: string) => ['complaints', pgId],
  invoices: (pgId: string) => ['invoices', pgId],
  residents: (pgId: string) => ['residents', pgId],
};
