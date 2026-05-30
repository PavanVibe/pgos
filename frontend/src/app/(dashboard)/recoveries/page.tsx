'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Building2, 
  ChevronDown, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Building,
  IndianRupee,
  ShieldCheck,
  Ban,
  MessageSquareOff,
  Sparkles,
  Check,
  UserCheck,
  Wallet,
  Clock,
  X
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface RecoveryItem {
  id: string;
  title: string;
  amount: number;
  notes: string | null;
}

interface RecoveryRow {
  id: string;
  residentName: string;
  phone: string | null;
  roomNumber: string;
  bedNumber: string;
  complaintId: string | null;
  complaintTitle: string;
  complaintDate: string | null;
  resolutionDate: string | null;
  amount: number;
  collectedAmount: number;
  outstandingAmount: number;
  status: 'PENDING' | 'ACCEPTED' | 'DISPUTED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED' | 'WAIVED';
  recoveryMethod: 'DEPOSIT' | 'CASH' | 'UPI' | 'WAIVED';
  settlementStatus: 'OPEN' | 'SETTLED' | 'LOCKED';
  date: string;
  attachmentUrls: string[];
  disputeReason: string | null;
  waivedReason: string | null;
  items: RecoveryItem[];
  depositTransactions: any[];
  recoveryTransactions: any[];
  refundableDeposit: number;
}

