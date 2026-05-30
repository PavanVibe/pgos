'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useComplaintStore } from '@/store/useComplaintStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IndianRupee, QrCode, Banknote, HelpCircle, CheckCircle, Plus, Trash2, Calendar, FileText, Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface DeductionItem {
  title: string;
  amount: number;
  notes: string;
}

export default function ResolveComplaintSheet() {
  const { isResolveOpen, closeResolveComplaint, selectedComplaintId } = useComplaintStore();
  const { activePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  // Query all active residents for Specific Resident selector dropdown
  const { data: residentsResponse } = useQuery({
    queryKey: ['residents', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/dashboard/deposits/ledger`), // reuse ledger endpoint to get resident details
    enabled: !!activePgId && isResolveOpen,
  });

  const residentsList: any[] = residentsResponse?.data || [];

  // Query details of selected complaint to pre-fill/find room context
  const { data: complaintsResponse } = useQuery({
    queryKey: queryKeys.complaints(activePgId || ''),
    queryFn: () => fetchApi(`/pgs/${activePgId}/complaints`),
    enabled: !!activePgId && !!selectedComplaintId && isResolveOpen,
  });

  const complaints: any[] = complaintsResponse?.data || [];
  const complaint = complaints.find((c: any) => c.id === selectedComplaintId);

  // Form states
  const [responsibility, setResponsibility] = useState<'SPECIFIC_RESIDENT' | 'ENTIRE_ROOM' | 'OWNER'>('SPECIFIC_RESIDENT');
  const [assignedTenantId, setAssignedTenantId] = useState<string>('');
  const [recoveryMethod, setRecoveryMethod] = useState<'DEPOSIT' | 'CASH' | 'UPI'>('DEPOSIT');
  const [deductionItems, setDeductionItems] = useState<DeductionItem[]>([
    { title: 'Repair Charges', amount: 0, notes: '' }
  ]);
  const [amountInput, setAmountInput] = useState<string>('0');
  const [billUrl, setBillUrl] = useState<string>('');
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Success Confirmation state
  const [resolvedData, setResolvedData] = useState<{
    success: boolean;
    amount: number;
    residentName: string;
    responsibility: 'SPECIFIC_RESIDENT' | 'ENTIRE_ROOM' | 'OWNER';
  } | null>(null);

  const handleClose = () => {
    setResolvedData(null);
    closeResolveComplaint();
  };

  // Default dropdown and form values when complaint context is available
  useEffect(() => {
    if (complaint && isResolveOpen) {
      setAssignedTenantId(complaint.pgTenantId || '');
      setResponsibility('SPECIFIC_RESIDENT');
      setRecoveryMethod('DEPOSIT');
      setDeductionItems([{ title: 'Repair Charges', amount: 0, notes: '' }]);
      setAmountInput('0');
      setBillUrl('');
      setResolvedImageUrl('');
      setResolutionNotes('');
      setResolvedData(null);
    }
  }, [complaint, isResolveOpen]);

  const handleAddItem = () => {
    setDeductionItems([...deductionItems, { title: '', amount: 0, notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (deductionItems.length === 1) return;
    setDeductionItems(deductionItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof DeductionItem, value: any) => {
    const updated = [...deductionItems];
    if (field === 'amount') {
      updated[index].amount = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setDeductionItems(updated);
  };

  const totalCost = responsibility === 'OWNER' ? (parseFloat(amountInput) || 0) : deductionItems.reduce((sum, item) => sum + item.amount, 0);

  // Resolve complaint mutation
  const resolveMutation = useMutation({
    mutationFn: () => {
      return fetchApi(`/pgs/${activePgId}/complaints/${selectedComplaintId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          repairCost: totalCost,
          responsibility,
          assignedTenantId: responsibility === 'SPECIFIC_RESIDENT' ? assignedTenantId : undefined,
          billUrl,
          resolvedImageUrl,
          resolutionNotes: resolutionNotes.trim(),
          deductionItems: responsibility !== 'OWNER' ? deductionItems.map(item => ({
            title: item.title.trim(),
            amount: item.amount,
            notes: item.notes.trim()
          })) : [],
          recoveryMethodInput: recoveryMethod
        })
      });
    },
    onSuccess: () => {
      let residentName = 'Resident';
      if (responsibility === 'SPECIFIC_RESIDENT') {
        const resObj = residentsList.find(r => r.id === assignedTenantId);
        residentName = resObj ? resObj.residentName : 'Resident';
      }

      setResolvedData({
        success: true,
        amount: totalCost,
        residentName,
        responsibility
      });

      toast.success('Complaint resolved successfully.');
      
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.complaints(activePgId) });
        queryClient.invalidateQueries({ queryKey: ['deposit-ledger', activePgId] });
        queryClient.invalidateQueries({ queryKey: ['recoveries-ledger', activePgId] });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve complaint.');
    }
  });

  const handleConfirm = () => {
    if (!activePgId || !selectedComplaintId) {
      toast.error('PG context or complaint ID is missing.');
      return;
    }

    if (responsibility === 'SPECIFIC_RESIDENT' && !assignedTenantId) {
      toast.error('Please select a specific resident.');
      return;
    }

    if (totalCost < 0) {
      toast.error('Repair cost cannot be negative.');
      return;
    }

    // Deductions items validations
    if (responsibility !== 'OWNER') {
      const invalidItem = deductionItems.find(item => !item.title.trim() || item.amount <= 0);
      if (invalidItem) {
        toast.error('Every damage deduction item must have a valid title and amount greater than zero.');
        return;
      }
    }

    resolveMutation.mutate();
  };

  const loading = resolveMutation.isPending;

  return (
    <Sheet open={isResolveOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-800 flex flex-col p-6 max-h-[95vh] overflow-y-auto">
        <SheetHeader className="text-left space-y-1.5 pb-4 border-b border-zinc-900">
          <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <CheckCircle className="h-4 w-4" />
            </span>
            Resolve & Log Damage Recovery
          </SheetTitle>
          <SheetDescription className="text-zinc-400 text-xs font-semibold">
            Mark ticket as resolved and allocate repair expenses structurally.
          </SheetDescription>
        </SheetHeader>

        {resolvedData?.success ? (
          <div className="flex-1 py-8 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-zinc-100">Complaint Resolved Successfully</h3>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">
                Outstanding Balance Updated
              </p>
            </div>

            <div className="w-full bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-3.5 text-xs text-left">
              {resolvedData.responsibility === 'ENTIRE_ROOM' ? (
                <p className="text-zinc-300 font-extrabold leading-relaxed text-center py-2 text-[13px]">
                  ₹{resolvedData.amount.toLocaleString('en-IN')} recovery split among room occupants.
                </p>
              ) : (
                <>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="font-bold">Damage Charges Created</span>
                    <span className="text-amber-400 font-black text-sm">₹{resolvedData.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="font-bold">Assigned To</span>
                    <span className="text-zinc-200 font-black">
                      {resolvedData.responsibility === 'SPECIFIC_RESIDENT' 
                        ? resolvedData.residentName 
                        : 'Owner Expense'}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider pt-2 border-t border-zinc-900">
                <span>Status</span>
                <span className="text-green-400 font-black">Money Owed Updated</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 pt-4">
              <Button
                onClick={() => {
                  const searchVal = resolvedData.responsibility === 'SPECIFIC_RESIDENT' ? resolvedData.residentName : '';
                  window.location.href = `/recoveries?search=${encodeURIComponent(searchVal)}`;
                  handleClose();
                }}
                className="w-full bg-primary hover:opacity-90 text-black font-extrabold text-xs uppercase tracking-widest h-11 rounded-xl shadow-lg select-none transition-all flex items-center justify-center gap-1.5"
              >
                {resolvedData.responsibility === 'ENTIRE_ROOM' ? 'View Recoveries' : 'View Recovery'}
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full border-zinc-900 hover:bg-zinc-900/40 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl"
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 py-4 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Assigned Responsibility</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'SPECIFIC_RESIDENT', label: 'Specific Resident' },
                    { id: 'ENTIRE_ROOM', label: 'Entire Room' },
                    { id: 'OWNER', label: 'Owner Expense' }
                  ].map((opt) => {
                    const isSelected = responsibility === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setResponsibility(opt.id as any)}
                        disabled={loading}
                        className={`py-2 rounded-lg border text-[10px] font-bold uppercase transition-all duration-200 cursor-pointer select-none text-center
                          ${isSelected 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {responsibility === 'SPECIFIC_RESIDENT' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Select Target Resident</label>
                  <div className="relative">
                    <select
                      value={assignedTenantId}
                      onChange={(e) => setAssignedTenantId(e.target.value)}
                      disabled={loading}
                      className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-10 px-3 rounded-xl focus:outline-none appearance-none"
                    >
                      <option value="">-- Choose Resident --</option>
                      {residentsList
                        .filter(res => res.tenantStatus !== 'PAST' || res.status === 'COLLECTED')
                        .map((res: any) => (
                          <option key={res.id} value={res.id} className="bg-zinc-950 text-white">
                            {res.residentName} (Room {res.roomNumber}, Bed {res.bedNumber})
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {responsibility !== 'OWNER' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Itemized Damage Breakdown</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={loading}
                      className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase text-green-400 hover:text-green-300"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
                    {deductionItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-zinc-950 p-2.5 border border-zinc-900 rounded-xl relative animate-fadeIn">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Fan Replacement..."
                              value={item.title}
                              onChange={(e) => handleUpdateItem(index, 'title', e.target.value)}
                              disabled={loading}
                              className="bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-9 rounded-lg"
                            />
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="Cost..."
                                value={item.amount || ''}
                                onChange={(e) => handleUpdateItem(index, 'amount', e.target.value)}
                                disabled={loading}
                                className="pl-6 bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-9 rounded-lg"
                              />
                              <IndianRupee className="h-3 w-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                          <Input
                            placeholder="Item description or item notes (optional)..."
                            value={item.notes}
                            onChange={(e) => handleUpdateItem(index, 'notes', e.target.value)}
                            disabled={loading}
                            className="bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-[10px] h-8 rounded-lg"
                          />
                        </div>
                        {deductionItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={loading}
                            className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {responsibility === 'OWNER' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Total Repair Cost</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="Enter flat cost..."
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      disabled={loading}
                      className="pl-7 bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-10 rounded-xl"
                    />
                    <IndianRupee className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {responsibility !== 'OWNER' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Recovery Method</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'DEPOSIT', label: 'Deduct Deposit', icon: Banknote },
                      { id: 'CASH', label: 'Collect Cash', icon: Banknote },
                      { id: 'UPI', label: 'Collect UPI', icon: QrCode }
                    ].map((opt) => {
                      const isSelected = recoveryMethod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setRecoveryMethod(opt.id as any)}
                          disabled={loading}
                          className={`py-2 rounded-lg border text-[9px] font-bold uppercase transition-all duration-200 cursor-pointer select-none text-center flex flex-col items-center justify-center gap-1
                            ${isSelected 
                              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                              : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800'}`}
                        >
                          <opt.icon className="h-3.5 w-3.5 shrink-0" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Receipt URL
                  </label>
                  <Input
                    placeholder="Link bill receipt..."
                    value={billUrl}
                    onChange={(e) => setBillUrl(e.target.value)}
                    disabled={loading}
                    className="bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block flex items-center gap-1">
                    <Camera className="h-3 w-3" /> Resolved Photo
                  </label>
                  <Input
                    placeholder="Link repair photo..."
                    value={resolvedImageUrl}
                    onChange={(e) => setResolvedImageUrl(e.target.value)}
                    disabled={loading}
                    className="bg-zinc-950 border-zinc-900 focus:border-zinc-800 text-xs font-semibold h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">Resolution Notes</label>
                <textarea
                  placeholder="Record repairs notes or resolution details permanent audit trails..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  disabled={loading}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-xs font-semibold placeholder-zinc-700 rounded-xl focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2">
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider h-11 rounded-xl shadow-lg select-none transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                {loading ? 'Resolving...' : 'Resolve Complaint'}
              </Button>
              <Button
                variant="outline"
                onClick={closeResolveComplaint}
                disabled={loading}
                className="w-full border-zinc-900 hover:bg-zinc-900/40 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Chevron selector context helper
function ChevronDown(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
