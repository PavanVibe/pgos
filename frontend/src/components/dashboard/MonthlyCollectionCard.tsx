'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Users, TrendingUp } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export default function MonthlyCollectionCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.summary(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/summary`),
    enabled: !!pgId,
  });

  const data = response?.data;

  // Trend computation
  const currentMonth = data?.collectedThisMonth ?? 0;
  const lastMonth = data?.collectedLastMonth ?? 0;
  let trendPercentage = 0;
  if (lastMonth > 0) {
    trendPercentage = parseFloat(((currentMonth - lastMonth) / lastMonth * 100).toFixed(1));
  } else if (currentMonth > 0) {
    trendPercentage = 100;
  }

  return (
    <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-primary" />
          This Month Collection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-10 bg-zinc-900 rounded" />
            <div className="h-14 bg-zinc-900 rounded" />
          </div>
        )}

        {isError && (
          <div className="text-xs text-red-500 font-semibold py-2">
            Failed to retrieve monthly collection metrics.
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-3.5">
            <div>
              <span className="text-3xl font-black text-white block tracking-tight">
                ₹{currentMonth.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
                Total Collected (Current Month)
              </span>
            </div>

            {/* Comparison Trend Block */}
            {lastMonth > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full text-[10px]
                  ${trendPercentage >= 0 
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                    : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}
                >
                  <TrendingUp className="h-3 w-3 shrink-0" />
                  {trendPercentage >= 0 ? `+${trendPercentage}%` : `${trendPercentage}%`}
                </div>
                <span className="text-zinc-500 font-medium">vs ₹{lastMonth.toLocaleString('en-IN')} last month</span>
              </div>
            )}

            {/* Sub-metrics Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-900/60 text-xs font-semibold">
              <div>
                <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Pending Rents</span>
                <span className="text-zinc-200 text-sm font-extrabold mt-0.5">
                  ₹{(data?.pendingRent ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-l border-zinc-900/80 pl-3">
                <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Paying Residents</span>
                <span className="text-zinc-200 text-sm font-extrabold mt-0.5 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-zinc-500" />
                  {data?.payingResidentsCount ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