function RecoveriesLedgerContent() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Filters State
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'ACCEPTED' | 'DISPUTED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED' | 'WAIVED'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'DEPOSIT' | 'CASH' | 'UPI' | 'WAIVED'>('all');

  // Modal / Action states
  const [actionRecovery, setActionRecovery] = useState<RecoveryRow | null>(null);
  const [actionType, setActionType] = useState<'DISPUTE' | 'WAIVE' | 'COLLECT' | 'DEDUCT_DEPOSIT' | null>(null);

  // Details Drawer state
  const [selectedRecoveryForDetails, setSelectedRecoveryForDetails] = useState<RecoveryRow | null>(null);
  
  // Custom inputs for action modals
  const [reasonInput, setReasonInput] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'DEPOSIT'>('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch Recoveries Ledger List
  const { data: ledgerResponse, isLoading, isError } = useQuery({
    queryKey: ['recoveries-ledger', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/recoveries/ledger`),
    enabled: !!activePgId,
  });

  // Fetch Recoveries Dashboard Statistics
  const { data: statsResponse } = useQuery({
    queryKey: ['recoveries-dashboard', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/recoveries/dashboard`),
    enabled: !!activePgId,
  });

  // Fetch Audit Logs for Selected Recovery Drawer
  const { data: auditLogsResponse, isLoading: isLoadingAuditLogs } = useQuery({
    queryKey: ['recovery-audit-logs', selectedRecoveryForDetails?.id, activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/recoveries/${selectedRecoveryForDetails?.id}/audit-logs`),
    enabled: !!selectedRecoveryForDetails?.id && !!activePgId,
  });
  const auditLogs = auditLogsResponse?.data || [];

  const ledgerData: RecoveryRow[] = ledgerResponse?.data || [];
  const stats = statsResponse?.data || {
    pendingRecoveriesCount: 0,
    pendingRecoveriesAmount: 0,
    partiallyRecoveredCount: 0,
    partiallyRecoveredAmount: 0,
    fullyRecoveredCount: 0,
    fullyRecoveredAmount: 0,
    recoveredCount: 0,
    recoveredAmount: 0,
    waivedCount: 0,
    waivedAmount: 0,
    disputedCount: 0,
    disputedAmount: 0,
    totalDamageAmount: 0,
    totalRecoveredAmount: 0,
    totalOutstandingAmount: 0
  };

  // Status transitions mutation
  const updateStatusMutation = useMutation({
    mutationFn: (body: any) => {
      return fetchApi(`/pgs/${activePgId}/recoveries/${actionRecovery?.id}/status`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    onSuccess: (res: any) => {
      toast.success('Damage recovery record updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['recoveries-dashboard', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
      if (selectedRecoveryForDetails && actionRecovery && selectedRecoveryForDetails.id === actionRecovery.id) {
        queryClient.invalidateQueries({ queryKey: ['recovery-audit-logs', selectedRecoveryForDetails.id, activePgId] });
        if (res?.data) {
          setSelectedRecoveryForDetails(prev => prev ? { ...prev, ...res.data } : null);
        }
      }
      closeActionModal();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update record status.');
    }
  });

  // Independent quick actions (Accept, Deduct Deposit)
  const quickActionMutation = useMutation({
    mutationFn: ({ recoveryId, body }: { recoveryId: string, body: any }) => {
      return fetchApi(`/pgs/${activePgId}/recoveries/${recoveryId}/status`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    onSuccess: (res: any, variables) => {
      toast.success('Recovery updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['recoveries-dashboard', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
      if (selectedRecoveryForDetails && selectedRecoveryForDetails.id === variables.recoveryId) {
        queryClient.invalidateQueries({ queryKey: ['recovery-audit-logs', selectedRecoveryForDetails.id, activePgId] });
        if (res?.data) {
          setSelectedRecoveryForDetails(prev => prev ? { ...prev, ...res.data } : null);
        }
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update recovery.');
    }
  });

  const handleQuickAccept = (rec: RecoveryRow) => {
    if (rec.settlementStatus === 'LOCKED') {
      toast.error('Stay record is LOCKED. No modifications allowed.');
      return;
    }
    quickActionMutation.mutate({
      recoveryId: rec.id,
      body: { status: 'ACCEPTED' }
    });
  };

  const handleQuickDeductDeposit = (rec: RecoveryRow) => {
    if (rec.settlementStatus === 'LOCKED') {
      toast.error('Stay record is LOCKED. No modifications allowed.');
      return;
    }
    quickActionMutation.mutate({
      recoveryId: rec.id,
      body: { 
        status: 'RECOVERED',
        amountReceived: rec.amount,
        paymentMode: 'DEPOSIT',
        notes: 'Automatically deducted from security deposit'
      }
    });
  };

  const handleOpenActionModal = (row: RecoveryRow, type: 'DISPUTE' | 'WAIVE' | 'COLLECT' | 'DEDUCT_DEPOSIT', preselectedMode?: 'UPI' | 'CASH') => {
    if (row.settlementStatus === 'LOCKED') {
      toast.error('Stay record is LOCKED. No modifications allowed.');
      return;
    }
    setActionRecovery(row);
    setActionType(type);
    setReasonInput('');
    setAmountReceived(row.outstandingAmount.toString());
    setPaymentMode(type === 'DEDUCT_DEPOSIT' ? 'DEPOSIT' : (preselectedMode || 'UPI'));
    setReferenceNumber('');
    setNotes('');
  };

  const closeActionModal = () => {
    setActionRecovery(null);
    setActionType(null);
  };

  const handleConfirmAction = () => {
    if (!actionRecovery || !actionType) return;

    if (actionType === 'DISPUTE') {
      if (!reasonInput.trim()) {
        toast.error('Please specify the dispute reason.');
        return;
      }
      updateStatusMutation.mutate({
        status: 'DISPUTED',
        reason: reasonInput.trim()
      });
    } else if (actionType === 'WAIVE') {
      if (!reasonInput.trim()) {
        toast.error('Please specify the waiver reason.');
        return;
      }
      updateStatusMutation.mutate({
        status: 'WAIVED',
        reason: reasonInput.trim()
      });
    } else if (actionType === 'COLLECT' || actionType === 'DEDUCT_DEPOSIT') {
      const amt = parseFloat(amountReceived);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please specify a valid collection amount.');
        return;
      }
      if (amt > actionRecovery.outstandingAmount) {
        toast.error(`Received amount cannot exceed the outstanding liability of ₹${actionRecovery.outstandingAmount}`);
        return;
      }

      const mode = actionType === 'DEDUCT_DEPOSIT' ? 'DEPOSIT' : paymentMode;

      if (mode === 'DEPOSIT' && amt > actionRecovery.refundableDeposit) {
        toast.error(`Deduction amount exceeds resident's available refundable deposit of ₹${actionRecovery.refundableDeposit}`);
        return;
      }

      updateStatusMutation.mutate({
        status: 'RECOVERED',
        amountReceived: amt,
        paymentMode: mode,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || (actionType === 'DEDUCT_DEPOSIT' ? 'Deducted from security deposit' : undefined)
      });
    }
  };

  // Filter ledger rows
  const filteredLedger = ledgerData.filter((row) => {
    if (searchQuery && !row.residentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    const normalizedStatus = row.status as string === 'RECOVERED' ? 'FULLY_RECOVERED' : row.status;
    if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
    if (methodFilter !== 'all' && row.recoveryMethod !== methodFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECOVERED':
      case 'FULLY_RECOVERED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 className="h-3 w-3" /> Collected
          </span>
        );
      case 'PARTIALLY_RECOVERED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3" /> Partially Collected
          </span>
        );
      case 'WAIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
            <Ban className="h-3 w-3" /> Waived
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <MessageSquareOff className="h-3 w-3" /> Disputed
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="h-3 w-3" /> Approved
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" /> Pending Collection
          </span>
        );
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'DEPOSIT':
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Deposit
          </span>
        );
      case 'CASH':
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-green-500/10 text-green-400 border border-green-500/20">
            Cash
          </span>
        );
      case 'UPI':
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            UPI
          </span>
        );
      case 'WAIVED':
        return (
          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
            Waived
          </span>
        );
      default:
        return <span className="text-zinc-600">-</span>;
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
              Damage Recovery Ledger
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Audit repairs expenses, resident damage responsibilities, and recovery statuses.</p>
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

      {/* Summary Aggregate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Damage Value */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Total Damage Value</span>
            <span className="text-2xl font-black text-white block">
              ₹{(stats.totalDamageAmount || 0).toLocaleString('en-IN')}
            </span>
          </CardContent>
        </Card>

        {/* Outstanding Recovery Amount */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Outstanding Recovery</span>
            <span className="text-2xl font-black text-amber-400 block">
              ₹{(stats.totalOutstandingAmount || 0).toLocaleString('en-IN')}
            </span>
          </CardContent>
        </Card>

        {/* Recovered Amount */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Total Recovered</span>
            <span className="text-2xl font-black text-green-400 block">
              ₹{(stats.totalRecoveredAmount || 0).toLocaleString('en-IN')}
            </span>
          </CardContent>
        </Card>

        {/* Pending Recoveries */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Pending Recoveries</span>
            <span className="text-2xl font-black text-purple-400 block">
              ₹{(stats.pendingRecoveriesAmount || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-zinc-500 block">{stats.pendingRecoveriesCount} Pending cases.</span>
          </CardContent>
        </Card>

        {/* Partially Recovered */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Partially Recovered</span>
            <span className="text-2xl font-black text-blue-400 block">
              ₹{(stats.partiallyRecoveredAmount || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-zinc-500 block">{stats.partiallyRecoveredCount || 0} Partial cases.</span>
          </CardContent>
        </Card>

        {/* Fully Recovered */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Fully Recovered</span>
            <span className="text-2xl font-black text-green-400 block">
              ₹{(stats.fullyRecoveredAmount || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-zinc-500 block">{stats.fullyRecoveredCount || 0} Fully settled.</span>
          </CardContent>
        </Card>

        {/* Waived Damages */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Waived Damages</span>
            <span className="text-2xl font-black text-zinc-400 block">
              ₹{(stats.waivedAmount || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-zinc-500 block">{stats.waivedCount} Cases waived.</span>
          </CardContent>
        </Card>

        {/* Disputed Liabilities */}
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-4 pb-4 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Disputed Liabilities</span>
            <span className="text-2xl font-black text-red-400 block">
              ₹{(stats.disputedAmount || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-zinc-500 block">{stats.disputedCount} Active disputes.</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
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
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DISPUTED">Disputed</option>
            <option value="PARTIALLY_RECOVERED">Partially Recovered</option>
            <option value="FULLY_RECOVERED">Fully Recovered</option>
            <option value="WAIVED">Waived</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e: any) => setMethodFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-900 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none text-zinc-300 cursor-pointer"
          >
            <option value="all">All Methods</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="WAIVED">Waived</option>
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
          Failed to load recoveries ledger.
        </div>
      )}

      {!isLoading && !isError && filteredLedger.length === 0 && (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20 text-zinc-500">
          No recovery entries matched your filters.
        </div>
      )}

      {!isLoading && !isError && filteredLedger.length > 0 && (
        <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="p-4">Resident</th>
                <th className="p-4">Room & Bed</th>
                <th className="p-4">Damage Description</th>
                <th className="p-4 text-center">Method</th>
                <th className="p-4 text-right">Incurred Cost</th>
                <th className="p-4 text-right">Collected</th>
                <th className="p-4 text-right">Outstanding</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Settlement Lock</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {filteredLedger.map((row) => {
                const isLocked = row.settlementStatus === 'LOCKED';
                return (
                  <tr 
                    key={row.id} 
                    className="hover:bg-zinc-900/5 hover:cursor-pointer border-b border-zinc-900/40 transition-colors animate-fadeIn"
                    onClick={() => setSelectedRecoveryForDetails(row)}
                  >
                    {/* Resident Name */}
                    <td className="p-4 font-bold text-zinc-200">
                      <div>
                        <span>{row.residentName}</span>
                        {row.phone && <span className="block text-[10px] text-zinc-500 font-normal">{row.phone}</span>}
                      </div>
                    </td>

                    {/* Room & Bed */}
                    <td className="p-4 font-semibold text-zinc-350">
                      <span className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-zinc-500" />
                        Room {row.roomNumber} ({row.bedNumber})
                      </span>
                    </td>

                    {/* Description & Items Breakdown trigger tooltips */}
                    <td className="p-4 font-semibold text-zinc-300 max-w-[200px]">
                      <div>
                        <span className="block font-medium truncate">{row.complaintTitle}</span>
                        {row.items.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {row.items.map(item => (
                              <span key={item.id} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-medium">
                                {item.title}: ₹{item.amount}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Recovery Method Badge */}
                    <td className="p-4 text-center">
                      {getMethodBadge(row.recoveryMethod)}
                    </td>

                    {/* expected amount */}
                    <td className="p-4 text-right font-semibold text-zinc-400">
                      ₹{row.amount.toLocaleString('en-IN')}
                    </td>

                    {/* Collected */}
                    <td className="p-4 text-right font-black text-zinc-200">
                      ₹{row.collectedAmount.toLocaleString('en-IN')}
                    </td>

                    {/* Outstanding */}
                    <td className={`p-4 text-right font-bold ${row.outstandingAmount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      ₹{row.outstandingAmount.toLocaleString('en-IN')}
                    </td>

                    {/* Status badge */}
                    <td className="p-4 text-center">
                      {getStatusBadge(row.status)}
                    </td>

                    {/* Settlement Lock status */}
                    <td className="p-4 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border font-extrabold
                        ${isLocked 
                          ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' 
                          : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                      >
                        {row.settlementStatus}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {isLocked ? (
                        <span className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">Settled & Locked</span>
                      ) : row.outstandingAmount === 0 || row.status === 'WAIVED' ? (
                        <span className="text-zinc-550 font-semibold select-none text-[10px] uppercase">No Dues Pending</span>
                      ) : (
                        <div className="flex justify-end">
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'upi') handleOpenActionModal(row, 'COLLECT', 'UPI');
                              if (val === 'cash') handleOpenActionModal(row, 'COLLECT', 'CASH');
                              if (val === 'deposit') handleOpenActionModal(row, 'DEDUCT_DEPOSIT');
                              if (val === 'waive') handleOpenActionModal(row, 'WAIVE');
                              if (val === 'dispute') handleOpenActionModal(row, 'DISPUTE');
                              e.target.value = ''; // reset selection
                            }}
                            className="bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg focus:outline-none text-zinc-300 hover:text-white cursor-pointer select-none"
                            defaultValue=""
                          >
                            <option value="" disabled>Actions</option>
                            <option value="upi" className="bg-zinc-950 text-white font-bold uppercase">Collect UPI</option>
                            <option value="cash" className="bg-zinc-950 text-white font-bold uppercase">Collect Cash</option>
                            {row.refundableDeposit > 0 && (
                              <option value="deposit" className="bg-zinc-950 text-blue-400 font-bold uppercase">Deduct Deposit (₹{row.refundableDeposit})</option>
                            )}
                            <option value="waive" className="bg-zinc-950 text-zinc-400 font-bold uppercase">Waive</option>
                            <option value="dispute" className="bg-zinc-950 text-red-400 font-bold uppercase">Dispute</option>
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive Quick Action Dialog */}
      {actionRecovery && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  {actionType === 'DISPUTE' && 'Log Dispute Request'}
                  {actionType === 'WAIVE' && 'Waive Repair Recovery'}
                  {actionType === 'COLLECT' && 'Record Recovery Payment'}
                  {actionType === 'DEDUCT_DEPOSIT' && 'Deduct from Security Deposit'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Resident: <span className="font-extrabold text-zinc-300">{actionRecovery.residentName}</span> (Room {actionRecovery.roomNumber})
                </p>
              </div>
              <button 
                onClick={closeActionModal}
                className="text-zinc-550 hover:text-zinc-300 text-sm font-black p-1 hover:bg-zinc-900 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 pt-2">
              {/* DISPUTE / WAIVE REASON INPUT */}
              {(actionType === 'DISPUTE' || actionType === 'WAIVE') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                    {actionType === 'DISPUTE' ? 'Reason for Dispute' : 'Reason for Waiving Liability'}
                  </label>
                  <textarea
                    placeholder={actionType === 'DISPUTE' ? 'Why is the resident disputing this cost details...' : 'Reason for waiving this damage expense...'}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-black border border-zinc-900 focus:border-zinc-800 text-xs font-semibold placeholder-zinc-700 rounded-xl focus:outline-none transition-all resize-none text-white"
                  />
                </div>
              )}

              {/* COLLECT DIRECT PAYMENT FIELDS */}
              {actionType === 'COLLECT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Amount Received (₹)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          className="w-full bg-black border border-zinc-900 text-xs font-bold h-9 pl-7 pr-3 rounded-lg focus:outline-none focus:border-zinc-800"
                        />
                        <IndianRupee className="h-3.5 w-3.5 text-zinc-650 absolute left-2 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-1 bg-black p-0.5 border border-zinc-900 rounded-lg h-9">
                        <button
                          onClick={() => setPaymentMode('UPI')}
                          className={`text-[10px] font-extrabold rounded ${paymentMode === 'UPI' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-zinc-500'}`}
                        >
                          UPI
                        </button>
                        <button
                          onClick={() => setPaymentMode('CASH')}
                          className={`text-[10px] font-extrabold rounded ${paymentMode === 'CASH' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-zinc-500'}`}
                        >
                          CASH
                        </button>
                        <button
                          onClick={() => setPaymentMode('DEPOSIT')}
                          className={`text-[10px] font-extrabold rounded ${paymentMode === 'DEPOSIT' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-zinc-500'}`}
                        >
                          DEPOSIT
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Reference / Transaction Number (Optional)</label>
                    <input
                      placeholder="e.g. UPI Ref, Bank Transaction ID..."
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full bg-black border border-zinc-900 text-xs font-semibold h-9 px-3 rounded-lg focus:outline-none focus:border-zinc-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Collection Notes (Optional)</label>
                    <textarea
                      placeholder="Any notes about the payment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-black border border-zinc-900 focus:border-zinc-800 text-xs font-semibold placeholder-zinc-700 rounded-lg focus:outline-none transition-all resize-none text-white"
                    />
                  </div>
                </div>
              )}

              {/* DEPOSIT DEDUCTION FIELDS */}
              {actionType === 'DEDUCT_DEPOSIT' && (
                <div className="space-y-4">
                  {/* Refundable Deposit Stats Banner */}
                  <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Refundable Deposit Available</span>
                      <span className="text-sm font-black text-blue-400">
                        ₹{(actionRecovery.refundableDeposit || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Outstanding Recovery</span>
                      <span className="text-sm font-black text-amber-400">
                        ₹{actionRecovery.outstandingAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Amount to Deduct (₹)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          className="w-full bg-black border border-zinc-900 text-xs font-bold h-9 pl-7 pr-3 rounded-lg focus:outline-none focus:border-zinc-800 text-white"
                        />
                        <IndianRupee className="h-3.5 w-3.5 text-zinc-650 absolute left-2 top-1/2 -translate-y-1/2" />
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          onClick={() => setAmountReceived(actionRecovery.outstandingAmount.toString())}
                          className="text-[9px] font-black uppercase text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded cursor-pointer"
                        >
                          Full Deduction (₹{actionRecovery.outstandingAmount})
                        </button>
                        <button
                          onClick={() => {
                            const minVal = Math.min(actionRecovery.outstandingAmount, actionRecovery.refundableDeposit);
                            setAmountReceived((minVal / 2).toString());
                          }}
                          className="text-[9px] font-black uppercase text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded cursor-pointer"
                        >
                          Partial (50%)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Deduction Notes / Reason (Optional)</label>
                    <textarea
                      placeholder="Any notes for the security deposit deduction statement..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-black border border-zinc-900 focus:border-zinc-800 text-xs font-semibold placeholder-zinc-700 rounded-lg focus:outline-none transition-all resize-none text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-900">
              <button
                onClick={handleConfirmAction}
                disabled={updateStatusMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider h-10 rounded-xl select-none transition-all"
              >
                {updateStatusMutation.isPending ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={closeActionModal}
                disabled={updateStatusMutation.isPending}
                className="flex-1 border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {selectedRecoveryForDetails && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedRecoveryForDetails(null)}>
          <div 
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-905 shadow-2xl p-6 overflow-y-auto space-y-6 animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
              transition: 'transform 0.3s ease-in-out'
            }}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-start border-b border-zinc-900 pb-4">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Damage Recovery Details</span>
                <h2 className="text-xl font-black text-white mt-1">{selectedRecoveryForDetails.complaintTitle}</h2>
                <p className="text-zinc-400 text-xs mt-1">
                  Resident: <span className="text-zinc-200 font-bold">{selectedRecoveryForDetails.residentName}</span> (Room {selectedRecoveryForDetails.roomNumber})
                </p>
              </div>
              <button 
                onClick={() => setSelectedRecoveryForDetails(null)}
                className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* General Info / Financial Summary Card */}
            <div className="grid grid-cols-3 gap-4 bg-zinc-900/30 border border-zinc-900/80 rounded-2xl p-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Recovery Cost</span>
                <span className="text-lg font-black text-white">₹{selectedRecoveryForDetails.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Total Recovered</span>
                <span className="text-lg font-black text-green-400">₹{selectedRecoveryForDetails.collectedAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Outstanding</span>
                <span className="text-lg font-black text-amber-400">₹{selectedRecoveryForDetails.outstandingAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Status & Method Badges */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Current Status</span>
                {getStatusBadge(selectedRecoveryForDetails.status)}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Recovery Method</span>
                {getMethodBadge(selectedRecoveryForDetails.recoveryMethod)}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">Settlement Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border font-extrabold w-fit
                  ${selectedRecoveryForDetails.settlementStatus === 'LOCKED' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse' 
                    : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                >
                  {selectedRecoveryForDetails.settlementStatus}
                </span>
              </div>
            </div>

            {/* Breakdown Items List */}
            {selectedRecoveryForDetails.items.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5 text-zinc-500" /> Deduction Items Breakdown
                </h3>
                <div className="border border-zinc-900 rounded-xl bg-zinc-950/40 divide-y divide-zinc-900">
                  {selectedRecoveryForDetails.items.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-zinc-200 block">{item.title}</span>
                        {item.notes && <span className="text-[10px] text-zinc-500 block mt-0.5">{item.notes}</span>}
                      </div>
                      <span className="font-extrabold text-zinc-300">₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recovery Payment Transactions List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-zinc-500" /> Recovery Transactions Ledger
              </h3>
              {selectedRecoveryForDetails.recoveryTransactions.length === 0 ? (
                <div className="text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl p-4 bg-zinc-950/20 text-center">
                  No payment collections recorded yet.
                </div>
              ) : (
                <div className="border border-zinc-900 rounded-xl bg-zinc-950/40 divide-y divide-zinc-900">
                  {selectedRecoveryForDetails.recoveryTransactions.map((tx: any) => (
                    <div key={tx.id} className="p-3 flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-zinc-200 block capitalize">{tx.paymentMethod} Payment</span>
                        {tx.referenceNumber && (
                          <span className="text-[10px] text-zinc-500 font-medium block mt-0.5">Ref: {tx.referenceNumber}</span>
                        )}
                        {tx.notes && (
                          <span className="text-[10px] text-zinc-400 block mt-1 bg-zinc-900/60 p-1.5 rounded">{tx.notes}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-black text-green-400 block">₹{tx.amount.toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-zinc-500 block mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deposit Deductions List */}
            {selectedRecoveryForDetails.depositTransactions && selectedRecoveryForDetails.depositTransactions.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" /> Security Deposit Deductions
                </h3>
                <div className="border border-zinc-900 rounded-xl bg-zinc-950/40 divide-y divide-zinc-900">
                  {selectedRecoveryForDetails.depositTransactions.map((tx: any) => (
                    <div key={tx.id} className="p-3 flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-zinc-200 block">{tx.reason || 'Deposit Deduction'}</span>
                        {tx.notes && (
                          <span className="text-[10px] text-zinc-400 block mt-1 bg-zinc-900/60 p-1.5 rounded">{tx.notes}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-black text-blue-400 block">₹{tx.amount.toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-zinc-500 block mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bills & Photos */}
            {selectedRecoveryForDetails.attachmentUrls && selectedRecoveryForDetails.attachmentUrls.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                  Attached Bills & Media
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedRecoveryForDetails.attachmentUrls.map((url: string, idx: number) => {
                    const isImg = url.match(/\.(jpeg|jpg|gif|png|webp)/i);
                    return (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group border border-zinc-900 hover:border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/40 rounded-xl p-3 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer"
                      >
                        {isImg ? (
                          <img src={url} alt="Attached Receipt" className="h-16 w-16 object-cover rounded-lg bg-zinc-900" />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500">
                            DOC
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          View Attachment {idx + 1}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audit Logs Trail */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" /> Audit Logging Trail
              </h3>
              {isLoadingAuditLogs ? (
                <div className="text-xs text-zinc-500 border border-zinc-900/60 rounded-xl p-4 bg-zinc-950/20 text-center animate-pulse">
                  Loading audit trails...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl p-4 bg-zinc-950/20 text-center">
                  No audit logs recorded for this recovery.
                </div>
              ) : (
                <div className="space-y-2.5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-900">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="pl-7 relative text-xs text-left">
                      <div className="absolute left-[9px] top-1.5 h-2 w-2 rounded-full bg-purple-500 border border-zinc-950 shadow" />
                      <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-3 space-y-1 hover:border-zinc-800 transition-colors">
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                          <span className="font-extrabold uppercase text-purple-400 tracking-wider">{log.action.replace('_', ' ')}</span>
                          <span>
                            {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-zinc-350 text-[11px]">
                          Performed by <span className="font-extrabold text-zinc-200">{log.actorId || 'system'}</span>
                        </p>
                        {log.metadata && (
                          <div className="text-[10px] bg-zinc-950/80 p-2 rounded-lg text-zinc-500 font-mono mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecoveriesLedgerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading damage recoveries ledger...</div>}>
      <RecoveriesLedgerContent />
    </Suspense>
  );
}
