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
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Wallet,
  Users,
  Building,
  IndianRupee
} from 'lucide-react';
import Link from 'next/link';
import { useRentStore } from '@/store/useRentStore';
import MarkPaidSheet from '@/components/rent/MarkPaidSheet';

interface DepositRow {
  id: string;
  residentName: string;
  phone: string;
  roomNumber: string;
  bedNumber: string;
  depositAmount: number;
  status: 'COLLECTED' | 'PENDING' | 'PARTIALLY_PAID' | 'NO_DEPOSIT_REQUIRED';
  collectedDate: string | null;
  paymentMode: string | null;
  refundStatus: 'REFUNDED' | 'NOT_REFUNDED';
  refundedAmount: number | null;
  refundedAt: string | null;
  refundMode: string | null;
  tenantStatus: 'ACTIVE' | 'PAST' | 'NOTICE' | 'INCOMPLETE';
  invoiceId: string | null;
  invoiceDueDate: string | null;
  pendingAmount: number;
}

export default function DepositsLedgerPage() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const { openMarkPaid } = useRentStore();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<'all' | 'active' | 'historical'>('all');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'all' | 'collected' | 'pending' | 'partially_paid' | 'refunded'>('all');

  // Fetch Deposit Ledger List
  const { data: ledgerResponse, isLoading, isError } = useQuery({
    queryKey: ['deposit-ledger', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/dashboard/deposits/ledger`),
    enabled: !!activePgId,
  });

  const ledgerData: DepositRow[] = ledgerResponse?.data || [];

  // 1. Calculate Summary Cards
  const totalDepositsHeld = ledgerData
    .filter((row) => row.status === 'COLLECTED' || row.status === 'PARTIALLY_PAID')
    .reduce((sum, row) => sum + (row.depositAmount - row.pendingAmount), 0);

  const totalPendingDeposits = ledgerData
    .filter((row) => row.status === 'PENDING' || row.status === 'PARTIALLY_PAID')
    .reduce((sum, row) => sum + row.pendingAmount, 0);

  const activeResidentsCount = ledgerData.filter(
    (row) => row.tenantStatus === 'ACTIVE' || row.tenantStatus === 'NOTICE'
  ).length;

  // 2. Filter Ledger Rows
  const filteredLedger = ledgerData.filter((row) => {
    // Search Filter
    if (searchQuery && !row.residentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Tenant Status Filter
    if (tenantStatusFilter === 'active' && row.tenantStatus === 'PAST') return false;
    if (tenantStatusFilter === 'historical' && row.tenantStatus !== 'PAST') return false;

    // Deposit Status Filter
    if (depositStatusFilter === 'collected' && row.status !== 'COLLECTED') return false;
    if (depositStatusFilter === 'pending' && row.status !== 'PENDING') return false;
    if (depositStatusFilter === 'partially_paid' && row.status !== 'PARTIALLY_PAID') return false;
    if (depositStatusFilter === 'refunded' && row.refundStatus !== 'REFUNDED') return false;

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 className="h-3 w-3" /> COLLECTED
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <AlertCircle className="h-3 w-3" /> PARTIAL
          </span>
        );
      case 'NO_DEPOSIT_REQUIRED':
      case 'N/A':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
            N/A
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" /> PENDING
          </span>
        );
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
            <h1 className="text-3xl font-extrabold tracking-tight">Security Deposit Ledger</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Isolate and audit your property's deposit liabilities.</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total Deposits Held</span>
            <span className="text-3xl font-black text-blue-400 block">
              ₹{totalDepositsHeld.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">Net secured security deposit funds.</span>
          </CardContent>
        </Card>

        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Pending Deposits</span>
            <span className="text-3xl font-black text-amber-400 block">
              ₹{totalPendingDeposits.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">Uncollected initial deposits.</span>
          </CardContent>
        </Card>

        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Active Stayers</span>
            <span className="text-3xl font-black text-zinc-100 block">
              {activeResidentsCount}
            </span>
            <span className="text-[11px] text-zinc-500 block">Residents currently allocated.</span>
          </CardContent>
        </Card>
      </div>

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
          {/* Tenant Status Filter */}
          <select
            value={tenantStatusFilter}
            onChange={(e: any) => setTenantStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
          >
            <option value="all">All Residents</option>
            <option value="active">Active Residents</option>
            <option value="historical">Historical Residents</option>
          </select>

          {/* Deposit Status Filter */}
          <select
            value={depositStatusFilter}
            onChange={(e: any) => setDepositStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
          >
            <option value="all">All Deposits</option>
            <option value="collected">Collected</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-64 bg-zinc-900 rounded-2xl" />
        </div>
      )}

      {isError && (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-red-950 bg-red-950/5 rounded-2xl text-red-500 font-semibold text-sm">
          Failed to load security deposit ledger.
        </div>
      )}

      {!isLoading && !isError && filteredLedger.length === 0 && (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20 text-zinc-500">
          No deposit entries matched your selected filters.
        </div>
      )}

      {!isLoading && !isError && filteredLedger.length > 0 && (
        <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="p-4">Resident</th>
                <th className="p-4">Room & Bed</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Deposit Amount</th>
                <th className="p-4 text-center">Collected Date</th>
                <th className="p-4 text-center">Payment Mode</th>
                <th className="p-4 text-center">Refund Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {filteredLedger.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-900/10 transition-colors">
                  {/* Resident Name & Status Tag */}
                  <td className="p-4 font-bold text-zinc-200">
                    <div>
                      <span>{row.residentName}</span>
                      <span className={`block text-[9px] uppercase tracking-wider font-extrabold mt-0.5 w-fit rounded px-1.5 py-0.5 border
                        ${row.tenantStatus === 'ACTIVE' 
                          ? 'text-green-400 border-green-500/20 bg-green-500/5' 
                          : row.tenantStatus === 'NOTICE'
                          ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                          : 'text-zinc-500 border-zinc-800 bg-zinc-900/20'}`}
                      >
                        {row.tenantStatus === 'ACTIVE' ? 'Active' : row.tenantStatus === 'NOTICE' ? 'Notice' : 'Historical'}
                      </span>
                    </div>
                  </td>

                  {/* Room & Bed */}
                  <td className="p-4 font-semibold text-zinc-450 mt-2 text-zinc-350">
                    <span className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-zinc-500" />
                      Room {row.roomNumber} ({row.bedNumber})
                    </span>
                  </td>

                  {/* Deposit Status */}
                  <td className="p-4 text-center">
                    {getStatusBadge(row.status)}
                  </td>

                  {/* Deposit Amount */}
                  <td className="p-4 text-right font-black text-sm text-zinc-100">
                    <div>
                      <span>₹{row.depositAmount.toLocaleString('en-IN')}</span>
                      {row.status === 'PARTIALLY_PAID' && (
                        <span className="block text-[10px] text-amber-500 font-semibold mt-0.5">
                          Unpaid: ₹{row.pendingAmount.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Collected Date */}
                  <td className="p-4 text-center text-zinc-400 font-semibold">
                    {row.collectedDate ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-650" />
                        {new Date(row.collectedDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    ) : (
                      <span className="text-zinc-650 text-zinc-600">-</span>
                    )}
                  </td>

                  {/* Payment Mode */}
                  <td className="p-4 text-center text-zinc-400 font-extrabold uppercase tracking-wide">
                    {row.paymentMode || <span className="text-zinc-650 text-zinc-600">-</span>}
                  </td>

                  {/* Refund Status */}
                  <td className="p-4 text-center">
                    {row.refundStatus === 'REFUNDED' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Refunded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                        Not Refunded
                      </span>
                    )}
                  </td>

                  {/* Quick Action: Collect Deposit */}
                  <td className="p-4 text-right">
                    {(row.status === 'PENDING' || row.status === 'PARTIALLY_PAID') && row.invoiceId ? (
                      <button
                        onClick={() => openMarkPaid(
                          row.id, 
                          row.pendingAmount, 
                          row.residentName, 
                          row.roomNumber, 
                          row.invoiceId || undefined, 
                          row.bedNumber, 
                          row.invoiceDueDate || undefined
                        )}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-850 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-350 cursor-pointer select-none transition-colors"
                      >
                        <IndianRupee className="h-3 w-3" /> Collect Deposit
                      </button>
                    ) : (
                      <span className="text-zinc-600 font-medium">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* mark paid sheet integration */}
      <MarkPaidSheet />
    </div>
  );
}
