'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { 
  User, Phone, Mail, Calendar, CreditCard, AlertCircle, Clock, ShieldCheck, 
  MapPin, DollarSign, ListTodo, ClipboardList, ExternalLink, X, Download, Lock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ResidentProfileDrawer() {
  const { isOpen, selectedProfileId, closeProfile } = useResidentProfileStore();
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // 1. Drawer mount diagnostic log
  useEffect(() => {
    console.log("[DIAGNOSTIC] ResidentProfileDrawer component mounted.");
  }, []);

  // 2. State change diagnostic log
  useEffect(() => {
    console.log(`[DIAGNOSTIC] ResidentProfileDrawer Open State: ${isOpen}, Selected ID: ${selectedProfileId}`);
  }, [isOpen, selectedProfileId]);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['residents', 'profile', selectedProfileId],
    queryFn: async () => {
      console.log(`[DIAGNOSTIC] ResidentProfileDrawer API Fetch initiated for profileId: ${selectedProfileId}`);
      const res = await fetchApi(`/tenants/profiles/${selectedProfileId}`);
      console.log("[DIAGNOSTIC] ResidentProfileDrawer API Response received:", res);
      return res;
    },
    enabled: !!selectedProfileId && isOpen,
  });

  const profile = response?.data;
  const queryClient = useQueryClient();

  const lockSettlementMutation = useMutation({
    mutationFn: () => {
      return fetchApi(`/pgs/${profile?.pgId}/tenants/${profile?.id}/lock-settlement`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.success('Resident stay settlement locked permanently.');
      queryClient.invalidateQueries({ queryKey: ['residents', 'profile', selectedProfileId] });
      if (profile?.pgId) {
        queryClient.invalidateQueries({ queryKey: ['deposit-ledger', profile.pgId] });
        queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', profile.pgId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to lock stay settlement.');
    }
  });

  // Helpers to parse stay duration
  const calculateStayDuration = (inDate: string, outDate?: string | null) => {
    const start = new Date(inDate).getTime();
    const end = outDate ? new Date(outDate).getTime() : Date.now();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
    const months = (diffDays / 30.4).toFixed(1);
    return `${months} Month${parseFloat(months) !== 1 ? 's' : ''}`;
  };

  // Helper to parse Aadhaar Base64 documents from kycDocUrl
  const getKycDocs = (kycDocUrl?: string | null) => {
    if (!kycDocUrl) return null;
    try {
      if (kycDocUrl.startsWith('{')) {
        const parsed = JSON.parse(kycDocUrl);
        return {
          front: parsed.front || null,
          back: parsed.back || null,
        };
      }
    } catch (e) {
      console.error('Failed to parse kycDocUrl:', e);
    }
    // Fallback if it is a legacy comma-separated string or single URL
    return {
      front: kycDocUrl,
      back: null,
    };
  };

  const kycDocs = getKycDocs(profile?.globalTenant?.kycDocUrl);

  // Financial aggregates
  const invoices = profile?.invoices || [];
  
  const totalRentPaid = invoices
    .filter((inv: any) => inv.type === 'RENT' && inv.status === 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);
    
  const outstandingRent = invoices
    .filter((inv: any) => inv.type === 'RENT' && inv.status !== 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);
    
  const collectedDeposit = invoices
    .filter((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);

  const remainingDeposit = Math.max(0, (profile?.securityDeposit ?? 0) - collectedDeposit);

  const totalPayments = totalRentPaid + collectedDeposit;

  const outstandingTotal = invoices
    .filter((inv: any) => inv.status !== 'PAID')
    .reduce((sum: number, inv: any) => sum + inv.amount, 0);

  // Move-out Settlement Breakdown
  const damageRecoveries = profile?.damageRecoveries || [];
  
  // 1. Damage Recoveries mapped to DEPOSIT method and marked as RECOVERED/deducted from deposit
  const depositRecoveriesAmount = damageRecoveries
    .filter((rec: any) => rec.recoveryMethod === 'DEPOSIT')
    .reduce((sum: number, rec: any) => sum + (rec.recoveredAmount ?? rec.amountReceived ?? 0), 0);

  // 2. Direct Cash/UPI Recoveries
  const cashUpiRecoveriesAmount = damageRecoveries
    .filter((rec: any) => rec.recoveryMethod === 'CASH' || rec.recoveryMethod === 'UPI')
    .reduce((sum: number, rec: any) => sum + (rec.recoveredAmount ?? rec.amountReceived ?? 0), 0);

  // 3. Waived Recoveries
  const waivedRecoveriesAmount = damageRecoveries
    .filter((rec: any) => rec.status === 'WAIVED')
    .reduce((sum: number, rec: any) => sum + rec.amount, 0);

  // 4. Total Deductions (deposit deductions amount is stored on profile.depositDeductionAmount)
  const totalDeductions = profile?.depositDeductionAmount || 0;

  // 5. Final Refundable Deposit
  const finalRefundableDeposit = Math.max(0, collectedDeposit - (profile?.depositRefundedAmount || 0) - totalDeductions);

  // Status mapping
  const getDepositStatusLabel = () => {
    if (profile?.depositRefundedAt) return 'Refunded';
    if (profile?.securityDepositStatus === 'COLLECTED') return 'Collected';
    if (profile?.securityDepositStatus === 'PARTIALLY_PAID') return 'Partially Paid';
    return 'Pending';
  };

  const getDepositStatusColor = () => {
    if (profile?.depositRefundedAt) return 'text-purple-400 bg-purple-500/10 border-purple-500/15';
    if (profile?.securityDepositStatus === 'COLLECTED') return 'text-green-400 bg-green-500/10 border-green-500/15';
    if (profile?.securityDepositStatus === 'PARTIALLY_PAID') return 'text-blue-400 bg-blue-500/10 border-blue-500/15';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/15';
  };

  const complaints = profile?.complaints || [];

  console.log(`[DIAGNOSTIC] ResidentProfileDrawer render start. is_open: ${isOpen}, is_loading: ${isLoading}, has_profile: ${!!profile}`);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && closeProfile()}>
        <SheetContent className="w-full sm:max-w-2xl bg-black text-white border-zinc-900 flex flex-col p-0 overflow-y-auto h-full">
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest animate-pulse">
                Resolving Resident STAY Ledger...
              </p>
            </div>
          )}

          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-red-400 font-bold">Failed to load resident stay ledger</p>
              <Button onClick={closeProfile} size="sm" variant="outline" className="border-zinc-800">
                Close Drawer
              </Button>
            </div>
          )}

          {!isLoading && !isError && profile && (
            <div className="flex flex-col h-full divide-y divide-zinc-900">
              {/* Header Context */}
              <div className="p-6 space-y-3.5 bg-zinc-950/40">
                <SheetHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border inline-block
                        ${profile.status === 'ACTIVE' ? 'text-green-400 bg-green-500/10 border-green-500/15' : 
                          profile.status === 'NOTICE' ? 'text-amber-400 bg-amber-500/10 border-amber-500/15' : 
                          'text-zinc-400 bg-zinc-900 border-zinc-850'}`}
                      >
                        {profile.status === 'ACTIVE' ? 'Active Resident' : 
                         profile.status === 'NOTICE' ? 'Serving Notice' : 'Past Stay (Historical)'}
                      </span>
                      <SheetTitle className="text-2xl font-black text-white mt-2">
                        {profile.globalTenant?.name || 'Resident Details'}
                      </SheetTitle>
                      <SheetDescription className="text-zinc-500 text-xs mt-1">
                        Resident Profile stay ledger dashboard.
                      </SheetDescription>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-black text-green-400 bg-green-500/5 border border-green-500/15 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="h-4 w-4" /> KYC Verified
                    </div>
                  </div>
                </SheetHeader>
              </div>

              {/* Scrollable Information Body */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                
                {/* 1. PERSONAL INFORMATION */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Personal Information
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-3 text-xs">
                      <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">WhatsApp Phone</p>
                        <p className="text-zinc-200 font-extrabold mt-0.5">{profile.globalTenant?.phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs border-t border-zinc-900/50 md:border-t-0 md:border-l pl-0 md:pl-4 pt-3.5 md:pt-0">
                      <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="truncate">
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Email Address</p>
                        <p className="text-zinc-200 font-extrabold mt-0.5 truncate max-w-[200px]" title={profile.globalTenant?.email}>
                          {profile.globalTenant?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. STAY SNAPSHOT */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Stay History & Snapshot
                  </h5>
                  <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Allocated Bed</span>
                      <span className="font-extrabold text-sm text-zinc-200 block mt-0.5">
                        Room {profile.room?.number || profile.historicalRoomNumber || 'N/A'} — Bed {profile.bed?.bedNumber || profile.historicalBedNumber || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Stay Duration</span>
                      <span className="font-extrabold text-sm text-zinc-200 block mt-0.5">
                        {calculateStayDuration(profile.moveInDate, profile.moveOutDate)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-zinc-900">
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Move-In Date</span>
                      <span className="font-extrabold text-zinc-300 block mt-0.5">
                        {new Date(profile.moveInDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-zinc-900">
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Move-Out Date</span>
                      <span className="font-extrabold text-zinc-300 block mt-0.5">
                        {profile.moveOutDate 
                          ? new Date(profile.moveOutDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Active Stayer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2.5 Dedicated Security Deposit Card */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Security Deposit Card
                  </h5>
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-900/60 pb-3">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Deposit Amount</span>
                        <span className="font-black text-lg text-blue-400 block mt-0.5">
                          ₹{(profile.securityDeposit ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border inline-block
                        ${getDepositStatusColor()}`}
                      >
                        {getDepositStatusLabel()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Collected Amount</span>
                        <span className="font-extrabold text-green-400 block mt-0.5">
                          ₹{collectedDeposit.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Remaining Amount</span>
                        <span className="font-extrabold text-amber-500 block mt-0.5">
                          ₹{remainingDeposit.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-zinc-900/60">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Collected Date</span>
                        <span className="font-extrabold text-zinc-300 block mt-0.5">
                          {profile.depositCollectedAt 
                            ? new Date(profile.depositCollectedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-zinc-900/60">
                        <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Payment Mode</span>
                        <span className="font-extrabold text-zinc-300 block mt-0.5 uppercase">
                          {invoices.find((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')?.paymentMode || 'N/A'}
                        </span>
                      </div>
                      {profile.depositRefundedAt ? (
                        <>
                          <div className="pt-3 border-t border-zinc-900/60">
                            <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Refund Amount</span>
                            <span className="font-extrabold text-purple-400 block mt-0.5">
                              ₹{(profile.depositRefundedAmount ?? 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="pt-3 border-t border-zinc-900/60">
                            <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Damage Deduction</span>
                            <span className={`font-extrabold block mt-0.5 ${profile.depositDeductionAmount > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                              ₹{(profile.depositDeductionAmount ?? 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="pt-3 border-t border-zinc-900/60">
                            <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Refund Date</span>
                            <span className="font-extrabold text-zinc-300 block mt-0.5">
                              {new Date(profile.depositRefundedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="pt-3 border-t border-zinc-900/60">
                            <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Refund Mode</span>
                            <span className="font-extrabold text-zinc-300 block mt-0.5 uppercase">
                              {profile.depositRefundMode || 'N/A'}
                            </span>
                          </div>
                          {profile.depositRefundNotes && (
                            <div className="pt-3 border-t border-zinc-900/60 col-span-2">
                              <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Deduction Reason / Notes</span>
                              <span className="text-zinc-300 block mt-0.5 leading-normal text-xs italic">
                                "{profile.depositRefundNotes}"
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="pt-3 border-t border-zinc-900/60 col-span-2">
                          <span className="text-[9px] text-zinc-500 block uppercase tracking-wider font-bold">Refund & Settlement Summary</span>
                          <span className="font-extrabold text-zinc-500 block mt-0.5 leading-normal text-xs">
                            No refunds processed yet.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2.6 SECURITY DEPOSIT TIMELINE */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Security Deposit Timeline
                  </h5>
                  <div className="bg-zinc-950 p-5 border border-zinc-900 rounded-xl space-y-5 relative">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-7 top-6 bottom-6 w-0.5 bg-zinc-900" />

                    {/* Step 1: Configured/Expected */}
                    <div className="relative flex gap-4 text-xs">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 z-10">
                        1
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">
                          {new Date(profile.moveInDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="font-extrabold text-zinc-200 block">Deposit Configured</span>
                        <span className="text-[11px] text-zinc-400 block">
                          Expected Deposit: ₹{(profile.securityDeposit ?? 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Step 2: Collected */}
                    {(profile.securityDepositStatus === 'COLLECTED' || profile.securityDepositStatus === 'PARTIALLY_REFUNDED' || profile.securityDepositStatus === 'REFUNDED' || collectedDeposit > 0) && (
                      <div className="relative flex gap-4 text-xs">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30 text-[10px] font-bold text-green-400 z-10">
                          2
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">
                            {profile.depositCollectedAt 
                              ? new Date(profile.depositCollectedAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : new Date(profile.moveInDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                          </span>
                          <span className="font-extrabold text-zinc-200 block">Deposit Collected</span>
                          <span className="text-[11px] text-zinc-400 block">
                            ₹{collectedDeposit.toLocaleString('en-IN')} via <span className="uppercase text-zinc-300">{invoices.find((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')?.paymentMode || 'UPI'}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Refunded/Deducted */}
                    {(profile.depositRefundedAt || (profile.depositDeductionAmount && profile.depositDeductionAmount > 0)) && (
                      <div className="relative flex gap-4 text-xs">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] font-bold text-purple-400 z-10">
                          3
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">
                            {profile.depositRefundedAt && new Date(profile.depositRefundedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="font-extrabold text-zinc-200 block">Deposit Refunded</span>
                          <span className="text-[11px] text-zinc-400 block">
                            ₹{(profile.depositRefundedAmount ?? 0).toLocaleString('en-IN')} via <span className="uppercase text-zinc-350">{profile.depositRefundMode || 'UPI'}</span>
                          </span>
                          {profile.depositDeductionAmount && profile.depositDeductionAmount > 0 ? (
                            <span className="block text-[11px] text-red-400 font-semibold mt-0.5">
                              Damage Deduction: ₹{profile.depositDeductionAmount.toLocaleString('en-IN')}
                            </span>
                          ) : null}
                          {profile.depositRefundNotes && (
                            <p className="text-[10px] text-zinc-500 italic mt-1 leading-normal border-l border-zinc-800 pl-2">
                              Note: {profile.depositRefundNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline Status */}
                    <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      <span>Timeline Status</span>
                      <span className={profile.securityDepositStatus === 'REFUNDED' ? 'text-zinc-500' : 'text-purple-400'}>
                        {profile.securityDepositStatus === 'REFUNDED' ? 'Closed' : 'Open'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resident Financial Summary */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Resident Financial Summary
                  </h5>
                  <div className="grid grid-cols-3 gap-2.5 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs font-semibold">
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Rent Paid</span>
                      <span className="text-emerald-400 text-sm font-black">₹{totalRentPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                      <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Deposit Paid</span>
                      <span className="text-blue-400 text-sm font-black">₹{collectedDeposit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                      <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Total Payments</span>
                      <span className="text-primary text-sm font-black">₹{totalPayments.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* MOVE-OUT SETTLEMENT BREAKDOWN */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Move-Out Settlement Breakdown
                  </h5>
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-3 text-xs font-semibold">
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Total Deposit Collected</span>
                      <span className="text-zinc-200 font-extrabold">₹{collectedDeposit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Damage Recoveries (Deducted from Deposit)</span>
                      <span className="text-red-400 font-extrabold">-{`₹${depositRecoveriesAmount.toLocaleString('en-IN')}`}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-900/60 pb-2">
                      <span>Other Deposit Deductions / Adjustments</span>
                      <span className="text-red-400 font-extrabold">-{`₹${Math.max(0, totalDeductions - depositRecoveriesAmount).toLocaleString('en-IN')}`}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Direct Cash / UPI Recoveries (Collected)</span>
                      <span className="text-green-400 font-extrabold">₹{cashUpiRecoveriesAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-900/60 pb-2">
                      <span>Waived Damages (No liability)</span>
                      <span className="text-zinc-500 font-extrabold">₹{waivedRecoveriesAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Total Refunded to Date</span>
                      <span className="text-purple-400 font-extrabold">-{`₹${(profile?.depositRefundedAmount || 0).toLocaleString('en-IN')}`}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-900 font-black">
                      <span className="text-zinc-100">Net Refundable Balance / Settlement Liability</span>
                      <span className="text-primary font-black">₹{finalRefundableDeposit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* DAMAGE RECOVERY HISTORY TIMELINE */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5" />
                    Damage Recovery History & Timeline
                  </h5>
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-3 max-h-56 overflow-y-auto scrollbar-none">
                    {damageRecoveries.length === 0 ? (
                      <div className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider py-4">
                        No damage recovery records found for this stay.
                      </div>
                    ) : (
                      damageRecoveries.map((rec: any) => (
                        <div key={rec.id} className="p-3 border border-zinc-900/80 bg-zinc-950/40 rounded-lg flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-extrabold text-zinc-200">
                              {rec.reason || 'Damage Recovery'}
                            </span>
                            <span className="font-black text-zinc-150">₹{rec.amount.toLocaleString('en-IN')}</span>
                          </div>
                          
                          {rec.items && rec.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {rec.items.map((item: any) => (
                                <span key={item.id} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-medium">
                                  {item.title}: ₹{item.amount}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5 pt-1.5 border-t border-zinc-900/60 font-sans">
                            <span>Method: {rec.recoveryMethod}</span>
                            <span className={`font-black
                              ${(rec.status === 'RECOVERED' || rec.status === 'FULLY_RECOVERED') ? 'text-green-400' : 
                                rec.status === 'PARTIALLY_RECOVERED' ? 'text-blue-400' : 
                                rec.status === 'DISPUTED' ? 'text-red-400' : 
                                rec.status === 'WAIVED' ? 'text-zinc-500' : 
                                'text-amber-400'}`}
                            >
                              {rec.status.replace('_', ' ')}
                            </span>
                          </div>
                          {rec.createdAt && (
                            <p className="text-[9px] text-zinc-500 mt-1">
                              Date: {new Date(rec.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {rec.referenceNumber && ` | Ref: ${rec.referenceNumber}`}
                            </p>
                          )}
                          {rec.disputeReason && (
                            <p className="text-[9px] text-red-400/80 italic mt-1 leading-normal">
                              Dispute: "{rec.disputeReason}"
                            </p>
                          )}
                          {rec.waivedReason && (
                            <p className="text-[9px] text-zinc-500 italic mt-1 leading-normal">
                              Waive reason: "{rec.waivedReason}"
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Deposit Transaction History */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5" />
                    Deposit Transaction History
                  </h5>
                  <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-3 max-h-48 overflow-y-auto scrollbar-none">
                    {invoices.filter((inv: any) => inv.type === 'SECURITY_DEPOSIT').length === 0 && !profile.depositRefundedAt ? (
                      <div className="text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider py-4">
                        No deposit transaction history found.
                      </div>
                    ) : (
                      <>
                        {invoices
                          .filter((inv: any) => inv.type === 'SECURITY_DEPOSIT')
                          .map((inv: any) => {
                            const isSplitAdjustment = inv.razorpayOrdId?.startsWith('split_parent_deposit:');
                            return (
                              <div key={inv.id} className="p-3 border border-zinc-900/80 bg-zinc-950/40 rounded-lg flex flex-col gap-1 text-xs">
                                <div className="flex justify-between items-start">
                                  <span className="font-extrabold text-zinc-200">
                                    {isSplitAdjustment 
                                      ? 'Deposit Split Adjustment' 
                                      : inv.status === 'PAID' 
                                      ? 'Deposit Collection Entry' 
                                      : 'Deposit Pending Request'}
                                  </span>
                                  <span className="font-black text-zinc-150">₹{inv.amount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                                  <span>Date: {new Date(inv.createdAt).toLocaleDateString('en-IN')}</span>
                                  <span className={inv.status === 'PAID' ? 'text-green-400' : 'text-amber-400'}>
                                    {inv.status}
                                  </span>
                                </div>
                                {inv.status === 'PAID' && inv.paymentMode && (
                                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 pt-1 border-t border-zinc-900/60">
                                    Paid via <span className="text-zinc-300">{inv.paymentMode}</span>
                                    {inv.referenceId && ` (Ref: ${inv.referenceId})`}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                        {profile.depositRefundedAt && (
                          <div className="p-3 border border-zinc-900/80 bg-zinc-950/40 rounded-lg flex flex-col gap-1 text-xs">
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-purple-400">Security Deposit Refunded</span>
                              <span className="font-black text-purple-300">₹{(profile.depositRefundedAmount ?? 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                              <span>Date: {new Date(profile.depositRefundedAt).toLocaleDateString('en-IN')}</span>
                              <span className="text-purple-455 text-purple-400">REFUNDED</span>
                            </div>
                            {profile.depositRefundMode && (
                              <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-1 pt-1 border-t border-zinc-900/60">
                                Mode: <span className="text-zinc-300 uppercase">{profile.depositRefundMode}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 3. KYC IDENTITY DOCUMENTS */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Identity Documents (Aadhaar KYC)
                  </h5>
                  {kycDocs ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                      {/* Aadhaar Front */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">Aadhaar Front Side</span>
                        {kycDocs.front && kycDocs.front.startsWith('data:') ? (
                          <div className="relative border border-zinc-800 rounded-lg overflow-hidden h-28 group">
                            <img src={kycDocs.front} alt="Aadhaar Front" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                              <button 
                                onClick={() => setFullscreenImage(kycDocs.front)}
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-700 text-xs font-semibold flex items-center gap-1 select-none"
                              >
                                <ExternalLink className="h-3 w-3" /> Preview
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 border border-zinc-800 bg-zinc-900/10 border-dashed rounded-lg flex items-center justify-center text-[10px] text-zinc-500">
                            No front document preview (Legacy format)
                          </div>
                        )}
                      </div>

                      {/* Aadhaar Back */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block">Aadhaar Back Side</span>
                        {kycDocs.back && kycDocs.back.startsWith('data:') ? (
                          <div className="relative border border-zinc-800 rounded-lg overflow-hidden h-28 group">
                            <img src={kycDocs.back} alt="Aadhaar Back" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                              <button 
                                onClick={() => setFullscreenImage(kycDocs.back)}
                                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-700 text-xs font-semibold flex items-center gap-1 select-none"
                              >
                                <ExternalLink className="h-3 w-3" /> Preview
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-28 border border-zinc-800 bg-zinc-900/10 border-dashed rounded-lg flex items-center justify-center text-[10px] text-zinc-500">
                            No back document preview
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-zinc-900 bg-zinc-950 rounded-xl text-center text-xs text-zinc-500 font-bold uppercase tracking-wider">
                      Identity documents not configured (Quick Added stay).
                    </div>
                  )}
                </div>                {/* 4. FINANCIAL LEDGER */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Financial stay ledger
                  </h5>
                  <div className="space-y-3">
                    {/* 3 Summary Cards */}
                    <div className="grid grid-cols-3 gap-2.5 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs font-semibold">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Total Rent Paid</span>
                        <span className="text-emerald-400 text-sm font-black">₹{totalRentPaid.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Outstanding Rent</span>
                        <span className={`text-sm font-black ${outstandingRent > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                          ₹{outstandingRent.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="space-y-0.5 border-l border-zinc-900 pl-2.5">
                        <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wider">Total Outstanding</span>
                        <span className={`text-sm font-black ${outstandingTotal > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                          ₹{outstandingTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Transaction History Ledger */}
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-none">
                      {invoices.length === 0 ? (
                        <div className="p-4 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
                          No financial transactions recorded.
                        </div>
                      ) : (
                        invoices.map((inv: any) => (
                          <div key={inv.id} className="p-3.5 space-y-2 text-xs border border-zinc-900 bg-zinc-950/40 rounded-xl flex flex-col hover:border-zinc-800 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-zinc-200 block text-xs">
                                  {inv.type === 'SECURITY_DEPOSIT' 
                                    ? (inv.status === 'PAID' ? 'Security Deposit Collected' : 'Security Deposit Pending') 
                                    : 'Rent Invoice'}
                                </span>
                                <span className="text-[9px] text-zinc-500 block font-bold uppercase tracking-wide">
                                  Invoice Date: {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="text-right space-y-0.5">
                                <span className="text-xs font-black text-zinc-150">₹{inv.amount.toLocaleString('en-IN')}</span>
                                <span className={`text-[8px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded block text-center w-fit ml-auto
                                  ${inv.status === 'PAID' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                                    inv.status === 'PAST_DUE' ? 'text-red-400 border-red-500/20 bg-red-500/5' : 
                                    'text-amber-400 border-amber-500/20 bg-amber-500/5'}`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-500 pt-1.5 border-t border-zinc-900/60 font-bold uppercase tracking-wider">
                              <div>
                                <span className="text-zinc-500 block text-[8px]">Due Date</span>
                                <span className="text-zinc-350">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                              {inv.status === 'PAID' && inv.paidAt && (
                                <div className="text-right">
                                  <span className="text-zinc-500 block text-[8px]">Payment Date</span>
                                  <span className="text-zinc-350">{new Date(inv.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                              )}
                            </div>

                            {inv.status === 'PAID' && (inv.paymentMode || inv.razorpayPayId || inv.referenceId) && (
                              <div className="bg-zinc-900/35 border border-zinc-900/80 p-2 rounded-lg text-[9px] text-zinc-500 flex justify-between items-center font-bold tracking-wide">
                                <span>Method: <strong className="text-zinc-300 uppercase">{inv.paymentMode || (inv.razorpayPayId ? 'UPI/ONLINE' : 'N/A')}</strong></span>
                                {(inv.referenceId || inv.razorpayPayId) && (
                                  <span className="font-mono text-[9px] truncate max-w-[170px]" title={inv.referenceId || inv.razorpayPayId}>
                                    Ref: {inv.referenceId || inv.razorpayPayId}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. COMPLAINTS TICKETS */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Complaint Ticket History
                  </h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-900 rounded-xl divide-y divide-zinc-900 bg-zinc-950/20 scrollbar-none">
                    {complaints.length === 0 ? (
                      <div className="p-4 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">No complaint tickets logged.</div>
                    ) : (
                      complaints.map((c: any) => (
                        <div key={c.id} className="p-3 flex justify-between items-center text-xs font-semibold">
                          <div className="space-y-0.5 w-2/3">
                            <span className="text-zinc-200 block truncate">{c.description}</span>
                            <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                              Category: {c.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded
                              ${c.status === 'RESOLVED' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                                c.status === 'ESCALATED' ? 'text-red-400 border-red-500/20 bg-red-500/5' : 
                                'text-amber-400 border-amber-500/20 bg-amber-500/5'}`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Panel */}
              <div className="p-4 bg-zinc-950 flex justify-between items-center gap-3 border-t border-zinc-900">
                {profile.settlementStatus === 'LOCKED' ? (
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl animate-pulse">
                    <Lock className="h-3.5 w-3.5" /> Stay Settlement Locked
                  </div>
                ) : (
                  <Button 
                    onClick={() => {
                      if (confirm("Are you sure you want to permanently lock this stay's settlement status? This action is irreversible and blocks all future financial edits, recoveries, or refunds.")) {
                        lockSettlementMutation.mutate();
                      }
                    }}
                    disabled={lockSettlementMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 border border-red-500/30 text-white uppercase tracking-widest font-black text-[10px] py-2.5 px-4 rounded-xl flex items-center gap-1 select-none cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {lockSettlementMutation.isPending ? 'Locking...' : 'Lock Settlement'}
                  </Button>
                )}
                <Button onClick={closeProfile} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase tracking-widest font-black text-[10px] py-2.5 px-5 rounded-xl cursor-pointer select-none">
                  Close stay ledger
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Fullscreen Document Preview Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors select-none"
            title="Close Preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="w-full max-w-3xl h-[80vh] flex items-center justify-center border border-zinc-800 rounded-2xl overflow-hidden p-2 bg-zinc-950/40">
            <img src={fullscreenImage} alt="KYC Fullscreen" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </>
  );
}
