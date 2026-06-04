'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { usePaymentRequestStore } from '@/store/usePaymentRequestStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Send, 
  PlusCircle, 
  Calendar, 
  User, 
  QrCode, 
  Banknote, 
  Building,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  DollarSign,
  TrendingUp,
  History,
  Check,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentItem {
  id: string;
  type: 'RENT' | 'SECURITY_DEPOSIT' | 'DAMAGE';
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  createdAt: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  originalStatus: string;
  residentName: string;
  residentPhone: string;
  residentId: string;
  roomNumber: string;
  bedNumber: string;
  activeLink: {
    referenceId: string;
    paymentUrl: string;
    status: string;
    expiresAt: string;
  } | null;
}

export default function PaymentsPage() {
  const { activePgId } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();
  const { openPaymentRequest } = usePaymentRequestStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Collection Sheet State
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'cash' | 'bank_transfer' | 'deposit'>('upi');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');

  // 1. Fetch Unified Payments
  const { data: paymentsResponse, isLoading } = useQuery({
    queryKey: ['pg-payments', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/payments`),
    enabled: !!activePgId,
  });

  const payments: PaymentItem[] = paymentsResponse?.data || [];

  // 2. Settle Rent/Deposit/Damage Mutation
  const collectPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) return;
      
      const parsedAmount = parseFloat(collectAmount) || 0;

      if (selectedPayment.type === 'DAMAGE') {
        // Damage recovery settlement endpoint
        return fetchApi(`/pgs/${activePgId}/recoveries/${selectedPayment.id}/status`, {
          method: 'POST',
          body: JSON.stringify({
            amountReceived: parsedAmount,
            paymentMode: paymentMode.toUpperCase(),
            referenceNumber,
            notes: collectionNotes,
            status: parsedAmount >= selectedPayment.outstandingAmount ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED'
          })
        });
      } else {
        // Rent/Deposit invoice endpoint
        const endpoint = selectedPayment.type === 'SECURITY_DEPOSIT' ? 'pay-deposit' : 'pay-rent';
        return fetchApi(`/pgs/${activePgId}/tenants/${selectedPayment.residentId}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
            paymentMode,
            amount: parsedAmount,
            invoiceId: selectedPayment.id,
            referenceNumber,
            notes: collectionNotes
          })
        });
      }
    },
    onSuccess: () => {
      toast.success('Payment collected and logged successfully');
      queryClient.invalidateQueries({ queryKey: ['pg-payments', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['profit-summary', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', activePgId] });
      setSelectedPayment(null);
      setCollectAmount('');
      setReferenceNumber('');
      setCollectionNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record payment.');
    }
  });

  // Calculate Metrics dynamically
  const metrics = React.useMemo(() => {
    let totalOutstanding = 0;
    let totalPaid = 0;
    let rentOutstanding = 0;
    let depositOutstanding = 0;
    let damageOutstanding = 0;

    payments.forEach(p => {
      totalOutstanding += p.outstandingAmount;
      totalPaid += p.paidAmount;

      if (p.type === 'RENT') {
        rentOutstanding += p.outstandingAmount;
      } else if (p.type === 'SECURITY_DEPOSIT') {
        depositOutstanding += p.outstandingAmount;
      } else if (p.type === 'DAMAGE') {
        damageOutstanding += p.outstandingAmount;
      }
    });

    return {
      totalOutstanding,
      totalPaid,
      rentOutstanding,
      depositOutstanding,
      damageOutstanding
    };
  }, [payments]);

  // Filter payments
  const filteredPayments = React.useMemo(() => {
    return payments.filter(p => {
      // Tab matching
      if (p.status !== activeTab) return false;

      // Type matching
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;

      // Search matching
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.residentName.toLowerCase().includes(query);
        const roomMatch = p.roomNumber.toLowerCase().includes(query);
        const phoneMatch = p.residentPhone?.toLowerCase().includes(query);
        return nameMatch || roomMatch || phoneMatch;
      }

      return true;
    });
  }, [payments, activeTab, typeFilter, searchQuery]);

  const handleOpenCollect = (payment: PaymentItem) => {
    setSelectedPayment(payment);
    setCollectAmount(payment.outstandingAmount.toString());
    setPaymentMode(payment.type === 'DAMAGE' ? 'deposit' : 'upi');
  };

  const handleConfirmCollect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    const parsedAmount = parseFloat(collectAmount) || 0;
    if (parsedAmount <= 0) {
      toast.error('Amount must be greater than zero.');
      return;
    }

    if (parsedAmount > selectedPayment.outstandingAmount) {
      toast.error(`Amount cannot exceed outstanding dues of ₹${selectedPayment.outstandingAmount.toLocaleString('en-IN')}`);
      return;
    }

    collectPaymentMutation.mutate();
  };

  const handleSendReminder = (payment: PaymentItem) => {
    openPaymentRequest(
      payment.type,
      payment.id,
      {
        invoiceNumber: `${payment.type.substr(0, 3)}-${payment.id.substr(0, 8).toUpperCase()}`,
        residentName: payment.residentName,
        residentPhone: payment.residentPhone,
        amount: payment.outstandingAmount,
        dueDate: payment.dueDate
      }
    );
  };

  const getDuesLabel = (type: string) => {
    switch (type) {
      case 'RENT': return 'Rent';
      case 'SECURITY_DEPOSIT': return 'Deposit';
      case 'DAMAGE': return 'Damage Charges';
      default: return 'Outstanding';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Payments & Receipts</h1>
          <p className="text-zinc-400 text-xs mt-1">Manage rent collection, deposit invoices, and damage recovery settlement ledgers.</p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Outstanding</span>
              <span className="text-2xl font-black text-red-400">₹{metrics.totalOutstanding.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Collected</span>
              <span className="text-2xl font-black text-green-400">₹{metrics.totalPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Rent Outstanding</span>
              <span className="text-2xl font-black text-amber-500">₹{metrics.rentOutstanding.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Deposit & Damages</span>
              <span className="text-2xl font-black text-blue-400">₹{(metrics.depositOutstanding + metrics.damageOutstanding).toLocaleString('en-IN')}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Building className="h-5 w-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Selector & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl">
        {/* Status Tabs */}
        <div className="flex bg-black p-1 rounded-xl border border-zinc-900 w-fit">
          {(['UNPAID', 'PARTIAL', 'PAID'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all
                ${activeTab === tab 
                  ? 'bg-zinc-900 text-white shadow-sm' 
                  : 'text-zinc-550 hover:text-zinc-300'}`}
            >
              {tab === 'PARTIAL' ? 'Partially Paid' : tab}
            </button>
          ))}
        </div>

        {/* Filter & Search Panel */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search resident or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-900 text-white rounded-xl text-xs h-9 focus:border-zinc-800"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-black border border-zinc-900 text-white rounded-xl text-xs h-9 px-3 focus:outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Types</option>
              <option value="RENT">Rent Only</option>
              <option value="SECURITY_DEPOSIT">Security Deposit Only</option>
              <option value="DAMAGE">Damages Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Unified Invoices List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-zinc-900 rounded-xl" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="border border-zinc-900 rounded-2xl p-12 text-center bg-zinc-950/10">
          <History className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-400">No payment items found.</p>
          <p className="text-xs text-zinc-500 mt-1">Try relaxing filters or search terms.</p>
        </div>
      ) : (
        <div className="border border-zinc-900 rounded-2xl bg-zinc-950/10 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold leading-normal">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500 font-bold bg-zinc-950/40 select-none">
                  <th className="p-4">Resident</th>
                  <th className="p-4">Room & Bed</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Raised / Due Date</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right">Outstanding</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {filteredPayments.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-950/30 transition-colors">
                    <td className="p-4">
                      <button
                        onClick={() => openProfile(item.residentId)}
                        className="font-extrabold text-sm text-zinc-200 hover:text-primary transition-all text-left underline decoration-dashed decoration-zinc-800 hover:decoration-primary underline-offset-4"
                      >
                        {item.residentName}
                      </button>
                      <span className="text-[10px] text-zinc-500 block font-normal mt-0.5">{item.residentPhone || 'No Phone'}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-zinc-300">Room {item.roomNumber}</span>
                      <span className="text-[10px] text-zinc-500 block font-normal mt-0.5">Bed {item.bedNumber}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border 
                        ${item.type === 'RENT' 
                          ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' 
                          : item.type === 'SECURITY_DEPOSIT'
                            ? 'bg-blue-500/5 border-blue-500/10 text-blue-400'
                            : 'bg-red-500/5 border-red-500/10 text-red-400'}`}>
                        {getDuesLabel(item.type)}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-zinc-450">
                      {new Date(item.dueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-4 text-right font-extrabold text-zinc-300">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 text-right font-extrabold text-red-450">
                      {item.outstandingAmount > 0 ? `₹${item.outstandingAmount.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {item.status !== 'PAID' ? (
                          <>
                            <button
                              onClick={() => handleOpenCollect(item)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold hover:text-white transition-all text-[11px]"
                            >
                              Collect
                            </button>
                            <button
                              onClick={() => handleSendReminder(item)}
                              className="p-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                              title="Send Reminder Drawer"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-green-450 font-extrabold text-[11px]">
                            <Check className="h-3.5 w-3.5 stroke-[3]" /> Collected
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Grid Layout */}
          <div className="block md:hidden divide-y divide-zinc-900/60">
            {filteredPayments.map((item) => (
              <div key={item.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <button
                      onClick={() => openProfile(item.residentId)}
                      className="font-extrabold text-base text-zinc-200 text-left underline decoration-dashed decoration-zinc-800 hover:decoration-primary underline-offset-4"
                    >
                      {item.residentName}
                    </button>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Room {item.roomNumber} — Bed {item.bedNumber}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border 
                    ${item.type === 'RENT' 
                      ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' 
                      : item.type === 'SECURITY_DEPOSIT'
                        ? 'bg-blue-500/5 border-blue-500/10 text-blue-400'
                        : 'bg-red-500/5 border-red-500/10 text-red-400'}`}>
                    {getDuesLabel(item.type)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900/60 text-[11px]">
                  <div>
                    <span className="text-zinc-550 block text-[9px] uppercase font-bold tracking-wider">Amount</span>
                    <span className="font-extrabold text-zinc-300 block mt-0.5">₹{item.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-550 block text-[9px] uppercase font-bold tracking-wider">Due Date</span>
                    <span className="font-mono text-zinc-400 block mt-0.5">
                      {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-550 block text-[9px] uppercase font-bold tracking-wider">Outstanding</span>
                    <span className="font-extrabold text-red-400 block mt-0.5">
                      ₹{item.outstandingAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {item.status !== 'PAID' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenCollect(item)}
                      className="flex-1 bg-zinc-900 border border-zinc-800 text-white font-extrabold text-xs h-9 rounded-lg"
                    >
                      Log Collection
                    </Button>
                    <Button
                      onClick={() => handleSendReminder(item)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs h-9 px-3 rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" /> Request
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Collection Bottom Sheet Drawer */}
      <Sheet open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-900 flex flex-col p-6 max-h-[90vh] overflow-y-auto">
          {selectedPayment && (
            <div className="space-y-5">
              <SheetHeader>
                <div className="space-y-0.5">
                  <SheetTitle className="text-xl font-black text-zinc-150">Log Manual Payment</SheetTitle>
                  <SheetDescription className="text-zinc-500 text-xs font-medium">
                    Settle rent, deposit, or damage recovery dues directly via cash or external UPI.
                  </SheetDescription>
                </div>
              </SheetHeader>

              {/* Resident Context Profile */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Resident</span>
                    <span className="text-base font-black text-zinc-150 block mt-0.5">{selectedPayment.residentName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Location</span>
                    <span className="text-xs font-extrabold text-zinc-350 block mt-0.5">
                      Room {selectedPayment.roomNumber} — Bed {selectedPayment.bedNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900/60">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Type</span>
                    <span className="text-xs font-black text-zinc-350 block mt-0.5">{getDuesLabel(selectedPayment.type)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Outstanding Dues</span>
                    <span className="text-base font-black text-red-400 block mt-0.5">
                      ₹{selectedPayment.outstandingAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmCollect} className="space-y-4 text-xs font-semibold">
                {/* Amount to Collect */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Amount Received (₹) *</Label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-extrabold text-lg">₹</div>
                    <Input
                      type="number"
                      value={collectAmount}
                      onChange={(e) => setCollectAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="pl-8 h-12 text-lg font-bold bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
                      max={selectedPayment.outstandingAmount}
                      min={1}
                      disabled={collectPaymentMutation.isPending}
                    />
                  </div>
                  {parseFloat(collectAmount) < selectedPayment.outstandingAmount && parseFloat(collectAmount) > 0 && (
                    <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1 mt-1">
                      <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                      Dues of ₹{(selectedPayment.outstandingAmount - parseFloat(collectAmount)).toLocaleString('en-IN')} will remain active.
                    </p>
                  )}
                </div>

                {/* Mode Selection */}
                <div className="space-y-2">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Collection Method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('upi')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                        ${paymentMode === 'upi' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/20 text-zinc-450'}`}
                    >
                      <QrCode className="h-4.5 w-4.5 mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider">UPI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('cash')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                        ${paymentMode === 'cash' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/20 text-zinc-450'}`}
                    >
                      <Banknote className="h-4.5 w-4.5 mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Cash</span>
                    </button>
                    
                    {/* Render DEPOSIT option for Damage recovery, transfer option for standard invoices */}
                    {selectedPayment.type === 'DAMAGE' ? (
                      <button
                        type="button"
                        onClick={() => setPaymentMode('deposit')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                          ${paymentMode === 'deposit' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/20 text-zinc-450'}`}
                      >
                        <Building className="h-4.5 w-4.5 mb-1" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Deposit Deduct</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPaymentMode('bank_transfer')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                          ${paymentMode === 'bank_transfer' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/20 text-zinc-450'}`}
                      >
                        <Building className="h-4.5 w-4.5 mb-1" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Bank Transfer</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Reference ID (Optional) */}
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Transaction Ref / ID (Optional)</Label>
                  <Input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UPI Ref, Bank Txn Hash"
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                    disabled={collectPaymentMutation.isPending}
                  />
                </div>

                {/* Notes (Optional) */}
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Internal Notes (Optional)</Label>
                  <textarea
                    rows={2}
                    value={collectionNotes}
                    onChange={(e) => setCollectionNotes(e.target.value)}
                    placeholder="e.g. Paid in part, promise to pay rest next week."
                    className="w-full bg-zinc-900 border border-zinc-850 p-2.5 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-zinc-700"
                    disabled={collectPaymentMutation.isPending}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedPayment(null)}
                    className="flex-1 border-zinc-850 hover:bg-zinc-900 text-zinc-400 font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={collectPaymentMutation.isPending}
                    className="flex-1 bg-primary text-black font-extrabold"
                  >
                    {collectPaymentMutation.isPending ? 'Logging Payment...' : 'Confirm Settle'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
