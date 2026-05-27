'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ArrowUpRight, ShieldCheck } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useRentStore } from "@/store/useRentStore";
import { queryKeys } from "@/lib/queryKeys";

export default function PendingCollectionsCard({ pgId }: { pgId: string }) {
  const { openOverdue } = useRentStore();

  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.summary(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/summary`),
    enabled: !!pgId,
  });

  const data = response?.data;

  console.log("PendingCollectionsCard summary DTO:", data);

  return (
    <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-zinc-500" />
          Collections Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-zinc-950 border border-zinc-900 rounded-xl" />
            <div className="h-20 bg-zinc-950 border border-zinc-900 rounded-xl" />
          </div>
        )}
        
        {isError && (
          <div className="text-xs text-red-500 py-4 font-semibold">
            Failed to load collection statistics.
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="flex flex-col gap-3">
            {/* 1. Pending Collections Block */}
            <div 
              onClick={() => openOverdue('all-unpaid')}
              className="bg-zinc-950 border border-zinc-900/80 hover:border-zinc-800 hover:bg-zinc-900/10 active:scale-[0.99] p-3.5 rounded-xl cursor-pointer transition-all duration-200 select-none group flex justify-between items-center"
              title="Click to view all unpaid rent"
            >
              <div className="space-y-0.5">
                <span className="text-2xl font-black text-white block tracking-tight">
                  ₹{(data?.pendingRent ?? 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Pending Collections
                </span>
                <span className="text-[11px] font-medium text-zinc-500 block">
                  {(data?.unpaidInvoicesCount ?? 0)} unpaid invoice{(data?.unpaidInvoicesCount ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-primary transition-colors" />
            </div>

            {/* 2. Overdue Collections Block */}
            <div 
              onClick={() => openOverdue('overdue')}
              className={`border p-3.5 rounded-xl cursor-pointer transition-all duration-200 select-none group flex justify-between items-center
                ${(data?.overdueCount ?? 0) > 0 
                  ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20 hover:bg-red-500/10 active:scale-[0.99]' 
                  : 'bg-zinc-950 border-zinc-900/60 hover:border-zinc-850 hover:bg-zinc-900/10'}`}
              title="Click to view overdue residents"
            >
              <div className="space-y-0.5">
                <span className={`text-2xl font-black block tracking-tight
                  ${(data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-zinc-400'}`}
                >
                  ₹{(data?.overdueRent ?? 0).toLocaleString('en-IN')}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider block
                  ${(data?.overdueCount ?? 0) > 0 ? 'text-red-400/80' : 'text-zinc-500'}`}
                >
                  Overdue Collections
                </span>
                {(data?.overdueCount ?? 0) > 0 ? (
                  <span className="text-[11px] font-bold text-red-400/70 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                    {(data?.overdueCount ?? 0)} resident{(data?.overdueCount ?? 0) !== 1 ? 's' : ''} need follow-up
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-green-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                    No overdue collections
                  </span>
                )}
              </div>
              <ArrowUpRight className={`h-4 w-4 transition-colors
                ${(data?.overdueCount ?? 0) > 0 ? 'text-red-900 group-hover:text-red-400' : 'text-zinc-700 group-hover:text-primary'}`} 
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
