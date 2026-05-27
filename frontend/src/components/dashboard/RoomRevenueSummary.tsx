'use client';

import { 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

interface RevenueStats {
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
  profitability: number;
}

interface RoomRevenueSummaryProps {
  revenue: RevenueStats;
}

export function RoomRevenueSummary({ revenue }: RoomRevenueSummaryProps) {
  const collectionPercentage = revenue.profitability;

  return (
    <div className="space-y-6">
      {/* 1. Collections & Profitability Gauge */}
      <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Collections Success</h5>
            <p className="text-[10px] text-zinc-500 mt-0.5">Billing collection and realization rate</p>
          </div>
          <span className={`text-lg font-bold ${collectionPercentage >= 90 ? 'text-green-400' : collectionPercentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
            {collectionPercentage}%
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500
              ${collectionPercentage >= 90 ? 'bg-green-500' : collectionPercentage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${collectionPercentage}%` }}
          />
        </div>

        {/* Realization text */}
        <div className="flex items-start gap-2 pt-1">
          {revenue.totalDues > 0 ? (
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          )}
          <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
            {revenue.totalDues > 0 
              ? `Outstanding collection risk identified. ₹${revenue.totalDues} remains uncollected for this room.` 
              : 'Excellent financial health! This room has achieved 100% billing collection efficiency.'}
          </p>
        </div>
      </div>

      {/* 2. Grid Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Collected */}
        <div className="bg-zinc-950/60 border border-zinc-900 p-3.5 rounded-xl space-y-1.5 hover:border-zinc-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Collected</span>
            <TrendingUp className="h-3.5 w-3.5 text-green-400" />
          </div>
          <p className="text-sm font-black text-white">₹{revenue.totalCollected}</p>
          <p className="text-[9px] text-green-400/80 font-bold">Lifetime Collection</p>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-zinc-950/60 border border-zinc-900 p-3.5 rounded-xl space-y-1.5 hover:border-zinc-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pending Dues</span>
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          </div>
          <p className="text-sm font-black text-white">₹{revenue.totalDues}</p>
          <p className="text-[9px] text-red-400/80 font-bold">Outstanding</p>
        </div>

        {/* Total Billed */}
        <div className="bg-zinc-950/60 border border-zinc-900 p-3.5 rounded-xl space-y-1.5 hover:border-zinc-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Gross Billed</span>
            <DollarSign className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <p className="text-sm font-black text-white">₹{revenue.totalBilled}</p>
          <p className="text-[9px] text-zinc-500 font-bold">Total Invoiced</p>
        </div>
      </div>
    </div>
  );
}
