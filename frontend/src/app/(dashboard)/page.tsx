'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { fetchApi } from '@/lib/api';
import QuickActions from "@/components/dashboard/QuickActions";
import ProfitSummaryCard from "@/components/dashboard/ProfitSummaryCard";
import OnboardingSheet from "@/components/onboarding/OnboardingSheet";
import MarkPaidSheet from "@/components/rent/MarkPaidSheet";
import OverdueResidentSheet from "@/components/rent/OverdueResidentSheet";
import RaiseComplaintSheet from "@/components/complaints/RaiseComplaintSheet";
import VacateResidentSheet from "@/components/vacate/VacateResidentSheet";
import OccupancyExplorerSheet from "@/components/dashboard/OccupancyExplorerSheet";
import ComplaintDrawer from "@/components/complaints/ComplaintDrawer";
import ResolveComplaintSheet from "@/components/complaints/ResolveComplaintSheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, ChevronDown, Plus, Settings, Users, DoorOpen, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

interface TenantProfile {
  id: string;
  status: string;
  globalTenant?: {
    name: string;
    phone: string;
  };
}

interface Bed {
  id: string;
  bedNumber: string;
  tenantProfile: TenantProfile | null;
}

interface Room {
  id: string;
  number: string;
  floor: string | null;
  capacity: number;
  isActive: boolean;
  beds: Bed[];
}

export default function DashboardPage() {
  const {
    activePgId,
    availablePgs,
    setActivePgId,
    setAvailablePgs
  } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();

  // 1. Fetch PGs
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

  // 2. Fetch Rooms & Beds for Occupancy Grid
  const { data: roomsResponse, isLoading: roomsLoading } = useQuery({
    queryKey: ['pg-rooms', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/rooms`),
    enabled: !!activePgId,
  });

  const rooms: Room[] = roomsResponse?.data || [];

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      
      {/* Header and PG Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">PGOS Dashboard</h1>
          <p className="text-zinc-400 mt-1">Your resident-centric operational dashboard.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {availablePgs.length > 0 && (
            <Link
              href="/settings/pgs"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center justify-center"
              title="PG Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </Link>
          )}

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
              <Link 
                href="/settings/pgs" 
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl"
              >
                <Plus className="h-4.5 w-4.5 text-primary" /> Setup PG
              </Link>
            )}
          </div>
        </div>
      </div>

      {activePgId ? (
        <>
          {/* Section 1: Quick Actions */}
          <QuickActions pgId={activePgId} />

          {/* Grid Layout for Sections 2 & 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Section 2: Visual Room Grid & Occupancy Matrix */}
            <Card className="lg:col-span-2 border-zinc-900 bg-zinc-950/20 backdrop-blur-md flex flex-col">
              <CardHeader className="border-b border-zinc-900/60 pb-4">
                <CardTitle className="text-lg font-black text-zinc-150 flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary animate-pulse" /> Occupancy & Room Matrix
                </CardTitle>
                <CardDescription className="text-zinc-550 text-xs">
                  Real-time bed allocation status. Red indicates occupied, green represents vacant.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1">
                {roomsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-28 bg-zinc-900 rounded-xl" />
                    ))}
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-zinc-900 rounded-xl">
                    <DoorOpen className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 font-bold">No rooms configured for this PG.</p>
                    <Link href="/rooms" className="text-xs text-primary font-black hover:underline mt-1.5 block">
                      Configure Rooms
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {rooms.map((room) => {
                      const occupiedBeds = room.beds.filter(b => b.tenantProfile !== null).length;
                      const vacantBeds = room.capacity - occupiedBeds;
                      const isFull = vacantBeds === 0;

                      return (
                        <div 
                          key={room.id}
                          className={`p-4 rounded-xl border bg-zinc-950/40 relative overflow-hidden transition-all group select-none
                            ${isFull ? 'border-zinc-900' : 'border-zinc-900/80 hover:border-zinc-750'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                              {room.floor || 'G. Floor'}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border 
                              ${isFull 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                            >
                              {isFull ? 'Full' : `${vacantBeds} Vacant`}
                            </span>
                          </div>

                          <h4 className="text-base font-black text-zinc-200 group-hover:text-primary transition-colors">
                            Room {room.number}
                          </h4>

                          {/* Bed Visual dots & Resident Links */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-3">
                            {room.beds.map((bed) => {
                              const occupied = !!bed.tenantProfile;
                              return (
                                <div key={bed.id} className="relative group/bed">
                                  <button
                                    type="button"
                                    onClick={() => occupied && openProfile(bed.tenantProfile!.id)}
                                    className={`h-3 w-3 rounded-full border transition-all cursor-pointer
                                      ${occupied 
                                        ? 'bg-red-500 border-red-600 hover:scale-125' 
                                        : 'bg-green-500/10 border-green-500 hover:bg-green-500'}`}
                                    title={occupied ? `Bed ${bed.bedNumber}: ${bed.tenantProfile?.globalTenant?.name}` : `Bed ${bed.bedNumber}: Vacant`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Business Summary */}
            <div className="space-y-6">
              <ProfitSummaryCard pgId={activePgId} />
              
              {/* Optional: Add mini Occupancy Summary details */}
              <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                    Quick Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs font-semibold">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
                    <span className="text-zinc-550">Total Rooms:</span>
                    <span className="text-zinc-200 font-extrabold">{rooms.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
                    <span className="text-zinc-550">Active Residents:</span>
                    <span className="text-zinc-200 font-extrabold">
                      {rooms.reduce((sum, r) => sum + r.beds.filter(b => b.tenantProfile !== null).length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-550">Vacant Beds:</span>
                    <span className="text-zinc-200 font-extrabold">
                      {rooms.reduce((sum, r) => sum + r.beds.filter(b => b.tenantProfile === null).length, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>

          {/* Action Sheets/Drawers mounted invisibly */}
          <OnboardingSheet />
          <MarkPaidSheet />
          <OverdueResidentSheet pgId={activePgId} />
          <RaiseComplaintSheet />
          <VacateResidentSheet pgId={activePgId} />
          <OccupancyExplorerSheet pgId={activePgId} />
          <ComplaintDrawer />
          <ResolveComplaintSheet />
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/20 gap-4">
          <p className="text-zinc-500 text-sm">Please create a PG or load demo data to start coordination.</p>
          <Link
            href="/settings/pgs"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            Configure Your First PG
          </Link>
        </div>
      )}
    </div>
  );
}
