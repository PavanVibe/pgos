'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import QuickActions from "@/components/dashboard/QuickActions";
import TodaysTasksPanel from "@/components/dashboard/TodaysTasksPanel";
import PendingCollectionsCard from "@/components/dashboard/PendingCollectionsCard";
import MonthlyCollectionCard from "@/components/dashboard/MonthlyCollectionCard";
import OccupancySummaryCard from "@/components/dashboard/OccupancySummaryCard";
import OnboardingSheet from "@/components/onboarding/OnboardingSheet";
import MarkPaidSheet from "@/components/rent/MarkPaidSheet";
import OverdueResidentSheet from "@/components/rent/OverdueResidentSheet";
import RaiseComplaintSheet from "@/components/complaints/RaiseComplaintSheet";
import VacateResidentSheet from "@/components/vacate/VacateResidentSheet";
import OccupancyExplorerSheet from "@/components/dashboard/OccupancyExplorerSheet";
import ComplaintDrawer from "@/components/complaints/ComplaintDrawer";
import { Building2, ChevronDown } from 'lucide-react';

export default function DashboardPage() {
  const {
    activePgId,
    availablePgs,
    setActivePgId,
    setAvailablePgs
  } = useOrganizationStore();

  const { data: pgsResponse, isLoading: pgsLoading } = useQuery({
    queryKey: ['available-pgs'],
    queryFn: () => fetchApi('/pgs'),
  });

  useEffect(() => {
    if (pgsResponse?.data) {
      const pgs = pgsResponse.data.map((pg: any) => ({
        id: pg.id,
        name: pg.name,
      }));
      setAvailablePgs(pgs);
      if (pgs.length > 0 && (!activePgId || !pgs.find((p: any) => p.id === activePgId))) {
        setActivePgId(pgs[0].id);
      }
    }
  }, [pgsResponse, activePgId, setActivePgId, setAvailablePgs]);

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">PGOS Dashboard</h1>
          <p className="text-zinc-400 mt-1">Your operational command center.</p>
        </div>
        <div className="relative inline-block text-left">
          {pgsLoading ? (
            <div className="h-10 w-48 bg-zinc-800 animate-pulse rounded-lg" />
          ) : availablePgs.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-4 py-2.5 rounded-lg hover:border-zinc-700 transition-all cursor-pointer group">
                <Building2 className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <select
                  value={activePgId || ''}
                  onChange={(e) => setActivePgId(e.target.value)}
                  className="bg-transparent text-sm font-semibold focus:outline-none pr-6 cursor-pointer text-white appearance-none relative z-10"
                  style={{ backgroundImage: 'none' }}
                >
                  {availablePgs.map((pg) => (
                    <option key={pg.id} value={pg.id} className="bg-zinc-950 text-white">
                      {pg.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 pointer-events-none" />
              </div>
            </div>
          ) : (
            <span className="text-sm text-zinc-500">No active PGs. Please run DB seed.</span>
          )}
        </div>
      </div>

      {activePgId ? (
        <>
          <QuickActions pgId={activePgId} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TodaysTasksPanel pgId={activePgId} />
            </div>
            <div className="space-y-6">
              <MonthlyCollectionCard pgId={activePgId} />
              <PendingCollectionsCard pgId={activePgId} />
              <OccupancySummaryCard pgId={activePgId} />
              <ActivityFeed pgId={activePgId} />
            </div>
          </div>
          <OnboardingSheet />
          <MarkPaidSheet />
          <OverdueResidentSheet pgId={activePgId} />
          <RaiseComplaintSheet />
          <VacateResidentSheet pgId={activePgId} />
          <OccupancyExplorerSheet pgId={activePgId} />
          <ComplaintDrawer />
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/20">
          <p className="text-zinc-500 text-sm">Please create a PG or load demo data to start coordination.</p>
        </div>
      )}
    </div>
  );
}
