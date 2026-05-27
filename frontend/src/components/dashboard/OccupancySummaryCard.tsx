'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bed, Users, DoorOpen, LogOut, ChevronRight } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useOccupancyStore } from "@/store/useOccupancyStore";

export default function OccupancySummaryCard({ pgId }: { pgId: string }) {
  const { openOccupancy } = useOccupancyStore();
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.occupancy(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/occupancy`),
    enabled: !!pgId,
  });

  const data = response?.data;

  return (
    <Card 
      onClick={openOccupancy}
      className="col-span-1 border-dashed cursor-pointer transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-950/30 active:scale-[0.99] select-none hover:shadow-lg hover:shadow-zinc-950/20 group"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bed className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          Occupancy
          <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-0.5">
            Explore live map <ChevronRight className="h-3 w-3" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 w-24 bg-muted rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
            </div>
          </div>
        )}
        
        {isError && (
          <div className="text-sm text-red-500 py-4">
            Failed to load occupancy.
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-4">
            <div>
              <span className="text-4xl font-bold">{data.occupancyPercentage}%</span>
              <span className="text-sm text-muted-foreground ml-2">Occupied</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <Users className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">{data.occupiedBeds}</p>
                  <p className="text-xs text-muted-foreground">Occupied</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <DoorOpen className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">{data.vacantBeds}</p>
                  <p className="text-xs text-muted-foreground">Vacant</p>
                </div>
              </div>

              {data.moveOutsToday > 0 && (
                <div className="flex items-center gap-2 col-span-2 mt-2 pt-2 border-t">
                  <div className="p-2 bg-red-500/10 rounded-full">
                    <LogOut className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-500 leading-none">{data.moveOutsToday} Move-out{data.moveOutsToday > 1 ? 's' : ''} Today</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
