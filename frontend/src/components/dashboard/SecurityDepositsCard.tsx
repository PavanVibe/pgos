'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Wallet } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import Link from 'next/link';

export default function SecurityDepositsCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.summary(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/summary`),
    enabled: !!pgId,
  });

  const data = response?.data;

  return (
    <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-zinc-500" />
            Security Deposits
          </span>
          <Link
            href="/deposits"
            className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-0.5"
          >
            View Deposits <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-zinc-950 border border-zinc-900 rounded-xl" />
          </div>
        )}
        
        {isError && (
          <div className="text-xs text-red-500 py-4 font-semibold">
            Failed to load deposit metrics.
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="flex flex-col gap-3">
            {/* Collected Deposits Block */}
            <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex justify-between items-center select-none">
              <div className="space-y-0.5">
                <span className="text-2xl font-black text-blue-400 block tracking-tight">
                  ₹{(data?.collectedDeposits ?? 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Collected Deposits (Held)
                </span>
                <span className="text-[11px] font-medium text-zinc-500 block">
                  Net security funds currently secured.
                </span>
              </div>
            </div>

            {/* Split Dues Block */}
            <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-zinc-950 border border-zinc-900/60 rounded-xl text-xs font-semibold select-none">
              <div className="space-y-0.5">
                <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Pending Deposits</span>
                <span className="text-sm font-black text-amber-400 block">
                  ₹{(data?.pendingDeposits ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="space-y-0.5 border-l border-zinc-900 pl-3">
                <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Refund Liability</span>
                <span className="text-sm font-black text-zinc-350 block">
                  ₹{(data?.refundLiability ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
