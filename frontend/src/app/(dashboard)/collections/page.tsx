'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Building2, 
  ChevronDown, 
  Calendar, 
  DollarSign, 
  Percent, 
  Users, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Printer, 
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface HistoricalMonth {
  month: string;
  year: number;
  monthIndex: number;
  expectedRent: number;
  actualCollected: number;
  collectionEfficiency: number;
  pendingAmount: number;
  overdueAmount: number;
  occupancyRate: number;
  paymentsCount: number;
}

interface LedgerRow {
  id: string;
  residentName: string;
  roomNumber: string;
  bedNumber: string;
  amountPaid: number;
  dueAmount: number;
  dueDate: string;
  paymentDate: string | null;
  paymentMode: string | null;
  referenceId: string;
  status: 'PAID' | 'PENDING' | 'PAST_DUE';
}

export default function CollectionsHistoryPage() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const [selectedLedgerMonth, setSelectedLedgerMonth] = useState<{ month: string; year: number; index: number } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');

  // 1. Fetch Collections History Cards
  const { data: historyResponse, isLoading: historyLoading } = useQuery({
    queryKey: ['collections-history', activePgId, transactionTypeFilter],
    queryFn: () => fetchApi(`/pgs/${activePgId}/dashboard/collections-history?type=${transactionTypeFilter.toUpperCase()}`),
    enabled: !!activePgId,
  });

  const historyData: HistoricalMonth[] = historyResponse?.data || [];

  // 3. Fetch Dashboard Summary
  const { data: summaryResponse } = useQuery({
    queryKey: ['dashboard-summary', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/dashboard/summary`),
    enabled: !!activePgId,
  });

  const summaryData = summaryResponse?.data;

  // Extract unique years for the filter dropdown
  const uniqueYears = Array.from(new Set(historyData.map((d) => String(d.year))));

  // Filter history cards by Year
  const filteredHistory = historyData.filter((item) => {
    if (yearFilter !== 'all' && String(item.year) !== yearFilter) return false;
    return true;
  });

  // 2. Fetch Detailed Monthly Ledger
  const { data: ledgerResponse, isLoading: ledgerLoading } = useQuery({
    queryKey: ['collection-ledger', activePgId, selectedLedgerMonth?.year, selectedLedgerMonth?.index, transactionTypeFilter],
    queryFn: () => fetchApi(`/pgs/${activePgId}/dashboard/collections-history/${selectedLedgerMonth?.year}/${selectedLedgerMonth?.index}?type=${transactionTypeFilter.toUpperCase()}`),
    enabled: !!activePgId && !!selectedLedgerMonth,
  });

  const ledgerData: LedgerRow[] = ledgerResponse?.data || [];

  // Filter ledger rows in-memory for real-time responsiveness
  const filteredLedger = ledgerData.filter((row) => {
    if (searchQuery && !row.residentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (paymentModeFilter !== 'all' && (row.paymentMode || '').toLowerCase() !== paymentModeFilter.toLowerCase()) return false;
    return true;
  });

  // Get dynamic collection efficiency color class
  const getEfficiencyColor = (rate: number) => {
    if (rate >= 85) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (rate >= 60) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-red-400 border-red-500/20 bg-red-500/5';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Collected
          </span>
        );
      case 'PAST_DUE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
            <AlertCircle className="h-3 w-3" /> Overdue
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" /> Pending Collection
          </span>
        );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Reference ID copied to clipboard');
  };

  // Trigger print-friendly statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6 print:p-0 print:bg-white print:text-black">
      {/* 1. Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900 transition-all text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Collection Audit & Reports</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Permanent historical auditing ledger for your PG.</p>
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

      {/* 2. Page Content Grid */}
      <div className="space-y-6 print:hidden">
        {/* Top Summary Bar */}
        {summaryData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl space-y-1 hover:border-zinc-800 transition-all select-none">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-black">Rent Due</span>
              <span className="text-xl font-black text-red-400">
                ₹{(summaryData.pendingRent || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl space-y-1 hover:border-zinc-800 transition-all select-none">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-black">Damage Charges</span>
              <span className="text-xl font-black text-amber-400">
                ₹{(summaryData.totalPendingRecoveryAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl space-y-1 hover:border-zinc-800 transition-all select-none">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-black">Deposit Due</span>
              <span className="text-xl font-black text-blue-400">
                ₹{(summaryData.pendingDeposits || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-900/80 rounded-2xl space-y-1 hover:border-zinc-700 transition-all select-none bg-gradient-to-r from-zinc-950/50 to-zinc-900/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-full w-1/3 bg-primary/5 blur-3xl rounded-full" />
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest block font-black">Total Outstanding</span>
              <span className="text-xl font-black text-primary animate-pulse">
                ₹{(summaryData.totalOutstanding || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 bg-zinc-950/20 border border-zinc-900/60 p-4 rounded-2xl">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text"
              placeholder="Search resident name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-primary cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="rent">Rent Due</option>
              <option value="security_deposit">Deposit Due</option>
              <option value="damage_recovery">Damage Charges</option>
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
            >
              <option value="all">All Years</option>
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>

            <select
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="upi">UPI / Online</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        {/* Loading / Error States */}
        {historyLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-zinc-900 rounded-2xl" />
            ))}
          </div>
        )}

        {!activePgId && (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/10">
            <p className="text-zinc-500 text-sm">Please select or onboard a PG to load billing history.</p>
          </div>
        )}

        {/* Month Cards Grid */}
        {!historyLoading && activePgId && filteredHistory.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/10">
            <p className="text-zinc-500 text-sm">No historical collections found. Complete monthly billing cycles to populate history.</p>
          </div>
        )}

        {!historyLoading && activePgId && filteredHistory.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHistory.map((item) => (
              <Card 
                key={`${item.year}-${item.month}`}
                onClick={() => setSelectedLedgerMonth({ month: item.month, year: item.year, index: item.monthIndex })}
                className="col-span-1 border border-zinc-900 bg-zinc-950/20 hover:border-zinc-800 hover:bg-zinc-950/40 hover:scale-[1.01] cursor-pointer transition-all duration-300 select-none group relative overflow-hidden"
              >
                {/* Visual highlight line for collections strength */}
                <div className={`absolute top-0 left-0 right-0 h-1 
                  ${item.collectionEfficiency >= 85 ? 'bg-emerald-500/80' : item.collectionEfficiency >= 60 ? 'bg-amber-500/80' : 'bg-red-500/80'}`} 
                />

                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      {item.month} {item.year}
                    </CardTitle>
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${getEfficiencyColor(item.collectionEfficiency)}`}>
                      {item.collectionEfficiency}% Rate
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Financial Stats */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Collected</span>
                      <span className="text-lg font-black text-emerald-400">
                        ₹{item.actualCollected.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-zinc-900/50 pt-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Expected Total</span>
                      <span className="text-sm font-extrabold text-zinc-300">
                        ₹{item.expectedRent.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Split Details Footer */}
                  <div className="grid grid-cols-3 gap-2 pt-3.5 border-t border-zinc-900/60 text-[10px] text-zinc-400 font-semibold">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Pending</span>
                      <span className="text-zinc-300 font-extrabold">₹{item.pendingAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-l border-zinc-900/60 pl-2">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Overdue</span>
                      <span className="text-red-400 font-extrabold">₹{item.overdueAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-l border-zinc-900/60 pl-2">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Occupancy</span>
                      <span className="text-primary font-extrabold">{item.occupancyRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 3. Detailed Audit Ledger Slide-over / Modal (Standardized styled layout) */}
      {selectedLedgerMonth && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 print:relative print:inset-auto print:bg-white print:p-0">
          <div className="w-full max-w-4xl bg-zinc-950 border-l border-zinc-900 p-6 flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-300 print:border-0 print:p-0 print:bg-white">
            {/* Slide-over Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4 print:mb-6 print:border-b-2 print:border-zinc-300">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5 print:hidden">Audit Statement Ledger</span>
                <h2 className="text-2xl font-black text-zinc-100 print:text-black">
                  Collections Report — {selectedLedgerMonth.month} {selectedLedgerMonth.year}
                </h2>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button 
                  onClick={handlePrint}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-300 hover:text-white"
                  title="Print Ledger Report"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setSelectedLedgerMonth(null)}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Print Header Metadata */}
            <div className="hidden print:block space-y-2 text-xs border-b border-dashed border-zinc-300 pb-4 mb-6">
              <div className="flex justify-between">
                <span><strong>Date range:</strong> 01 {selectedLedgerMonth.month} {selectedLedgerMonth.year} - End of Month</span>
                <span><strong>Exported on:</strong> {new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span><strong>Property:</strong> {availablePgs.find(p => p.id === activePgId)?.name || 'Property'}</span>
                <span><strong>Audit Log:</strong> Verified Bank Ledger</span>
              </div>
            </div>

            {/* Ledger Loading State */}
            {ledgerLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-pulse">
                <div className="h-8 w-64 bg-zinc-900 rounded" />
                <div className="h-48 w-full bg-zinc-900 rounded-xl" />
              </div>
            )}

            {/* Ledger Content */}
            {!ledgerLoading && (
              <div className="flex-1 flex flex-col gap-5">
                {/* Search query inside the Ledger */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search ledger by resident..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-xs placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>

                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                    Showing {filteredLedger.length} of {ledgerData.length} records
                  </div>
                </div>

                {filteredLedger.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded-2xl p-6 bg-zinc-950/20">
                    <p className="text-zinc-500 text-sm">No ledger entries matched your query.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/30 print:border-0 print:bg-transparent">
                    <table className="w-full text-left border-collapse text-xs print:text-black">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400 print:border-b-2 print:border-black print:text-black">
                          <th className="p-3.5">Resident</th>
                          <th className="p-3.5">Room</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-right">Expected</th>
                          <th className="p-3.5 text-right">Collected</th>
                          <th className="p-3.5 text-right">Due Dues</th>
                          <th className="p-3.5 print:hidden">Payment Meta</th>
                          <th className="p-3.5 text-right print:hidden">Reference ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60 print:divide-zinc-200">
                        {filteredLedger.map((row: any) => (
                          <tr key={row.id} className="hover:bg-zinc-900/20 print:hover:bg-transparent">
                            <td className="p-3.5 font-bold text-zinc-200 print:text-black">
                              <div>
                                <span>{row.residentName}</span>
                                <span className={`block text-[9px] uppercase tracking-wider font-extrabold mt-0.5 w-fit rounded px-1.5 py-0.5 border
                                  ${row.type === 'SECURITY_DEPOSIT' 
                                    ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' 
                                    : row.type === 'DAMAGE_RECOVERY'
                                    ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                                    : 'text-zinc-400 border-zinc-800 bg-zinc-900/20'}`}
                                >
                                  {row.type === 'SECURITY_DEPOSIT' ? 'Deposit Due' : row.type === 'DAMAGE_RECOVERY' ? 'Damage Charges' : 'Rent Due'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 font-semibold text-zinc-400 print:text-black">
                              Room {row.roomNumber} ({row.bedNumber})
                            </td>
                            <td className="p-3.5 text-center">
                              {getStatusBadge(row.status)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-zinc-300">
                              ₹{(row.amountPaid + row.dueAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5 text-right font-extrabold text-emerald-400 print:text-black">
                              ₹{row.amountPaid.toLocaleString('en-IN')}
                            </td>
                            <td className={`p-3.5 text-right font-extrabold ${row.dueAmount > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                              ₹{row.dueAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5 text-zinc-400 text-[10px] print:hidden">
                              {row.status === 'PAID' ? (
                                <div>
                                  <span className="block font-semibold">{row.paymentMode || 'ONLINE'}</span>
                                  <span className="block text-zinc-500 text-[9px] mt-0.5">
                                    {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString('en-IN') : '-'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right print:hidden">
                              <button 
                                onClick={() => copyToClipboard(row.referenceId)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-primary transition-colors text-[9px] font-semibold text-zinc-500"
                              >
                                <Copy className="h-2.5 w-2.5" />
                                {row.referenceId.slice(0, 8)}...
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
