'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useRentStore } from '@/store/useRentStore';
import { fetchApi } from '@/lib/api';
import { useState } from 'react';
import { 
  AlertCircle, 
  Send, 
  Clock, 
  DollarSign, 
  X, 
  CheckCircle2, 
  Building,
  MessageSquare,
  IndianRupee,
  Pencil,
  Check,
  Calendar,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';

interface OverdueResident {
  id: string;
  tenantProfileId: string;
  tenantName: string;
  phone: string;
  roomNumber: string;
  bedNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  status: string;
  lastPaidDate: string | null;
  lastPaymentDaysAgo: number | null;
  reliability: 'RELIABLE' | 'OCCASIONALLY_LATE' | 'CHRONIC_DELAY';
  lastReminderSentAt: string | null;
  note: string | null;
}

export default function OverdueResidentSheet({ pgId }: { pgId: string }) {
  const { isOverdueOpen, closeOverdue, overdueMode, openMarkPaid } = useRentStore();
  const { openProfile } = useResidentProfileStore();
  const queryClient = useQueryClient();

  const [previewResident, setPreviewResident] = useState<OverdueResident | null>(null);
  
  // Note inline editing state
  const [editingNoteTenantId, setEditingNoteTenantId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // 1. Fetch overdue/pending residents list from backend
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'overdue-residents', pgId, overdueMode],
    queryFn: () => fetchApi(`/pgs/${pgId}/automation/overdue-residents?filter=${overdueMode === 'all-unpaid' ? 'all' : overdueMode}`),
    enabled: isOverdueOpen && !!pgId,
  });

  const residents: OverdueResident[] = response?.data || [];

  // 2. Background audit dispatch mutation
  const sendReminderMutation: any = useMutation({
    mutationFn: (data: { tenantProfileId: string; type: string }) => 
      fetchApi(`/pgs/${pgId}/notifications/send-reminder`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity', pgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overdue-residents', pgId] });
      toast.success('Reminder logged in property intelligence history.');
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to register notification audit log.');
    }
  });

  // 3. Save operational note mutation
  const saveNoteMutation: any = useMutation({
    mutationFn: (data: { tenantId: string; note: string }) => 
      fetchApi(`/pgs/${pgId}/tenants/${data.tenantId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: data.note })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overdue-residents', pgId] });
      toast.success('Operational note updated.');
      setEditingNoteTenantId(null);
    },
    onError: () => {
      toast.error('Failed to save operational note.');
    }
  });

  // Prefilled WhatsApp URL generator - aligned with respectful human tone
  const getWhatsAppUrl = (resident: OverdueResident) => {
    const todayNormalized = new Date(new Date().setHours(0, 0, 0, 0));
    const dueNormalized = new Date(new Date(resident.dueDate).setHours(0, 0, 0, 0));
    const diffDays = Math.round((dueNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));

    let text = '';
    if (diffDays === 0) {
      text = `Hi ${resident.tenantName},\nJust a quick heads-up that your rent of ₹${resident.amount.toLocaleString('en-IN')} for Room ${resident.roomNumber} Bed ${resident.bedNumber} is due today. Please clear when possible!`;
    } else if (diffDays === 1) {
      text = `Hi ${resident.tenantName},\nJust a quick heads-up that your rent of ₹${resident.amount.toLocaleString('en-IN')} for Room ${resident.roomNumber} Bed ${resident.bedNumber} is due tomorrow. Please clear when possible!`;
    } else if (diffDays > 1) {
      text = `Hi ${resident.tenantName},\nJust a quick heads-up that your rent of ₹${resident.amount.toLocaleString('en-IN')} for Room ${resident.roomNumber} Bed ${resident.bedNumber} is due in ${diffDays} days. Please clear when possible!`;
    } else {
      text = `Hi ${resident.tenantName},\nYour rent of ₹${resident.amount.toLocaleString('en-IN')} for Room ${resident.roomNumber} Bed ${resident.bedNumber} is overdue by ${Math.abs(diffDays)} days. Please clear when possible.`;
    }
    return `https://wa.me/${resident.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
  };

  const handleSendReminder = (resident: OverdueResident) => {
    // 1. Open WhatsApp in new window
    window.open(getWhatsAppUrl(resident), '_blank');
    
    // 2. Trigger backend audit log
    sendReminderMutation.mutate({
      tenantProfileId: resident.tenantProfileId,
      type: resident.status === 'PENDING' ? 'rent_due_tomorrow' : 'rent_overdue'
    });

    setPreviewResident(null);
  };

  const handleSaveNote = (tenantId: string) => {
    saveNoteMutation.mutate({ tenantId, note: noteText });
  };

  const startEditingNote = (tenantId: string, currentNote: string | null) => {
    setEditingNoteTenantId(tenantId);
    setNoteText(currentNote || '');
  };

  // Helper: formatted time-ago for reminders
  const getReminderTimeAgo = (sentAtStr: string | null) => {
    if (!sentAtStr) return null;
    const sentAt = new Date(sentAtStr);
    const diffTime = Date.now() - sentAt.getTime();
    const diffMins = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'sent just now';
    if (diffMins < 60) return `sent ${diffMins}m ago`;
    if (diffHours < 24) return `sent ${diffHours}h ago`;
    if (diffDays === 1) return 'sent yesterday';
    return `sent ${diffDays} days ago`;
  };

  // Helper: check if reminder is within 5-min cooldown window
  const isReminderOnCooldown = (sentAtStr: string | null) => {
    if (!sentAtStr) return false;
    const sentAt = new Date(sentAtStr);
    const diffTime = Date.now() - sentAt.getTime();
    return diffTime < 5 * 60 * 1000; // 5 minutes cooldown
  };

  // Helper: formatted last paid statement
  const getLastPaidStatement = (res: OverdueResident) => {
    if (res.lastPaymentDaysAgo === null || !res.lastPaidDate) return 'No previous payment history';
    const dateStr = new Date(res.lastPaidDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    if (res.lastPaymentDaysAgo === 0) return 'Last paid today';
    if (res.lastPaymentDaysAgo === 1) return 'Last paid yesterday';
    if (res.lastPaymentDaysAgo <= 30) return `Last payment: ${res.lastPaymentDaysAgo} days ago`;
    return `Last paid: ${dateStr}`;
  };

  return (
    <Sheet open={isOverdueOpen} onOpenChange={(open) => !open && closeOverdue()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-black text-white border-zinc-800 flex flex-col p-0 overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-900">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border 
                ${overdueMode === 'all-unpaid' 
                  ? 'text-primary bg-primary/10 border-primary/20' 
                  : overdueMode === 'due-today'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : overdueMode === 'chronic'
                  ? 'text-orange-405 bg-orange-500/10 border-orange-500/20 text-orange-400'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'}`}
              >
                {overdueMode === 'all-unpaid' ? 'Pending Rent' : 
                 overdueMode === 'due-today' ? 'Due Today' :
                 overdueMode === 'chronic' ? 'Risk Warning' :
                 'Action Required'}
              </span>
            </div>
            <SheetTitle className="text-xl font-black text-zinc-100 mt-2">
              {overdueMode === 'all-unpaid' ? 'Pending Collections' : 
               overdueMode === 'due-today' ? 'Rent Due Today' :
               overdueMode === 'chronic' ? 'High-Risk Delay Warnings' :
               'Overdue Collections'}
            </SheetTitle>
            <SheetDescription className="text-zinc-500 text-xs">
              {overdueMode === 'all-unpaid'
                ? 'All outstanding unpaid rent invoices currently registered.'
                : overdueMode === 'due-today'
                ? 'Outstanding rents due today. Settle or follow up.'
                : overdueMode === 'chronic'
                ? 'Repeated late payment behavior detected from active residents.'
                : 'Follow up with residents. Sorted by longest overdue and highest collection risk.'}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* List Content */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-zinc-950 border border-zinc-900 rounded-xl" />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center text-xs text-red-500 p-8 border border-dashed border-red-950 rounded-xl bg-red-950/5">
              Failed to retrieve collections list.
            </div>
          )}

          {!isLoading && !isError && residents.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="text-xs font-bold uppercase text-zinc-300">All caught up!</p>
              <p className="text-[11px] text-zinc-500 max-w-xs">
                {overdueMode === 'all-unpaid'
                  ? 'There are no unpaid rent invoices registered for this property.'
                  : 'There are no outstanding overdue collections registered for this property.'}
              </p>
            </div>
          )}

          {!isLoading && !isError && residents.length > 0 && (
            <div className="space-y-4">
              {residents.map((res) => {
                const cooldown = isReminderOnCooldown(res.lastReminderSentAt);
                const timeAgo = getReminderTimeAgo(res.lastReminderSentAt);

                return (
                  <div key={res.id} className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3.5 hover:border-zinc-800/80 transition-colors">
                    {/* Top Row: Name, Room, Reliability Indicator */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              console.log("[DIAGNOSTIC] Overdue collection tenant clicked in OverdueResidentSheet for profileId:", res.tenantProfileId);
                              openProfile(res.tenantProfileId);
                            }}
                            className="font-extrabold text-sm text-zinc-100 hover:text-primary hover:underline transition-colors text-left flex items-center gap-1 group/name cursor-pointer"
                          >
                            {res.tenantName}
                            <ExternalLink className="h-3 w-3 opacity-50 group-hover/name:opacity-100 transition-opacity" />
                          </button>
                          {/* Payment Reliability Badges - visually subtle and operational only */}
                          {res.reliability === 'RELIABLE' && (
                            <span className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-green-400" />
                              Reliable
                            </span>
                          )}
                          {res.reliability === 'OCCASIONALLY_LATE' && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-amber-400" />
                              Occasionally Late
                            </span>
                          )}
                          {res.reliability === 'CHRONIC_DELAY' && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-red-400 animate-pulse" />
                              Chronic Delay
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1 pt-0.5">
                          <Building className="h-3 w-3" />
                          Room {res.roomNumber} — Bed {res.bedNumber}
                        </p>
                      </div>

                      {/* Overdue/Pending Badges */}
                      {(() => {
                        const todayNormalized = new Date(new Date().setHours(0, 0, 0, 0));
                        const dueNormalized = new Date(new Date(res.dueDate).setHours(0, 0, 0, 0));
                        const diffDays = Math.round((dueNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));

                        if (diffDays === 0) {
                          return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Due today</span>;
                        } else if (diffDays === 1) {
                          return <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">Due tomorrow</span>;
                        } else if (diffDays > 1) {
                          return (
                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                              Due in {diffDays} days
                            </span>
                          );
                        } else {
                          const absDays = Math.abs(diffDays);
                          return (
                            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                              Overdue by {absDays} day{absDays !== 1 ? 's' : ''}
                            </span>
                          );
                        }
                      })()}
                    </div>

                    {/* Middle Row: Last Payment and Last Reminder Details */}
                    <div className="flex flex-col gap-1 text-[11px] text-zinc-450 border-t border-zinc-900/60 pt-2 text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-650 text-zinc-500" />
                        <span>{getLastPaidStatement(res)}</span>
                      </div>
                      
                      {timeAgo && (
                        <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                          <Clock className="h-3.5 w-3.5 text-zinc-700" />
                          <span>{timeAgo}</span>
                          {cooldown && (
                            <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 rounded">
                              Sent recently
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tenant Notes Foundation - Dynamic Inline notes system */}
                    <div className="bg-zinc-900/40 border border-zinc-900 rounded-lg p-2.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Owner Notes</span>
                        {editingNoteTenantId !== res.tenantProfileId ? (
                          <button 
                            onClick={() => startEditingNote(res.tenantProfileId, res.note)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                            {res.note ? 'Edit' : 'Add Note'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingNoteTenantId(null)}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleSaveNote(res.tenantProfileId)}
                              disabled={saveNoteMutation.isPending}
                              className="text-[10px] text-primary hover:text-primary-light font-bold flex items-center gap-0.5"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                          </div>
                        )}
                      </div>

                      {editingNoteTenantId === res.tenantProfileId ? (
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Usually pays after 5th / salary date..."
                          className="w-full bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-700"
                          maxLength={100}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNote(res.tenantProfileId);
                          }}
                        />
                      ) : (
                        <p className={`text-xs leading-relaxed font-medium ${res.note ? 'text-zinc-350 text-zinc-300' : 'text-zinc-600 italic'}`}>
                          {res.note || 'No operational notes. Add tags like "usually pays after salary date"'}
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Amount & Actions (Send Reminder + Mark Paid) */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-zinc-900">
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase font-bold block tracking-wider">Total Dues</span>
                        <span className="text-sm font-black text-zinc-200">₹{res.amount.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex gap-2">
                        {/* 1. Mark Paid Quick Action */}
                        <Button 
                          onClick={() => openMarkPaid(res.tenantProfileId, res.amount, res.tenantName, res.roomNumber, res.id, res.bedNumber, res.dueDate)}
                          variant="outline"
                          className="border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 bg-zinc-950/40 text-emerald-400 hover:text-emerald-350 font-bold h-8 text-[11px] px-3 flex items-center gap-1"
                        >
                          <IndianRupee className="h-3 w-3" /> Mark Paid
                        </Button>

                        {/* 2. Send Reminder Action with Cooldown Protection */}
                        <Button 
                          onClick={() => setPreviewResident(res)}
                          disabled={cooldown}
                          className="bg-primary hover:bg-primary/95 text-white font-bold h-8 text-[11px] px-3.5 flex items-center gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Send Reminder
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reminder Preview Modal Overlay */}
        {previewResident && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50 animate-in fade-in duration-250">
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setPreviewResident(null)}
                className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                <h5 className="font-black text-sm text-zinc-200 uppercase tracking-wider">Confirm WhatsApp Reminder</h5>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Recipient</p>
                <p className="text-xs font-bold text-zinc-300">
                  {previewResident.tenantName} ({previewResident.phone})
                </p>
              </div>

              {/* Cooldown warning inside confirmation modal if sent recently */}
              {isReminderOnCooldown(previewResident.lastReminderSentAt) && (
                <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-400 font-medium leading-relaxed">
                    A reminder was sent to this tenant recently. Sending another message so soon might feel like spam.
                  </p>
                </div>
              )}

              <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl space-y-1.5">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Prefilled Message Draft</p>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium italic">
                  {(() => {
                    const todayNormalized = new Date(new Date().setHours(0, 0, 0, 0));
                    const dueNormalized = new Date(new Date(previewResident.dueDate).setHours(0, 0, 0, 0));
                    const diffDays = Math.round((dueNormalized.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                      return `Hi ${previewResident.tenantName},\nJust a quick heads-up that your rent of ₹${previewResident.amount.toLocaleString('en-IN')} for Room ${previewResident.roomNumber} Bed ${previewResident.bedNumber} is due today. Please clear when possible!`;
                    } else if (diffDays === 1) {
                      return `Hi ${previewResident.tenantName},\nJust a quick heads-up that your rent of ₹${previewResident.amount.toLocaleString('en-IN')} for Room ${previewResident.roomNumber} Bed ${previewResident.bedNumber} is due tomorrow. Please clear when possible!`;
                    } else if (diffDays > 1) {
                      return `Hi ${previewResident.tenantName},\nJust a quick heads-up that your rent of ₹${previewResident.amount.toLocaleString('en-IN')} for Room ${previewResident.roomNumber} Bed ${previewResident.bedNumber} is due in ${diffDays} days. Please clear when possible!`;
                    } else {
                      return `Hi ${previewResident.tenantName},\nYour rent of ₹${previewResident.amount.toLocaleString('en-IN')} for Room ${previewResident.roomNumber} Bed ${previewResident.bedNumber} is overdue by ${Math.abs(diffDays)} days. Please clear when possible.`;
                    }
                  })()}
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button 
                  onClick={() => setPreviewResident(null)}
                  variant="outline"
                  className="w-1/2 border-zinc-850 text-zinc-400 hover:text-zinc-200 h-10 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSendReminder(previewResident)}
                  className="w-1/2 bg-green-600 hover:bg-green-700 text-white h-10 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Send WhatsApp
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 text-center border-t border-zinc-900">
          <button
            type="button"
            onClick={() => closeOverdue()}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Close Collections List
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
