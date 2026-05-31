'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  FileSpreadsheet,
  QrCode,
  Banknote,
  Building,
  CreditCard,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { usePaymentRequestStore } from '@/store/usePaymentRequestStore';

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
  status: string;
  type: string;
  tenantProfileId?: string;
}

export default function CollectionsHistoryPage() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();
  const { openPaymentRequest } = usePaymentRequestStore();
  const queryClient = useQueryClient();
  const [selectedLedgerMonth, setSelectedLedgerMonth] = useState<{ month: string; year: number; index: number } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');

  // Universal Payment sheet states
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState<any | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'bank_transfer' | 'cheque' | 'deposit'>('upi');
  const [referenceId, setReferenceId] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');

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

  // Bulk Reminders State
  const [isBulkRemindersOpen, setIsBulkRemindersOpen] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkSendingStatus, setBulkSendingStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'failed'>>({});
  const [isCopyingAll, setIsCopyingAll] = useState(false);

  const unpaidLedgerRows = ledgerData.filter(
    (row) => row.status !== 'PAID' && row.status !== 'COLLECTED' && row.status !== 'WAIVED' && row.dueAmount > 0
  );

  const handleOpenBulkReminders = () => {
    setSelectedBulkIds(unpaidLedgerRows.map(r => r.id));
    setBulkSendingStatus({});
    setIsBulkRemindersOpen(true);
  };

  const handleToggleBulkSelect = (id: string) => {
    setSelectedBulkIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSendSingleBulkReminder = async (row: any) => {
    setBulkSendingStatus(prev => ({ ...prev, [row.id]: 'loading' }));
    try {
      const res = await fetchApi('/payments/link/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: row.type === 'SECURITY_DEPOSIT' ? 'SECURITY_DEPOSIT' : row.type === 'DAMAGE_RECOVERY' ? 'DAMAGE' : 'RENT',
          id: row.id,
          amount: row.dueAmount
        })
      });

      if (res && res.data) {
        const link = res.data.paymentUrl;
        const message = `Hi ${row.residentName}

This is a friendly reminder that your payment is due.

Type: ${row.type === 'SECURITY_DEPOSIT' ? 'Security Deposit' : row.type === 'DAMAGE_RECOVERY' ? 'Damage recovery' : 'Rent'}
Outstanding Amount: ₹${row.dueAmount.toLocaleString('en-IN')}

Please pay securely using this link:
${link}

Thank you.`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');

        setBulkSendingStatus(prev => ({ ...prev, [row.id]: 'success' }));
        toast.success(`WhatsApp reminder opened for ${row.residentName}`);
      } else {
        throw new Error('Empty API response');
      }
    } catch (err: any) {
      setBulkSendingStatus(prev => ({ ...prev, [row.id]: 'failed' }));
      toast.error(`Failed to generate link for ${row.residentName}: ${err.message}`);
    }
  };

  const handleCopyAllLinks = async () => {
    const selectedRows = unpaidLedgerRows.filter(r => selectedBulkIds.includes(r.id));
    if (selectedRows.length === 0) {
      toast.error("No residents selected.");
      return;
    }
    
    setIsCopyingAll(true);
    let summaryText = `*Consolidated PG Dues Outstanding Summary - ${selectedLedgerMonth?.month} ${selectedLedgerMonth?.year}*\n\n`;
    
    try {
      for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        try {
          const res = await fetchApi('/payments/link/generate', {
            method: 'POST',
            body: JSON.stringify({
              type: row.type === 'SECURITY_DEPOSIT' ? 'SECURITY_DEPOSIT' : row.type === 'DAMAGE_RECOVERY' ? 'DAMAGE' : 'RENT',
              id: row.id,
              amount: row.dueAmount
            })
          });
          if (res && res.data) {
            summaryText += `${i + 1}. *${row.residentName}* (Room ${row.roomNumber})\n`;
            summaryText += `   Dues: ₹${row.dueAmount.toLocaleString('en-IN')}\n`;
            summaryText += `   Pay Link: ${res.data.paymentUrl}\n\n`;
          }
        } catch (e) {
          console.error("Failed to generate bulk link inside loop:", e);
        }
      }

      navigator.clipboard.writeText(summaryText);
      toast.success("Consolidated payment links copied to clipboard!");
    } catch (err: any) {
      toast.error("Failed to copy consolidated list.");
    } finally {
      setIsCopyingAll(false);
    }
  };

  // Payment mutation for Rent, Deposits, and Damage Recoveries
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPaymentRow) return;
      const parsedAmount = parseFloat(amountInput) || 0;
      
      if (selectedPaymentRow.type === 'DAMAGE_RECOVERY') {
        return fetchApi(`/pgs/${activePgId}/recoveries/${selectedPaymentRow.id}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status: parsedAmount >= selectedPaymentRow.dueAmount ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED',
            amountReceived: parsedAmount,
            paymentMode: paymentMethod.toUpperCase(),
            referenceNumber: referenceId,
            notes: collectionNotes
          })
        });
      } else {
        const endpoint = selectedPaymentRow.type === 'SECURITY_DEPOSIT' ? 'pay-deposit' : 'pay-rent';
        return fetchApi(`/pgs/${activePgId}/tenants/${selectedPaymentRow.tenantProfileId}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: parsedAmount,
            paymentMode: paymentMethod,
            referenceId,
            invoiceId: selectedPaymentRow.id
          })
        });
      }
    },
    onSuccess: () => {
      toast.success('Collection recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['collection-ledger', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['collections-history', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', activePgId] });
      setIsPaymentSheetOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record payment');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COLLECTED':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Collected
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <AlertCircle className="h-3 w-3" /> Partially Paid
          </span>
        );
      case 'OVERDUE':
      case 'PAST_DUE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
            <AlertCircle className="h-3 w-3" /> Overdue
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <AlertCircle className="h-3 w-3" /> Disputed
          </span>
        );
      case 'WAIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <AlertCircle className="h-3 w-3" /> Waived
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" /> Pending
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

                  <div className="flex items-center gap-3">
                    {unpaidLedgerRows.length > 0 && (
                      <button
                        onClick={handleOpenBulkReminders}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Send Bulk Reminders ({unpaidLedgerRows.length})
                      </button>
                    )}
                    <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                      Showing {filteredLedger.length} of {ledgerData.length} records
                    </div>
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
                          <th className="p-3.5 text-right print:hidden">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60 print:divide-zinc-200">
                        {filteredLedger.map((row: any) => (
                          <tr 
                            key={row.id} 
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('button') || target.closest('select') || target.closest('input')) {
                                return;
                              }
                              if (row.tenantProfileId) {
                                openProfile(row.tenantProfileId);
                              } else {
                                toast.error('No profile details found for this resident.');
                              }
                            }}
                            className="hover:bg-zinc-900/20 cursor-pointer print:hover:bg-transparent transition-all"
                          >
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
                              {(row.status === 'COLLECTED' || row.status === 'PAID') ? (
                                <div>
                                  <span className="block font-semibold uppercase">{row.paymentMode || 'ONLINE'}</span>
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
                            <td className="p-3.5 text-right print:hidden">
                              {(row.status !== 'PAID' && row.status !== 'COLLECTED') ? (
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log("[DIAGNOSTIC] collections/page.tsx: Request Pay clicked for row:", row.id);
                                      openPaymentRequest(
                                        row.type === 'SECURITY_DEPOSIT' ? 'SECURITY_DEPOSIT' : row.type === 'DAMAGE_RECOVERY' ? 'DAMAGE' : 'RENT',
                                        row.id,
                                        {
                                          invoiceNumber: `${row.type === 'SECURITY_DEPOSIT' ? 'DEP' : row.type === 'DAMAGE_RECOVERY' ? 'REC' : 'INV'}-${row.id.substr(0, 8).toUpperCase()}`,
                                          residentName: row.residentName,
                                          amount: row.dueAmount,
                                          dueDate: row.dueDate || new Date()
                                        }
                                      );
                                    }}
                                    className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-900 text-primary hover:border-primary text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                                  >
                                    Request Pay
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPaymentRow(row);
                                      setAmountInput(row.dueAmount.toString());
                                      setPaymentMethod('upi');
                                      setReferenceId('');
                                      setCollectionNotes('');
                                      setIsPaymentSheetOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-primary hover:text-white transition-colors text-[9px] font-black uppercase tracking-wider cursor-pointer"
                                  >
                                    Collect
                                  </button>
                                </div>
                              ) : (
                                <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Settled</span>
                              )}
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

      {/* Bulk Reminders Sheet */}
      <Sheet open={isBulkRemindersOpen} onOpenChange={(open) => !open && setIsBulkRemindersOpen(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-black text-white border-zinc-850">
          <SheetHeader>
            <SheetTitle className="text-emerald-400 flex items-center gap-2 text-xl font-bold">
              <Users className="h-5 w-5" /> Bulk Reminders Queue
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Select unpaid residents to send automated payment requests and pre-filled WhatsApp reminders.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex gap-2">
              <Button
                onClick={handleCopyAllLinks}
                disabled={isCopyingAll || selectedBulkIds.length === 0}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase tracking-wider font-extrabold text-[10px] h-10 rounded-xl"
              >
                {isCopyingAll ? "Generating Links..." : "Copy Consolidated List"}
              </Button>
              <Button
                onClick={() => {
                  if (selectedBulkIds.length === unpaidLedgerRows.length) {
                    setSelectedBulkIds([]);
                  } else {
                    setSelectedBulkIds(unpaidLedgerRows.map(r => r.id));
                  }
                }}
                className="bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200 uppercase tracking-wider font-extrabold text-[10px] h-10 px-4 rounded-xl"
              >
                {selectedBulkIds.length === unpaidLedgerRows.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 border border-zinc-900/60 rounded-xl p-3 bg-zinc-950/20">
              {unpaidLedgerRows.length === 0 ? (
                <p className="text-zinc-500 text-center text-xs font-bold py-6">No unpaid collections in this ledger.</p>
              ) : (
                unpaidLedgerRows.map((row) => {
                  const isChecked = selectedBulkIds.includes(row.id);
                  const status = bulkSendingStatus[row.id] || 'idle';
                  return (
                    <div key={row.id} className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-900 rounded-xl text-xs hover:border-zinc-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBulkSelect(row.id)}
                        className="rounded border-zinc-800 bg-zinc-900 text-primary focus:ring-zinc-950 h-4 w-4 accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-zinc-200 truncate">{row.residentName}</p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          Room {row.roomNumber} ({row.bedNumber}) — {row.type === 'SECURITY_DEPOSIT' ? 'Deposit' : row.type === 'DAMAGE_RECOVERY' ? 'Damage' : 'Rent'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-zinc-150 block">₹{row.dueAmount.toLocaleString('en-IN')}</span>
                        <button
                          onClick={() => handleSendSingleBulkReminder(row)}
                          disabled={status === 'loading'}
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border mt-1.5 cursor-pointer block ml-auto
                            ${status === 'success' 
                              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                              : status === 'failed'
                              ? 'text-red-400 border-red-500/20 bg-red-500/5'
                              : status === 'loading'
                              ? 'text-zinc-500 border-zinc-900 animate-pulse'
                              : 'text-primary border-primary/20 bg-primary/5 hover:bg-primary hover:text-black transition-all'}`}
                        >
                          {status === 'success' ? 'Opened' : status === 'loading' ? 'Sending...' : 'Reminder'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setIsBulkRemindersOpen(false)}
              className="w-full border border-zinc-850 text-zinc-400 hover:text-white h-11 font-semibold rounded-xl"
            >
              Close Bulk Queue
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 4. Universal Payment Drawer Sheet */}
      <Sheet open={isPaymentSheetOpen} onOpenChange={(open) => !open && setIsPaymentSheetOpen(false)}>
        <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-800 flex flex-col p-6 max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <div className="space-y-0.5">
              <SheetTitle className="text-xl font-black text-zinc-100">Log Dues Settle</SheetTitle>
              <SheetDescription className="text-zinc-500 text-xs font-medium">
                Record collection ledger transaction details.
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            {/* Detailed Resident Context Block */}
            <div className="bg-zinc-950 border border-zinc-900/80 p-4 rounded-xl space-y-3 shadow-sm select-none">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Resident Name</span>
                  <span className="text-base font-black text-zinc-100 block mt-0.5">{selectedPaymentRow?.residentName || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Room & Bed</span>
                  <span className="text-xs font-extrabold text-zinc-350 block mt-0.5">
                    Room {selectedPaymentRow?.roomNumber || 'N/A'} — Bed {selectedPaymentRow?.bedNumber || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3.5 border-t border-zinc-900">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Invoice Type</span>
                  <span className="text-xs font-black text-zinc-300 block mt-0.5 uppercase">
                    {selectedPaymentRow?.type === 'SECURITY_DEPOSIT' ? 'Deposit' : selectedPaymentRow?.type === 'DAMAGE_RECOVERY' ? 'Damage' : 'Rent'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Expected Amount</span>
                  <span className="text-xs font-black text-zinc-300 block mt-0.5">
                    ₹{((selectedPaymentRow?.amountPaid ?? 0) + (selectedPaymentRow?.dueAmount ?? 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Already Paid</span>
                  <span className="text-xs font-black text-green-400 block mt-0.5">
                    ₹{(selectedPaymentRow?.amountPaid ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-zinc-900 flex justify-between items-center text-xs font-semibold">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Outstanding Amount</span>
                <span className="text-red-400 font-black text-sm animate-pulse">
                  ₹{(selectedPaymentRow?.dueAmount ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Amount Received (₹)</label>
                {amountInput !== selectedPaymentRow?.dueAmount?.toString() && (
                  <button 
                    onClick={() => setAmountInput(selectedPaymentRow?.dueAmount?.toString() || '')}
                    className="text-[11px] text-primary hover:text-primary-light font-bold cursor-pointer"
                  >
                    Reset to Full Dues
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-extrabold text-lg">₹</div>
                <Input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 h-12 text-lg font-bold bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
                  max={selectedPaymentRow?.dueAmount}
                  min={1}
                  disabled={payMutation.isPending}
                />
              </div>
              {parseFloat(amountInput) < selectedPaymentRow?.dueAmount && parseFloat(amountInput) > 0 && (
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  Status: <strong>PARTIALLY PAID</strong>. Outstanding becomes: ₹{(selectedPaymentRow?.dueAmount - parseFloat(amountInput)).toLocaleString('en-IN')}.
                </p>
              )}
              {parseFloat(amountInput) === selectedPaymentRow?.dueAmount && (
                <p className="text-[11px] text-green-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  Status: <strong>COLLECTED</strong>. Settle outstanding dues fully.
                </p>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Payment Method</label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  disabled={payMutation.isPending}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none
                    ${paymentMethod === 'upi' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:border-zinc-850'}`}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="text-[10px] font-extrabold uppercase">UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  disabled={payMutation.isPending}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none
                    ${paymentMethod === 'cash' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:border-zinc-850'}`}
                >
                  <Banknote className="h-4 w-4" />
                  <span className="text-[10px] font-extrabold uppercase">Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  disabled={payMutation.isPending}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none
                    ${paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:border-zinc-850'}`}
                >
                  <Building className="h-4 w-4" />
                  <span className="text-[10px] font-extrabold uppercase">Bank Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cheque')}
                  disabled={payMutation.isPending}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none
                    ${paymentMethod === 'cheque' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:border-zinc-850'}`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="text-[10px] font-extrabold uppercase">Cheque</span>
                </button>
              </div>

              {/* Deduct from Deposit option - Only shown for DAMAGE_RECOVERY rows */}
              {selectedPaymentRow?.type === 'DAMAGE_RECOVERY' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('deposit')}
                    disabled={payMutation.isPending || !(selectedPaymentRow?.refundableDeposit > 0)}
                    className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                      ${paymentMethod === 'deposit' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:border-zinc-850'}
                      ${!(selectedPaymentRow?.refundableDeposit > 0) ? 'opacity-40 cursor-not-allowed border-dashed border-red-500/20' : ''}`}
                  >
                    <Wallet className="h-4 w-4" />
                    <div className="text-left">
                      <span className="text-[10px] font-extrabold uppercase block">Deduct From Deposit</span>
                      {selectedPaymentRow?.refundableDeposit > 0 && (
                        <span className="text-[9px] text-zinc-500 block">Available: ₹{selectedPaymentRow?.refundableDeposit?.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </button>

                  {!(selectedPaymentRow?.refundableDeposit > 0) && (
                    <p className="text-[10px] text-red-400 font-bold mt-1.5 bg-red-500/5 border border-red-500/10 p-2 rounded-lg text-center select-none animate-pulse">
                      No refundable deposit available.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reference ID & Collection Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Reference ID (Optional)</label>
                <Input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="TXN182738"
                  className="h-10 text-xs bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
                  disabled={payMutation.isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Collection Notes (Optional)</label>
                <Input
                  type="text"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  placeholder="Special instructions"
                  className="h-10 text-xs bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
                  disabled={payMutation.isPending}
                />
              </div>
            </div>

            {/* Settle Confirm Button */}
            <Button 
              className="w-full h-11 text-xs font-black uppercase tracking-widest mt-2" 
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || !amountInput || parseFloat(amountInput) <= 0 || parseFloat(amountInput) > selectedPaymentRow?.dueAmount}
            >
              {payMutation.isPending ? 'Settle in Progress...' : `Confirm Settle of ₹${(parseFloat(amountInput) || 0).toLocaleString('en-IN')} via ${paymentMethod.toUpperCase()}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
