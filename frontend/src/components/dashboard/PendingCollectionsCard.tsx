'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ArrowUpRight } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import Link from 'next/link';

export default function PendingCollectionsCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.summary(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/summary`),
    enabled: !!pgId,
  });

  const data = response?.data;

  console.log("PendingCollectionsCard summary DTO:", data);

  return (
    <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 hover:bg-zinc-950/30 transition-all duration-300 select-none group relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
            MONEY OWED TO YOU
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-14 bg-zinc-950 border border-zinc-900 rounded-xl" />
            <div className="h-14 bg-zinc-950 border border-zinc-900 rounded-xl" />
            <div className="h-14 bg-zinc-950 border border-zinc-900 rounded-xl" />
          </div>
        )}
        
        {isError && (
          <div className="text-xs text-red-500 py-4 font-semibold">
            Failed to load collection statistics.
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="flex flex-col gap-3">
            {/* 1. Rent Due Block */}
            <Link href="/collections" className="block group/rent">
              <div className="bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 p-3.5 rounded-xl flex justify-between items-center transition-colors cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                    Rent Due
                  </span>
                  <span className="text-xl font-black text-white block tracking-tight">
                    ₹{(data?.pendingRent || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="text-[10px] font-black text-zinc-500 group-hover/rent:text-primary uppercase tracking-wider underline transition-colors">
                  [View Collections]
                </span>
              </div>
            </Link>

            {/* 2. Damage Charges Block */}
            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl flex justify-between items-center transition-colors">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                  Damage Charges
                </span>
                <span className={`text-xl font-black block tracking-tight ${data?.totalPendingRecoveryAmount > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                  ₹{(data?.totalPendingRecoveryAmount || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-medium text-amber-500/80 block mt-0.5">
                  {data?.pendingRecoveriesCount || 0} resident{data?.pendingRecoveriesCount !== 1 ? 's' : 's'} owe money
                </span>
              </div>
              <Link href="/recoveries" className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-wider underline cursor-pointer select-none">
                [View Recoveries]
              </Link>
            </div>

            {/* 3. Total Outstanding Block */}
            <div className="bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-wider block">
                  Total Outstanding
                </span>
                <span className="text-2xl font-black text-red-400 block tracking-tight">
                  ₹{(data?.totalOutstanding || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
