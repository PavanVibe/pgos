'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useRentStore } from '@/store/useRentStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IndianRupee, QrCode, Banknote, HelpCircle, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

export default function MarkPaidSheet() {
  const { 
    isMarkPaidOpen, 
    closeMarkPaid, 
    selectedTenantId,
    selectedTenantDues,
    selectedTenantName,
    selectedTenantRoom,
    selectedInvoiceId,
    selectedTenantBed,
    selectedInvoiceDueDate
  } = useRentStore();
  
  const { activePgId } = useOrganizationStore();
  const [method, setMethod] = useState<'upi' | 'cash'>('upi');
  const [amountInput, setAmountInput] = useState<string>('');
  const queryClient = useQueryClient();

  // Initialize amountInput to the full dues whenever the sheet opens
  useEffect(() => {
    if (isMarkPaidOpen && selectedTenantDues !== null) {
      setAmountInput(selectedTenantDues.toString());
    } else {
      setAmountInput('');
    }
  }, [isMarkPaidOpen, selectedTenantDues]);

  // Safeguards: Close and warn if opened without proper context
  useEffect(() => {
    if (isMarkPaidOpen) {
      if (!selectedInvoiceId) {
        toast.error('Payment flow aborted: Missing valid invoice context.');
        closeMarkPaid();
        return;
      }
      if (selectedTenantDues === null || selectedTenantDues === undefined) {
        toast.error('Payment flow aborted: Outstanding dues amount is missing.');
        closeMarkPaid();
        return;
      }
    }
  }, [isMarkPaidOpen, selectedInvoiceId, selectedTenantDues, closeMarkPaid]);

  const parsedAmount = parseFloat(amountInput) || 0;
  const originalDues = selectedTenantDues || 0;
  const isPartial = parsedAmount < originalDues && parsedAmount > 0;
  const remainingDues = Math.max(0, originalDues - parsedAmount);

  // 1. Rent payment mutation (safely supports partial or full amount)
  const payMutation = useMutation({
    mutationFn: () => 
      fetchApi(`/pgs/${activePgId}/tenants/${selectedTenantId}/pay-rent`, {
        method: 'POST',
        body: JSON.stringify({ 
          method,
          amount: parsedAmount,
          invoiceId: selectedInvoiceId
        })
      }),
    onSuccess: () => {
      toast.success('Payment recorded successfully', {
        description: `₹${parsedAmount.toLocaleString('en-IN')} settled via ${method.toUpperCase()}`
      });
      
      // Perform targeted refreshes & broad invalidations to sync all widgets instantly
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.occupancy(activePgId) });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overdue-residents', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['invoices', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['residents', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['room-history', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['pg-rooms', activePgId] });
      }

      closeMarkPaid();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to settle rent payment.');
    }
  });

  const handleConfirm = () => {
    if (!activePgId || !selectedTenantId || !selectedInvoiceId) {
      toast.error('PG context, resident ID, or invoice ID is missing.');
      return;
    }

    if (parsedAmount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    if (parsedAmount > originalDues) {
      toast.error(`Payment amount cannot exceed total dues of ₹${originalDues.toLocaleString('en-IN')}.`);
      return;
    }

    payMutation.mutate();
  };

  const loading = payMutation.isPending;

  return (
    <Sheet open={isMarkPaidOpen} onOpenChange={(open) => !open && closeMarkPaid()}>
      <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-800 flex flex-col p-6 max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <div className="space-y-0.5">
            <SheetTitle className="text-xl font-black text-zinc-100">Log Rent Payment</SheetTitle>
            <SheetDescription className="text-zinc-500 text-xs font-medium">
              Record payment transaction details securely.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Detailed Tenant Context Block */}
          <div className="bg-zinc-950 border border-zinc-900/80 p-4 rounded-xl space-y-3 shadow-sm select-none">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Resident</span>
                <span className="text-base font-black text-zinc-100 block mt-0.5">{selectedTenantName || 'N/A'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Location</span>
                <span className="text-xs font-extrabold text-zinc-350 block mt-0.5">
                  Room {selectedTenantRoom || 'N/A'} — Bed {selectedTenantBed || 'N/A'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-zinc-900/80">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Rent Due</span>
                <span className="text-base font-black text-emerald-400 block mt-0.5">
                  ₹{originalDues.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Due Date</span>
                <span className="text-xs font-extrabold text-zinc-350 block mt-1.5">
                  {selectedInvoiceDueDate 
                    ? new Date(selectedInvoiceDueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      }) 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Outstanding Balance Context */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Outstanding dues</span>
              <span className="text-sm font-black text-zinc-350 flex items-center text-zinc-350 mt-0.5">
                ₹{originalDues.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Settlement mode</span>
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded border mt-0.5 block
                ${isPartial 
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}
              >
                {isPartial ? 'Partial Settlement' : 'Full Settlement'}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Amount Received (₹)</label>
              {isPartial && (
                <button 
                  onClick={() => setAmountInput(originalDues.toString())}
                  className="text-[11px] text-primary hover:text-primary-light font-bold"
                >
                  Pay Full Amount
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
                max={originalDues}
                min={1}
                disabled={loading}
              />
            </div>
            {isPartial && (
              <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                Remaining outstanding dues of <strong className="text-zinc-300">₹{remainingDues.toLocaleString('en-IN')}</strong> will remain active in child ledger.
              </p>
            )}
            {!isPartial && parsedAmount > 0 && (
              <p className="text-[11px] text-green-400 font-semibold flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                This will fully settle the tenant's outstanding rent dues.
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('upi')}
                disabled={loading}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                  ${method === 'upi' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-800 bg-zinc-950/20 text-zinc-400'}`}
              >
                <QrCode className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-wide">UPI / Online</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('cash')}
                disabled={loading}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                  ${method === 'cash' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-900 hover:border-zinc-800 bg-zinc-950/20 text-zinc-400'}`}
              >
                <Banknote className="h-4 w-4" />
                <span className="text-xs font-extrabold uppercase tracking-wide">Cash</span>
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <Button 
            className="w-full h-11 text-xs font-black uppercase tracking-widest mt-2" 
            onClick={handleConfirm}
            disabled={loading || parsedAmount <= 0 || parsedAmount > originalDues || !selectedInvoiceId}
          >
            {loading ? 'Processing Settle...' : `Confirm Settle of ₹${parsedAmount.toLocaleString('en-IN')} via ${method.toUpperCase()}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
