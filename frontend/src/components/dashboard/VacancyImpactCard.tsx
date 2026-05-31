'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bed, Users, DoorOpen, IndianRupee, Sparkles, ChevronRight } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useOccupancyStore } from "@/store/useOccupancyStore";

export default function VacancyImpactCard({ pgId }: { pgId: string }) {
  const { openOccupancy } = useOccupancyStore();
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['vacancy-impact', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/operations/vacancy-impact`),
    enabled: !!pgId,
  });

  const data = response?.data || {
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    potentialRevenueLost: 0
  };

  return (
    <Card 
      onClick={() => {
        console.log("[DIAGNOSTIC] Occupancy Summary Card clicked, triggering openOccupancy...");
        openOccupancy();
      }}
      className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-800 transition-all duration-300 cursor-pointer hover:bg-zinc-950/40 active:scale-[0.99] group select-none"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
          <Bed className="h-5 w-5 text-purple-400 group-hover:animate-pulse" />
          Occupancy Summary
          <span className="text-[11px] font-semibold text-zinc-550 group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-0.5">
            Explore live map <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 w-24 bg-zinc-900 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 bg-zinc-900 rounded" />
              <div className="h-12 bg-zinc-900 rounded" />
            </div>
          </div>
        )}
        
        {isError && (
          <div className="text-sm text-red-500 py-4 font-semibold">
            Failed to load occupancy summary.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Occupied Beds */}
              <div className="flex items-center gap-3 bg-zinc-950/40 p-3 border border-zinc-900 rounded-xl hover:border-zinc-850 transition-colors">
                <div className="p-2 bg-green-500/10 rounded-full border border-green-500/10">
                  <Users className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-white leading-none">
                    {data.occupiedBeds} <span className="text-zinc-650 font-normal text-xs">/ {data.totalBeds}</span>
                  </p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Occupied Beds</p>
                </div>
              </div>

              {/* Vacant Beds */}
              <div className="flex items-center gap-3 bg-zinc-950/40 p-3 border border-zinc-900 rounded-xl hover:border-zinc-850 transition-colors">
                <div className="p-2 bg-amber-500/10 rounded-full border border-amber-500/10">
                  <DoorOpen className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-amber-400 leading-none">{data.vacantBeds}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Vacant Beds</p>
                </div>
              </div>
            </div>

            {/* Potential Monthly Revenue */}
            <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Potential Monthly Revenue
                </span>
                <p className="text-xs text-zinc-400">If 100% beds are occupied</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-purple-400 flex items-center justify-end">
                  <IndianRupee className="h-4.5 w-4.5" />
                  {data.potentialRevenueLost.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
