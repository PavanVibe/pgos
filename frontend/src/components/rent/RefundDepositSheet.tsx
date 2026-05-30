'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useRefundStore } from '@/store/useRefundStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IndianRupee, QrCode, Banknote, HelpCircle, CheckCircle, Calendar, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { toast } from 'sonner';

export default function RefundDepositSheet() {
  const { 
    isRefundOpen, 
    closeRefund, 
    selectedTenantId,
    selectedTenantName,
    selectedTenantRoom,
    selectedTenantBed,
    selectedDepositAmount,
    selectedRefundedAmount
  } = useRefundStore();
  
  const { activePgId } = useOrganizationStore();
  const [method, setMethod] = useState<'upi' | 'cash' | 'bank_transfer'>('upi');
  const [amountInput, setAmountInput] = useState<string>('');
  const [refundDate, setRefundDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const queryClient = useQueryClient();

  // Initialize form whenever the sheet opens
  useEffect(() => {
    if (isRefundOpen) {
      const remainingDeposit = Math.max(0, (selectedDepositAmount || 0) - (selectedRefundedAmount || 0));
      setAmountInput(remainingDeposit.toString());
      
      // Default to current local date in YYYY-MM-DD format
      const today = new Date();
      const localDate = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      setRefundDate(localDate);
      setNotes('');
    } else {
      setAmountInput('');
      setRefundDate('');
      setNotes('');
    }
  }, [isRefundOpen, selectedDepositAmount, selectedRefundedAmount]);

  const parsedRefundAmount = parseFloat(amountInput) || 0;
  const collectedDeposit = selectedDepositAmount || 0;
  const deductionAmount = Math.max(0, collectedDeposit - parsedRefundAmount);

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: () => {
      return fetchApi(`/pgs/${activePgId}/tenants/${selectedTenantId}/refund-deposit`, {
        method: 'POST',
        body: JSON.stringify({ 
          refundAmount: parsedRefundAmount,
          paymentMode: method,
          refundDate: refundDate ? new Date(refundDate).toISOString() : new Date().toISOString(),
          notes: notes.trim()
        })
      });
    },
    onSuccess: () => {
      toast.success('Refund processed successfully', {
        description: `₹${parsedRefundAmount.toLocaleString('en-IN')} refunded via ${method.toUpperCase()} with ₹${deductionAmount.toLocaleString('en-IN')} damage deduction.`
      });
      
      // Targeted queries invalidations
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['residents', 'profile', selectedTenantId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overdue-residents', activePgId] });
      }

      closeRefund();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process deposit refund.');
    }
  });

  const handleConfirm = () => {
    if (!activePgId || !selectedTenantId) {
      toast.error('PG context or resident ID is missing.');
      return;
    }

    if (amountInput === '') {
      toast.error('Refund amount is required.');
      return;
    }

    if (parsedRefundAmount < 0) {
      toast.error('Refund amount cannot be negative.');
      return;
    }

    if (parsedRefundAmount > collectedDeposit) {
      toast.error(`Refund amount cannot exceed total collected deposit of ₹${collectedDeposit.toLocaleString('en-IN')}.`);
      return;
    }

    refundMutation.mutate();
  };

  const loading = refundMutation.isPending;

  return (
    <Sheet open={isRefundOpen} onOpenChange={(open) => !open && closeRefund()}>
      <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-800 flex flex-col p-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left space-y-1.5 pb-4 border-b border-zinc-900">
          <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <IndianRupee className="h-4 w-4" />
            </span>
            Process Deposit Refund
          </SheetTitle>
          <SheetDescription className="text-zinc-400 text-xs font-semibold">
            Refund deposit for <span className="text-zinc-200 font-bold">{selectedTenantName}</span> (Room {selectedTenantRoom}, Bed {selectedTenantBed})
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-4 space-y-5">
          {/* Financial Breakdown Panel */}
          <div className="bg-zinc-950 border border-zinc-900/60 p-4 rounded-xl space-y-2 text-xs font-semibold">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Deposits Collected</span>
              <span className="text-zinc-200">₹{collectedDeposit.toLocaleString('en-IN')}</span>
            </div>
            
            {selectedRefundedAmount && selectedRefundedAmount > 0 ? (
              <div className="flex justify-between items-center text-zinc-400">
                <span>Previously Refunded</span>
                <span className="text-zinc-200">₹{selectedRefundedAmount.toLocaleString('en-IN')}</span>
              </div>
            ) : null}

            <div className="flex justify-between items-center pt-2 border-t border-zinc-900 font-bold text-zinc-400">
              <span>Live Damage Deduction</span>
              <span className={deductionAmount > 0 ? 'text-red-400 font-black' : 'text-zinc-500'}>
                ₹{deductionAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Refund Amount Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Refund Amount (₹)</label>
            <div className="relative">
              <Input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={loading}
                placeholder="Enter amount to refund..."
                className="pl-8 bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-sm font-black placeholder-zinc-700 h-10 rounded-xl"
              />
              <IndianRupee className="h-4 w-4 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-[10px] text-zinc-500 block leading-normal">
              Entering less than ₹{collectedDeposit.toLocaleString('en-IN')} automatically records the difference as a damage deduction.
            </span>
          </div>

          {/* Payment Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Refund Payment Mode</label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'upi', label: 'UPI', icon: QrCode },
                { id: 'bank_transfer', label: 'Bank Transfer', icon: HelpCircle },
                { id: 'cash', label: 'Cash', icon: Banknote }
              ].map((opt) => {
                const IconComp = opt.icon;
                const isSelected = method === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setMethod(opt.id as any)}
                    disabled={loading}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all duration-200 select-none cursor-pointer
                      ${isSelected 
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-md shadow-purple-950/20' 
                        : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'}`}
                  >
                    <IconComp className={`h-4 w-4 mb-1 transition-transform duration-200 ${isSelected ? 'scale-110 text-purple-400' : 'text-zinc-500'}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Refund Date Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Refund Date</label>
            <div className="relative">
              <Input
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
                disabled={loading}
                className="pl-8 bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-sm font-semibold h-10 rounded-xl appearance-none"
              />
              <Calendar className="h-4 w-4 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Deduction / Settlement Notes</label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                placeholder="Explain any damage deductions or note adjustments..."
                rows={2}
                className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-sm font-medium placeholder-zinc-700 rounded-xl focus:outline-none focus:ring-0 transition-all resize-none"
              />
              <FileText className="h-4 w-4 text-zinc-600 absolute left-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2">
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider h-11 rounded-xl shadow-lg shadow-purple-950/20 select-none transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="h-4 w-4" />
            {loading ? 'Processing...' : 'Confirm Refund'}
          </Button>
          <Button
            variant="outline"
            onClick={closeRefund}
            disabled={loading}
            className="w-full border-zinc-900 hover:bg-zinc-900/40 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
