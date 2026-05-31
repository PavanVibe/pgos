'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, IndianRupee, ChevronRight, MessageSquareWarning, LogIn, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { fetchApi } from "@/lib/api";
import Link from 'next/link';

interface OperationsSummary {
  rentDueCount: number;
  rentDueAmount: number;
  depositPendingCount: number;
  depositPendingAmount: number;
  damageRecoveriesCount: number;
  damageRecoveriesAmount: number;
  complaintsPendingCount: number;
  moveInsCount: number;
  moveOutsCount: number;
}

export default function TodaysOperationsCard({ pgId }: { pgId: string }) {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['operations-summary', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/operations/summary`),
    enabled: !!pgId,
  });

  const data: OperationsSummary = response?.data || {
    rentDueCount: 0,
    rentDueAmount: 0,
    depositPendingCount: 0,
    depositPendingAmount: 0,
    damageRecoveriesCount: 0,
    damageRecoveriesAmount: 0,
    complaintsPendingCount: 0,
    moveInsCount: 0,
    moveOutsCount: 0
  };

  const hasIssues = data.rentDueCount > 0 || data.depositPendingCount > 0 || data.damageRecoveriesCount > 0 || data.complaintsPendingCount > 0;

  return (
    <Card className="border border-zinc-900 bg-zinc-950/20">
      <CardHeader className="pb-3 border-b border-zinc-900/60">
        <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
          <LayoutDashboard className="h-5 w-5 text-amber-400" />
          PG Command Center
          {hasIssues ? (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 ml-auto">
              Needs Attention
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 ml-auto">
              All Stable
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 animate-pulse">
            <div className="h-20 bg-zinc-900 rounded-xl" />
            <div className="h-20 bg-zinc-900 rounded-xl" />
            <div className="h-20 bg-zinc-900 rounded-xl" />
            <div className="h-20 bg-zinc-900 rounded-xl" />
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-500 font-semibold py-2">Failed to load operations summary.</p>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Rent Due Card */}
            <Link href="/collections" className="block group">
              <div className="bg-zinc-950/40 border border-zinc-900 hover:border-orange-500/30 p-3.5 rounded-xl space-y-1.5 transition-all">
                <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold group-hover:text-orange-400 transition-colors">Rent Due</span>
                <span className="text-base font-black text-white block flex items-center">
                  <IndianRupee className="h-3.5 w-3.5 text-zinc-400 mr-0.5" />
                  {data.rentDueAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {data.rentDueCount} residents owe
                </span>
              </div>
            </Link>

            {/* Deposit Due Card */}
            <Link href="/collections" className="block group">
              <div className="bg-zinc-950/40 border border-zinc-900 hover:border-yellow-500/30 p-3.5 rounded-xl space-y-1.5 transition-all">
                <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold group-hover:text-yellow-400 transition-colors">Deposit Due</span>
                <span className="text-base font-black text-white block flex items-center">
                  <IndianRupee className="h-3.5 w-3.5 text-zinc-400 mr-0.5" />
                  {data.depositPendingAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {data.depositPendingCount} pending
                </span>
              </div>
            </Link>

            {/* Damage Charges Card */}
            <Link href="/recoveries" className="block group">
              <div className="bg-zinc-950/40 border border-zinc-900 hover:border-purple-500/30 p-3.5 rounded-xl space-y-1.5 transition-all">
                <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold group-hover:text-purple-400 transition-colors">Damage Charges</span>
                <span className="text-base font-black text-white block flex items-center">
                  <IndianRupee className="h-3.5 w-3.5 text-zinc-400 mr-0.5" />
                  {data.damageRecoveriesAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {data.damageRecoveriesCount} outstanding
                </span>
              </div>
            </Link>

            {/* Pending Complaints */}
            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl space-y-1.5">
              <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold">Complaints</span>
              <span className="text-base font-black text-white block flex items-center gap-1.5">
                <MessageSquareWarning className={`h-4 w-4 ${data.complaintsPendingCount > 0 ? 'text-red-400' : 'text-zinc-500'}`} />
                {data.complaintsPendingCount} Open
              </span>
              <span className="text-[10px] text-zinc-500 block">
                Helpers assigned
              </span>
            </div>

            {/* Move Ins */}
            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl space-y-1.5">
              <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold">Move-Ins</span>
              <span className="text-base font-black text-white block flex items-center gap-1.5">
                <LogIn className="h-4 w-4 text-emerald-400" />
                {data.moveInsCount} Residents
              </span>
              <span className="text-[10px] text-zinc-500 block">
                This month snapshot
              </span>
            </div>

            {/* Move Outs */}
            <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl space-y-1.5">
              <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest block font-bold">Move-Outs</span>
              <span className="text-base font-black text-white block flex items-center gap-1.5">
                <LogOut className="h-4 w-4 text-red-400" />
                {data.moveOutsCount} Scheduled
              </span>
              <span className="text-[10px] text-zinc-550 block">
                Pending settlement
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
