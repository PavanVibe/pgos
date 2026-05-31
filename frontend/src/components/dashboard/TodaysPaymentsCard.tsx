'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, IndianRupee, ArrowRight, Wallet, Sparkles } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import Link from 'next/link';

export default function TodaysPaymentsCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.dashboard.summary(pgId),
    queryFn: () => fetchApi(`/pgs/${pgId}/dashboard/summary`),
    enabled: !!pgId,
  });

  const data = response?.data || {
    todaysPaymentsAmount: 0,
    todaysPaymentsCount: 0
  };

  const amount = data.todaysPaymentsAmount ?? 0;
  const count = data.todaysPaymentsCount ?? 0;

  return (
    <Link href="/collections" className="block select-none group">
      <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-800 transition-all duration-300 relative overflow-hidden">
        {/* Neon Gradient Border Glow */}
        {amount > 0 && (
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 animate-pulse" />
        )}
        
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
            <CheckCircle2 className={`h-5 w-5 ${amount > 0 ? 'text-emerald-400 animate-pulse' : 'text-zinc-650'}`} />
            Today's Payments
            <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-0.5">
              Ledger <ArrowRight className="h-3 w-3" />
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 w-24 bg-zinc-900 rounded" />
              <div className="h-4 w-32 bg-zinc-900 rounded" />
            </div>
          )}
          
          {isError && (
            <div className="text-sm text-red-500 py-4 font-semibold">
              Failed to load payments.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Collected Today</span>
                <span className={`text-3xl font-black block flex items-center mt-1 ${amount > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  <IndianRupee className="h-6 w-6" />
                  {amount.toLocaleString('en-IN')}
                </span>
              </div>
              
              <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between text-xs font-semibold text-zinc-400">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-zinc-550" />
                  Transactions count
                </span>
                <span className={`font-black text-sm ${count > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {count} Payment{count !== 1 ? 's' : ''}
                </span>
              </div>

              {amount > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-emerald-400/90 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  Online deposits active & settled
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
