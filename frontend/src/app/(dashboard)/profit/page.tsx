'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Building2, 
  ChevronDown, 
  IndianRupee, 
  Sparkles,
  TrendingUp,
  Percent,
  Layers,
  ArrowRight,
  TrendingDown,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface TopExpenseItem {
  category: string;
  amount: number;
}

interface ProfitData {
  month: number;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  breakdown: {
    rentCollected: number;
    depositsCollected: number;
    damageRecoveries: number;
    expensesByCategory: Record<string, number>;
    topExpenses: TopExpenseItem[];
  };
}

function ProfitContent() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();

  // Fetch Profit Summary
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['profit-summary', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/profit/summary`),
    enabled: !!activePgId,
  });

  const data: ProfitData = response?.data || {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    revenue: 0,
    expenses: 0,
    profit: 0,
    breakdown: {
      rentCollected: 0,
      depositsCollected: 0,
      damageRecoveries: 0,
      expensesByCategory: {},
      topExpenses: []
    }
  };

  const currentMonthName = new Date(data.year, data.month - 1).toLocaleString('en-IN', { month: 'long' });

  const getCategoryLabel = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'ELECTRICITY': return 'Electricity Bill';
      case 'WATER': return 'Water Dues';
      case 'INTERNET': return 'Internet & Wifi';
      case 'SALARY': return 'Staff Salary';
      case 'FOOD': return 'Mess & Food';
      case 'MAINTENANCE': return 'Repairs & Maintenance';
      case 'FURNITURE': return 'Furniture & Assets';
      default: return 'Miscellaneous';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900 transition-all text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              Profit Dashboard
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Know exactly how much money your PG business is making and losing this month.</p>
          </div>
        </div>

        {/* PG Selector Context */}
        <div className="relative inline-block text-left">
          {availablePgs.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 px-4 py-2.5 rounded-lg hover:border-zinc-700 transition-all cursor-pointer group">
                <Building2 className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                <select
                  value={activePgId || ''}
                  onChange={(e) => setActivePgId(e.target.value)}
                  className="bg-transparent text-sm font-semibold focus:outline-none pr-6 cursor-pointer text-white appearance-none relative z-10"
                  style={{ backgroundImage: 'none' }}
                >
                  {availablePgs.map((pg) => (
                    <option key={pg.id} value={pg.id} className="bg-zinc-950 text-white">
                      {pg.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-48 bg-zinc-900 rounded-xl" />
          <div className="h-48 bg-zinc-900 rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="h-32 flex flex-col items-center justify-center border border-dashed border-red-950 bg-red-950/5 rounded-2xl text-red-500 font-semibold text-sm">
          Failed to load profit analytics.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-6">
          {/* Main Profit Segment Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Revenue */}
            <Card className="border border-zinc-900 bg-zinc-950/10 hover:border-zinc-850 transition-colors">
              <CardContent className="p-5 space-y-2">
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Revenue (Money In)</span>
                <span className="text-3xl font-black text-white block flex items-center">
                  <IndianRupee className="h-6 w-6 text-green-500" />
                  {data.revenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">Total PG Collections this month.</span>
                
                {/* Revenue breakdown */}
                <div className="pt-3 border-t border-zinc-900 space-y-1.5 text-xs font-semibold text-zinc-450">
                  <div className="flex justify-between">
                    <span>Rent Collected</span>
                    <span className="text-zinc-300">₹{data.breakdown.rentCollected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deposits Collected</span>
                    <span className="text-zinc-300">₹{data.breakdown.depositsCollected.toLocaleString('en-IN')}</span>
                  </div>
                  {data.breakdown.damageRecoveries > 0 && (
                    <div className="flex justify-between">
                      <span>Damage Recoveries</span>
                      <span className="text-zinc-300">₹{data.breakdown.damageRecoveries.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card className="border border-zinc-900 bg-zinc-950/10 hover:border-zinc-850 transition-colors">
              <CardContent className="p-5 space-y-2">
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Expenses (Money Out)</span>
                <span className="text-3xl font-black text-white block flex items-center">
                  <IndianRupee className="h-6 w-6 text-red-500" />
                  {data.expenses.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">Total Operational Spending this month.</span>
                <Link
                  href="/expenses"
                  className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 hover:underline uppercase tracking-wider mt-3"
                >
                  Manage Expenses <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </CardContent>
            </Card>

            {/* Profit */}
            <Card className="border border-zinc-900 bg-gradient-to-br from-zinc-950 to-green-950/10 hover:border-zinc-800 transition-colors">
              <CardContent className="p-5 space-y-2">
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Net Profit ({currentMonthName})</span>
                <span className={`text-4xl font-black block flex items-center ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <IndianRupee className="h-7 w-7" />
                  {data.profit.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-500 block">Your actual earnings after all dues paid.</span>
                
                {data.revenue > 0 && (
                  <div className="pt-3 border-t border-zinc-900 space-y-1.5 text-xs font-semibold text-zinc-500 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5 text-green-400" /> Profit Margin
                    </span>
                    <span className="font-extrabold text-zinc-300">
                      {Math.round((data.profit / data.revenue) * 100)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Expenses List Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3">
            <div className="md:col-span-2">
              <Card className="border border-zinc-900 bg-zinc-950/20">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                    <TrendingDown className="h-4 w-4 text-red-500" /> Top Spending Categories
                  </h3>

                  {data.breakdown.topExpenses.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500 font-semibold border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
                      No PG expenses recorded for this month.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.breakdown.topExpenses.map((exp, idx) => {
                        const percent = data.expenses > 0 ? Math.round((exp.amount / data.expenses) * 100) : 0;
                        return (
                          <div key={exp.category} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span className="flex items-center gap-2">
                                <span className="h-5 w-5 bg-zinc-900 text-[10px] font-black text-zinc-400 rounded-lg flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-zinc-200">{getCategoryLabel(exp.category)}</span>
                              </span>
                              <span className="font-extrabold text-zinc-300">
                                ₹{exp.amount.toLocaleString('en-IN')}{' '}
                                <span className="text-[10px] text-zinc-500 font-medium ml-1">({percent}%)</span>
                              </span>
                            </div>
                            
                            {/* Simple visual bar */}
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-red-500/80 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Health Checklist / Quick Summary */}
            <div className="md:col-span-1">
              <Card className="border border-zinc-900 bg-zinc-950/20">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                    <Activity className="h-4 w-4 text-purple-400" /> Business Health Check
                  </h3>
                  <div className="space-y-3.5 text-xs leading-relaxed font-semibold">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1 rounded-full mt-0.5 ${data.profit > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        ✓
                      </div>
                      <div>
                        <p className="text-zinc-200">Business Net Profit</p>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          {data.profit > 0 
                            ? 'Your PG has a positive net cash flow this month.' 
                            : 'Expenses exceed collections this month. Review utility bills.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded-full bg-purple-500/10 text-purple-400 mt-0.5">
                        ✓
                      </div>
                      <div>
                        <p className="text-zinc-200">Revenue Distribution</p>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          Rent constitutes {data.revenue > 0 ? Math.round((data.breakdown.rentCollected / data.revenue) * 100) : 0}% of your total revenue.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading profit analytics...</div>}>
      <ProfitContent />
    </Suspense>
  );
}
