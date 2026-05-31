'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, IndianRupee, ChevronRight, TrendingDown } from "lucide-react";
import { fetchApi } from "@/lib/api";
import Link from 'next/link';

export default function ProfitSummaryCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['profit-summary', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/profit/summary`),
    enabled: !!pgId,
  });

  const data = response?.data || {
    revenue: 0,
    expenses: 0,
    profit: 0
  };

  return (
    <Link href="/profit" className="block select-none group">
      <Card className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-800 transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
            <TrendingUp className="h-5 w-5 text-green-400 group-hover:animate-pulse" />
            Monthly Earnings
            <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-0.5">
              View Profit Hub <ChevronRight className="h-3 w-3" />
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
              Failed to load profit summary.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Net Profit</span>
                <span className={`text-3xl font-black block flex items-center mt-1 ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <IndianRupee className="h-6 w-6" />
                  {data.profit.toLocaleString('en-IN')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-900/60 text-xs font-semibold text-zinc-450">
                <div>
                  <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Revenue</span>
                  <span className="text-sm font-black text-zinc-200 mt-0.5 block flex items-center">
                    ₹{data.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Expenses</span>
                  <span className="text-sm font-black text-zinc-300 mt-0.5 block flex items-center">
                    ₹{data.expenses.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
