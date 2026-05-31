'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useVacateStore } from '@/store/useVacateStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, User, DollarSign, Building, Search, ArrowRight, ShieldCheck, Wallet, ShieldAlert, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface ResidentOption {
  id: string;
  name: string;
  roomNumber: string;
  bedNumber: string;
  securityDeposit: number;
}

export default function VacateResidentSheet({ pgId }: { pgId: string }) {
  const { isVacateOpen, closeVacate, selectedTenantId } = useVacateStore();
  const [localTenantId, setLocalTenantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  // Settlement Bypasses & totals tracking
  const [isOutstandingBypassed, setIsOutstandingBypassed] = useState(false);
  const [settledCollectedTotal, setSettledCollectedTotal] = useState(0);
  const [settledRefundedTotal, setSettledRefundedTotal] = useState(0);

  // 1. Fetch live rooms and occupants to extract all active residents
  const { data: roomsResponse } = useQuery({
    queryKey: ['pg-rooms', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/rooms`),
    enabled: !!pgId && isVacateOpen,
  });

  // Extract active residents from rooms list
  const activeResidents: ResidentOption[] = [];
  if (roomsResponse?.data) {
    roomsResponse.data.forEach((room: any) => {
      room.beds.forEach((bed: any) => {
        if (bed.tenantProfile && (bed.tenantProfile.status === 'ACTIVE' || bed.tenantProfile.status === 'NOTICE' || bed.tenantProfile.status === 'INCOMPLETE')) {
          activeResidents.push({
            id: bed.tenantProfile.id,
            name: bed.tenantProfile.globalTenant?.name || 'Active Resident',
            roomNumber: room.number,
            bedNumber: bed.bedNumber,
            securityDeposit: bed.tenantProfile.securityDeposit || bed.tenantProfile.monthlyRent * 2 || bed.monthlyRent * 2 || 6000,
          });
        }
      });
    });
  }

  // 2. Fetch complete stay profile details for financial settlement
  const { data: tenantProfileResponse, isLoading: profileLoading } = useQuery({
    queryKey: ['residents', 'profile', localTenantId],
    queryFn: () => fetchApi(`/tenants/profiles/${localTenantId}`),
    enabled: !!localTenantId && isVacateOpen && !isSearchActive,
  });

  // 3. Synchronize selected tenant ID and modes from store
  useEffect(() => {
    if (isVacateOpen) {
      setIsOutstandingBypassed(false);
      setSettledCollectedTotal(0);
      setSettledRefundedTotal(0);
      if (selectedTenantId) {
        setLocalTenantId(selectedTenantId);
        setIsSearchActive(false); // Display card immediately
      } else {
        setLocalTenantId(null);
        setIsSearchActive(true); // Search mode by default
      }
    } else {
      setLocalTenantId(null);
      setSearchQuery('');
      setIsSearchActive(true);
      setIsDropdownOpen(false);
      setIsOutstandingBypassed(false);
      setSettledCollectedTotal(0);
      setSettledRefundedTotal(0);
    }
  }, [selectedTenantId, isVacateOpen]);

  // Filter residents live as they type
  const filteredResidents = activeResidents.filter((res) => {
    const term = searchQuery.toLowerCase();
    return (
      res.name.toLowerCase().includes(term) ||
      res.roomNumber.toLowerCase().includes(term) ||
      res.bedNumber.toLowerCase().includes(term)
    );
  });

  const selectResident = (id: string) => {
    setLocalTenantId(id);
    setIsSearchActive(false); // Collapse search view, show display card
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Find currently active resident details
  const activeResident = activeResidents.find(r => r.id === localTenantId);

  // Financial Settlement Calculations
  const profile = tenantProfileResponse?.data;
  const expectedDeposit = profile ? profile.securityDeposit : (activeResident ? activeResident.securityDeposit : 0);

  const collectedDeposit = profile && profile.invoices
    ? profile.invoices
        .filter((inv: any) => inv.type === 'SECURITY_DEPOSIT' && inv.status === 'PAID')
        .reduce((sum: number, inv: any) => sum + inv.amount, 0)
    : 0;

  const outstandingRent = profile && profile.invoices
    ? profile.invoices
        .filter((inv: any) => inv.type === 'RENT' && inv.status !== 'PAID')
        .reduce((sum: number, inv: any) => sum + inv.amount, 0)
    : 0;

  const outstandingUtilities = profile && profile.invoices
    ? profile.invoices
        .filter((inv: any) => (inv.type === 'UTILITY' || inv.type === 'UTILITIES') && inv.status !== 'PAID')
        .reduce((sum: number, inv: any) => sum + inv.amount, 0)
    : 0;

  const outstandingDamage = profile && profile.damageRecoveries
    ? profile.damageRecoveries
        .filter((rec: any) => rec.status !== 'FULLY_RECOVERED' && rec.status !== 'WAIVED')
        .reduce((sum: number, rec: any) => sum + rec.outstandingAmount, 0)
    : 0;

  const outstandingDepositObligations = Math.max(0, expectedDeposit - collectedDeposit);
  const totalReceivables = outstandingRent + outstandingDepositObligations + outstandingDamage;

  const totalDeductions = outstandingRent + outstandingUtilities + outstandingDamage;

  const refundableDeposit = Math.max(0, collectedDeposit - totalDeductions);
  const remainingLiability = refundableDeposit === 0 ? Math.abs(collectedDeposit - totalDeductions) : 0;

  const depositRefunded = profile?.depositRefundedAmount || 0;
  const remainingRefundableDeposit = Math.max(0, collectedDeposit - depositRefunded);
  const remainingRefundableAfterDeductions = Math.max(0, refundableDeposit - depositRefunded);

  const netSettlement = totalReceivables - remainingRefundableDeposit;
  const isSettlementLocked = Math.abs(netSettlement) > 0.01;

  console.log('[DIAGNOSTIC] Move-Out Settlement Dues Check:', {
    rentDue: outstandingRent,
    depositDue: outstandingDepositObligations,
    damageRecoveries: outstandingDamage,
    refundableDeposit: remainingRefundableDeposit,
    netSettlement: netSettlement,
    isSettlementLocked: isSettlementLocked
  });

  // Settle Move-Out Dues & Refunds Mutation
  const settleMutation = useMutation({
    mutationFn: (payload: { action: 'COLLECT' | 'REFUND' | 'WAIVE', amount: number, paymentMode: string }) =>
      fetchApi(`/tenants/pgs/${pgId}/tenants/${localTenantId}/settle-moveout`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: (res: any, variables) => {
      toast.success('Settlement transaction processed successfully.');
      if (variables.action === 'COLLECT') {
        setSettledCollectedTotal(prev => prev + variables.amount);
      } else if (variables.action === 'REFUND') {
        setSettledRefundedTotal(prev => prev + variables.amount);
      } else if (variables.action === 'WAIVE') {
        setSettledCollectedTotal(prev => prev + variables.amount);
      }
      queryClient.invalidateQueries({ queryKey: ['residents', 'profile', localTenantId] });
      queryClient.refetchQueries({ queryKey: ['residents', 'profile', localTenantId] });
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', pgId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(pgId) });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process settlement.');
    }
  });

  const handleSettleAction = (action: 'COLLECT' | 'REFUND' | 'WAIVE', amount: number, paymentMode: string) => {
    if (!pgId || !localTenantId) {
      toast.error('PG context or resident ID is missing.');
      return;
    }
    settleMutation.mutate({ action, amount, paymentMode });
  };

  // 4. Vacate Resident Mutation (targeted cache patching)
  const vacateMutation = useMutation({
    mutationFn: () => 
      fetchApi(`/tenants/pgs/${pgId}/tenants/${localTenantId}/vacate`, {
        method: 'POST',
        body: JSON.stringify({ deduction: totalDeductions })
      }),
    onSuccess: async () => {
      toast.success('Resident vacated successfully. Bed is now vacant!');
      
      // Perform targeted refreshes and wait for the room occupancy to finish refetching
      if (pgId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(pgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.occupancy(pgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(pgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(pgId) }),
          queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', pgId] }),
          queryClient.invalidateQueries({ queryKey: ['recoveries-dashboard', pgId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.residents(pgId) }),
          queryClient.refetchQueries({ queryKey: ['pg-rooms', pgId] }),
        ]);
        toast.info('Occupancy map and finance records refreshed.');
      }

      setSearchQuery('');
      setIsSearchActive(true);
      closeVacate();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to vacate resident.');
    }
  });

  const handleConfirm = () => {
    if (!pgId || !localTenantId) {
      toast.error('PG context or resident ID is missing.');
      return;
    }
    vacateMutation.mutate();
  };

  const loading = vacateMutation.isPending || profileLoading;
  const showResults = isSearchActive && isDropdownOpen && searchQuery.trim() !== '';

  return (
    <Sheet open={isVacateOpen} onOpenChange={(open) => !open && closeVacate()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-black text-white border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-red-500 flex items-center gap-2 text-xl font-bold">
            <LogOut className="h-5 w-5" /> Vacate Resident
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Process resident move-out, free their bed, and calculate final security deposit settlement automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Empty Placeholder State (No Active Residents in PG) */}
          {activeResidents.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-4 bg-zinc-950/20 text-center">
              <Building className="h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-zinc-400 text-sm font-semibold">No active residents</p>
              <p className="text-zinc-500 text-xs mt-1">There are currently no active residents in this PG to vacate.</p>
              <Button variant="outline" className="mt-4 border-zinc-850" onClick={closeVacate}>
                Close Drawer
              </Button>
            </div>
          )}

          {activeResidents.length > 0 && (
            <>
              {/* SEARCH MODE */}
              {isSearchActive ? (
                <div className="space-y-3 relative">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-zinc-400" /> Search Resident
                  </label>
                  
                  {/* Live Search Input */}
                  <div className="relative">
                    <Input
                      placeholder="Type name, room, or bed (e.g. 101, B2)..."
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        setIsDropdownOpen(val.trim() !== '');
                      }}
                      onFocus={() => {
                        if (searchQuery.trim() !== '') {
                          setIsDropdownOpen(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      className="bg-zinc-950 border-zinc-800 text-white pl-9 h-10 text-sm focus:border-zinc-700 w-full"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  </div>

                  {/* Autocomplete Combobox list */}
                  {showResults && (
                    <div className="absolute top-[72px] left-0 w-full border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950 shadow-2xl z-50">
                      <div className="max-h-52 overflow-y-auto divide-y divide-zinc-900 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        {filteredResidents.length > 0 ? (
                          filteredResidents.map((res) => {
                            const isSelected = res.id === localTenantId;
                            return (
                              <button
                                key={res.id}
                                type="button"
                                onPointerDown={() => selectResident(res.id)}
                                className={`w-full text-left p-3 flex justify-between items-center transition-all cursor-pointer hover:bg-zinc-900/60
                                  ${isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-white">{res.name}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5">
                                    Room {res.roomNumber} — Bed {res.bedNumber}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold px-2 py-1 rounded bg-zinc-900 text-zinc-350 border border-zinc-850">
                                    ₹{res.securityDeposit}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-zinc-500">
                            No matching active residents found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* DISPLAY MODE (Selected Resident Card) */
                activeResident ? (
                  <div className="space-y-1 bg-zinc-900/35 border border-zinc-800/80 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Selected Resident</span>
                      <p className="text-lg font-bold text-white mt-0.5">{activeResident.name}</p>
                      <p className="text-xs text-zinc-400">Room {activeResident.roomNumber} — Bed {activeResident.bedNumber}</p>
                    </div>
                    {!selectedTenantId && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white font-semibold text-xs h-8 px-3 transition-colors"
                        onClick={() => {
                          setIsSearchActive(true);
                          setSearchQuery('');
                          setIsDropdownOpen(false);
                        }}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-900/10 border border-dashed border-zinc-850 rounded-xl text-center text-xs text-zinc-500">
                    Resolving resident profile details...
                  </div>
                )
              )}

              {/* Financial Calculation Panel (Loaded via React Query) */}
              {localTenantId && activeResident && !isSearchActive && (
                <>
                  {profileLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 bg-zinc-950/20 rounded-xl text-zinc-500 text-xs animate-pulse">
                      Calculating financial vacate dues...
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Step 1: Financial Settlement Summary */}
                      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                          <Building className="h-3.5 w-3.5 text-zinc-500" /> Resident Financial Settlement
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Amount Resident Owes PG */}
                          <div className="space-y-2 border-r border-zinc-900 pr-2">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Amount Resident Owes PG</span>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">Rent Due</span>
                              <span className="font-semibold text-zinc-200">₹{outstandingRent.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">Deposit Due</span>
                              <span className="font-semibold text-zinc-200">₹{outstandingDepositObligations.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">Damage Recoveries</span>
                              <span className="font-semibold text-zinc-200">₹{outstandingDamage.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-1.5 border-t border-zinc-900/60 font-bold">
                              <span className="text-zinc-300">Receivable</span>
                              <span className="text-amber-400">₹{totalReceivables.toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          {/* Amount PG Owes Resident */}
                          <div className="space-y-2 pl-2">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Amount PG Owes Resident</span>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-400">Refundable Deposit</span>
                              <span className="font-semibold text-zinc-200">₹{remainingRefundableAfterDeductions.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-zinc-500 text-[10px] leading-normal pt-1.5 border-t border-zinc-900/60">
                              <span>(after damage deductions)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Settlement Calculation & Net Settlement */}
                      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                          <DollarSign className="h-3.5 w-3.5 text-zinc-500" /> Settlement Calculation
                        </h4>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center text-zinc-400">
                            <span>Resident Owes PG (Receivables)</span>
                            <span className="font-semibold">₹{totalReceivables.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-center text-zinc-400">
                            <span>PG Owes Resident (Refundable)</span>
                            <span className="font-semibold">₹{remainingRefundableDeposit.toLocaleString('en-IN')}</span>
                          </div>

                          {/* Net Settlement display */}
                          {totalReceivables > remainingRefundableDeposit && (
                            <div className="flex justify-between items-center font-bold text-sm pt-2.5 border-t border-zinc-900">
                              <span className="text-red-400 flex items-center gap-1">
                                <ShieldAlert className="h-4 w-4 text-red-500" /> Net Due To PG
                              </span>
                              <span className="text-lg font-black text-red-400 animate-pulse">
                                ₹{(totalReceivables - remainingRefundableDeposit).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}

                          {remainingRefundableDeposit > totalReceivables && (
                            <div className="flex justify-between items-center font-bold text-sm pt-2.5 border-t border-zinc-900">
                              <span className="text-green-400 flex items-center gap-1">
                                <Sparkles className="h-4 w-4 text-green-400" /> Net Refund To Resident
                              </span>
                              <span className="text-lg font-black text-green-400 animate-pulse">
                                ₹{(remainingRefundableDeposit - totalReceivables).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}

                          {totalReceivables === remainingRefundableDeposit && totalReceivables > 0 && (
                            <div className="flex justify-between items-center font-bold text-sm pt-2.5 border-t border-zinc-900 text-zinc-300">
                              <span>Net Settlement Dues</span>
                              <span className="text-lg font-black">₹0</span>
                            </div>
                          )}
                        </div>

                        {/* Step 3: Settlement Actions */}
                        {settleMutation.isPending ? (
                          <div className="py-4 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span>Processing settlement transaction...</span>
                          </div>
                        ) : (
                          <>
                            {/* Option A: Resident owes PG */}
                            {totalReceivables > remainingRefundableDeposit && !isOutstandingBypassed && (
                              <div className="space-y-2 pt-2 border-t border-dashed border-zinc-900">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Dues Collection Actions</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleSettleAction('COLLECT', totalReceivables - remainingRefundableDeposit, 'cash')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Collect Cash
                                  </button>
                                  <button
                                    onClick={() => handleSettleAction('COLLECT', totalReceivables - remainingRefundableDeposit, 'upi')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Collect UPI
                                  </button>
                                  <button
                                    onClick={() => handleSettleAction('COLLECT', totalReceivables - remainingRefundableDeposit, 'bank_transfer')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Collect Transfer
                                  </button>
                                  <button
                                    onClick={() => handleSettleAction('WAIVE', totalReceivables - remainingRefundableDeposit, 'cash')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-red-950 text-red-400 hover:bg-red-500/5 text-[10px] font-extrabold uppercase cursor-pointer select-none"
                                  >
                                    Waive Dues
                                  </button>
                                </div>

                                <div className="pt-2 border-t border-zinc-900 text-center">
                                  <button
                                    onClick={() => {
                                      setIsOutstandingBypassed(true);
                                      toast.info('Outstanding dues bypassed as active recovery.');
                                    }}
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider underline"
                                  >
                                    Mark as Outstanding Recovery
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Option B: PG owes Resident */}
                            {remainingRefundableDeposit > totalReceivables && (
                              <div className="space-y-2 pt-2 border-t border-dashed border-zinc-900">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Refund Processing Actions</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    onClick={() => handleSettleAction('REFUND', remainingRefundableDeposit - totalReceivables, 'cash')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Refund Cash
                                  </button>
                                  <button
                                    onClick={() => handleSettleAction('REFUND', remainingRefundableDeposit - totalReceivables, 'upi')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Refund UPI
                                  </button>
                                  <button
                                    onClick={() => handleSettleAction('REFUND', remainingRefundableDeposit - totalReceivables, 'bank_transfer')}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-extrabold uppercase hover:border-primary hover:text-white cursor-pointer select-none"
                                  >
                                    Refund Transfer
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Step 5: Final Confirmation block */}
                      {(!isSettlementLocked || isOutstandingBypassed) && (
                        <div className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 p-4 rounded-xl space-y-2 select-none animate-in fade-in zoom-in duration-300">
                          <div className="flex items-center gap-2 font-black text-sm">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">✓</span>
                            Financial Settlement Completed
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 pt-1">
                            <div>
                              <span className="block text-zinc-550 text-[9px]">Collected</span>
                              <span className="text-zinc-200">₹{settledCollectedTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="border-l border-zinc-900 pl-2">
                              <span className="block text-zinc-550 text-[9px]">Refunded</span>
                              <span className="text-zinc-200">₹{settledRefundedTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="border-l border-zinc-900 pl-2">
                              <span className="block text-zinc-550 text-[9px]">Outstanding</span>
                              <span className="text-zinc-200">₹0</span>
                            </div>
                          </div>
                          {isOutstandingBypassed && (
                            <p className="text-[10px] text-zinc-500 italic mt-1 leading-normal">
                              Dues bypassed and marked as active recoveries for historical ledger.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Settlement Action lock warnings */}
                      {isSettlementLocked && !isOutstandingBypassed && (
                        <div className="bg-amber-500/5 text-amber-500 border border-amber-500/20 p-4 rounded-xl text-xs leading-relaxed font-semibold">
                          <strong>Settlement Locked:</strong> Please settle all financial dues or refunds above, or mark remaining dues outstanding before vacating.
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-4 flex gap-2">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="w-1/2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white font-semibold h-11 transition-all" 
                          onClick={() => closeVacate()} 
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-1/2 h-11 font-semibold cursor-pointer" 
                          onClick={handleConfirm} 
                          disabled={loading || (isSettlementLocked && !isOutstandingBypassed)}
                        >
                          {loading ? 'Processing...' : 'Confirm Vacate'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Informational State if in Search Mode */}
              {isSearchActive && localTenantId && activeResident && (
                <div className="bg-zinc-900/10 border border-dashed border-zinc-800 p-4 rounded-xl text-center">
                  <p className="text-sm text-zinc-400">Click on a resident in search or close selection to configure move-out details.</p>
                  <Button 
                    type="button"
                    variant="outline" 
                    className="mt-3 border-zinc-850 h-8 text-xs font-semibold"
                    onClick={() => setIsSearchActive(false)}
                  >
                    Keep Current Selection
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
