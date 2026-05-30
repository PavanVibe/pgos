'use client';

import { useState, Suspense } from 'react';
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
  Clock
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
  status: 'PENDING' | 'ACCEPTED' | 'DISPUTED' | 'RECOVERED' | 'WAIVED' | 'REFUNDED';
  recoveryMethod: 'DEPOSIT' | 'CASH' | 'UPI' | 'WAIVED';
  settlementStatus: 'OPEN' | 'SETTLED' | 'LOCKED';
  date: string;
  attachmentUrls: string[];
  disputeReason: string | null;
  waivedReason: string | null;
  items: RecoveryItem[];
}

function RecoveriesLedgerContent() {
  const { activePgId, availablePgs, setActivePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'ACCEPTED' | 'DISPUTED' | 'RECOVERED' | 'WAIVED'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'DEPOSIT' | 'CASH' | 'UPI' | 'WAIVED'>('all');

  // Modal / Action states
  const [actionRecovery, setActionRecovery] = useState<RecoveryRow | null>(null);
  const [actionType, setActionType] = useState<'DISPUTE' | 'WAIVE' | 'COLLECT' | null>(null);
  
  // Custom inputs for action modals
  const [reasonInput, setReasonInput] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('UPI');
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

  const ledgerData: RecoveryRow[] = ledgerResponse?.data || [];
  const stats = statsResponse?.data || {
    pendingRecoveriesCount: 0,
    pendingRecoveriesAmount: 0,
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
    onSuccess: () => {
      toast.success('Damage recovery record updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['recoveries-dashboard', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
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
    onSuccess: () => {
      toast.success('Recovery updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['recoveries-dashboard', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
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

  const handleOpenActionModal = (row: RecoveryRow, type: 'DISPUTE' | 'WAIVE' | 'COLLECT') => {
    if (row.settlementStatus === 'LOCKED') {
      toast.error('Stay record is LOCKED. No modifications allowed.');
      return;
    }
    setActionRecovery(row);
    setActionType(type);
    setReasonInput('');
    setAmountReceived(row.outstandingAmount.toString());
    setPaymentMode('UPI');
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
    } else if (actionType === 'COLLECT') {
      const amt = parseFloat(amountReceived);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please specify a valid collection amount.');
        return;
      }
      if (amt > actionRecovery.outstandingAmount) {
        toast.error(`Received amount cannot exceed the outstanding liability of ₹${actionRecovery.outstandingAmount}`);
        return;
      }
      updateStatusMutation.mutate({
        status: 'RECOVERED',
        amountReceived: amt,
        paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined
      });
    }
  };

  // Filter ledger rows
  const filteredLedger = ledgerData.filter((row) => {
    if (searchQuery && !row.residentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (methodFilter !== 'all' && row.recoveryMethod !== methodFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECOVERED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 className="h-3 w-3" /> RECOVERED
          </span>
        );
      case 'WAIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
            <Ban className="h-3 w-3" /> WAIVED
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
            <MessageSquareOff className="h-3 w-3" /> DISPUTED
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="h-3 w-3" /> ACCEPTED
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" /> PENDING
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Outstanding Liabilities</span>
            <span className="text-3xl font-black text-amber-400 block">
              ₹{stats.totalOutstandingAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">{stats.pendingRecoveriesCount} Pending/Accepted Recoveries.</span>
          </CardContent>
        </Card>

        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Recovered Amount</span>
            <span className="text-3xl font-black text-green-400 block">
              ₹{stats.totalRecoveredAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">{stats.recoveredCount} Recoveries settled.</span>
          </CardContent>
        </Card>

        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Disputed Liabilities</span>
            <span className="text-3xl font-black text-red-400 block">
              ₹{stats.disputedAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">{stats.disputedCount} Active Tenant disputes.</span>
          </CardContent>
        </Card>

        <Card className="border border-zinc-900 bg-zinc-950/20 hover:border-zinc-850 transition-all duration-300">
          <CardContent className="pt-6 space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Waived Damages</span>
            <span className="text-3xl font-black text-zinc-400 block">
              ₹{stats.waivedAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-500 block">{stats.waivedCount} Cases waived by admin.</span>
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
            <option value="RECOVERED">Recovered</option>
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
                  <tr key={row.id} className="hover:bg-zinc-900/10 transition-colors animate-fadeIn">
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
                    <td className="p-4 text-right">
                      {isLocked ? (
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Settled & Locked</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          {row.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleQuickAccept(row)}
                                className="px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:border-purple-500/50 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                              >
                                <Check className="h-3.5 w-3.5 inline-block -mt-0.5 mr-0.5" /> Accept
                              </button>
                              <button
                                onClick={() => handleOpenActionModal(row, 'DISPUTE')}
                                className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                              >
                                Dispute
                              </button>
                              <button
                                onClick={() => handleOpenActionModal(row, 'WAIVE')}
                                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-zinc-700 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                              >
                                Waive
                              </button>
                            </>
                          )}

                          {row.status === 'DISPUTED' && (
                            <>
                              <button
                                onClick={() => handleQuickAccept(row)}
                                className="px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:border-purple-500/50 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleOpenActionModal(row, 'WAIVE')}
                                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-zinc-700 text-[9px] font-bold uppercase cursor-pointer transition-colors"
                              >
                                Waive
                              </button>
                            </>
                          )}

                          {row.status === 'ACCEPTED' && (
                            <>
                              {row.recoveryMethod === 'DEPOSIT' ? (
                                <button
                                  onClick={() => handleQuickDeductDeposit(row)}
                                  className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded border border-blue-900/40 hover:border-blue-800 bg-blue-950/20 hover:bg-blue-950/40 text-[9px] font-bold uppercase text-blue-400 hover:text-blue-350 cursor-pointer transition-colors"
                                >
                                  <UserCheck className="h-3 w-3" /> Deduct Deposit
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenActionModal(row, 'COLLECT')}
                                  className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded border border-green-900/40 hover:border-green-800 bg-green-950/20 hover:bg-green-950/40 text-[9px] font-bold uppercase text-green-400 hover:text-green-350 cursor-pointer transition-colors"
                                >
                                  <Wallet className="h-3 w-3" /> Collect Payment
                                </button>
                              )}
                            </>
                          )}

                          {(row.status === 'RECOVERED' || row.status === 'WAIVED') && (
                            <span className="text-zinc-600 text-xs font-semibold select-none">-</span>
                          )}
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
                      <div className="grid grid-cols-2 gap-1 bg-black p-0.5 border border-zinc-900 rounded-lg h-9">
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
