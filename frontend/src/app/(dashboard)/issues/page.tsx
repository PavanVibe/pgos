'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { 
  Wrench, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Building,
  CheckCircle,
  HelpCircle,
  FileText,
  UserCheck,
  Flame,
  ArrowRight,
  TrendingUp,
  Image as ImageIcon,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantProfile {
  id: string;
  status: string;
  globalTenant?: {
    name: string;
    phone: string;
    email: string;
  };
  bed?: {
    bedNumber: string;
    room?: {
      number: string;
    };
  };
}

interface Complaint {
  id: string;
  category: string;
  description: string;
  imageUrl: string | null;
  priority: 'LOW' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'ESCALATED' | 'RESOLVED';
  slaDeadline: string;
  repairCost: number | null;
  responsibility: string | null;
  billUrl: string | null;
  resolvedImageUrl: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  tenantProfile: TenantProfile;
}

export default function IssuesPage() {
  const { activePgId } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Sheet Drawer States
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);

  // Resolve Form State
  const [repairCost, setRepairCost] = useState('');
  const [responsibility, setResponsibility] = useState<'OWNER' | 'SPECIFIC_RESIDENT' | 'ENTIRE_ROOM'>('OWNER');
  const [recoveryMethod, setRecoveryMethod] = useState<'DEPOSIT' | 'UPI' | 'CASH' | 'WAIVED'>('DEPOSIT');
  const [deductionItemTitle, setDeductionItemTitle] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // 1. Fetch PG Complaints
  const { data: complaintsResponse, isLoading } = useQuery({
    queryKey: ['pg-complaints', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/complaints`),
    enabled: !!activePgId,
  });

  const complaints: Complaint[] = complaintsResponse?.data || [];

  const selectedComplaint = complaints.find(c => c.id === selectedComplaintId);

  // 2. Resolve Complaint Mutation
  const resolveMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/pgs/${activePgId}/complaints/${selectedComplaintId}/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      toast.success('Complaint resolved successfully');
      queryClient.invalidateQueries({ queryKey: ['pg-complaints', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['pg-payments', activePgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', activePgId] });
      setIsResolveOpen(false);
      setSelectedComplaintId(null);
      
      // Reset resolve form
      setRepairCost('');
      setResponsibility('OWNER');
      setRecoveryMethod('DEPOSIT');
      setDeductionItemTitle('');
      setResolutionNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to resolve complaint.');
    }
  });

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    const parsedCost = parseFloat(repairCost) || 0;
    const deductionItems = parsedCost > 0 && responsibility !== 'OWNER'
      ? [{ title: deductionItemTitle || `${selectedComplaint.category} repair charge`, amount: parsedCost }]
      : undefined;

    resolveMutation.mutate({
      repairCost: parsedCost,
      responsibility,
      assignedTenantId: selectedComplaint.tenantProfile.id,
      resolutionNotes: resolutionNotes || 'Resolved by management',
      deductionItems,
      recoveryMethodInput: recoveryMethod
    });
  };

  // Filter complaints
  const filteredComplaints = React.useMemo(() => {
    return complaints.filter(c => {
      // Tab filter
      if (activeTab === 'OPEN' && c.status === 'RESOLVED') return false;
      if (activeTab === 'RESOLVED' && c.status !== 'RESOLVED') return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const descMatch = c.description.toLowerCase().includes(query);
        const nameMatch = c.tenantProfile.globalTenant?.name?.toLowerCase().includes(query);
        const roomMatch = c.tenantProfile.bed?.room?.number?.toLowerCase().includes(query);
        return descMatch || nameMatch || roomMatch;
      }

      return true;
    });
  }, [complaints, activeTab, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Issues & Maintenance</h1>
          <p className="text-zinc-400 text-xs mt-1">Track resident room complaints, assign responsibilities, and deduct repair charges.</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-2xl">
        {/* Status Tabs */}
        <div className="flex bg-black p-1 rounded-xl border border-zinc-900 w-fit">
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all
              ${activeTab === 'OPEN' 
                ? 'bg-zinc-900 text-white shadow-sm' 
                : 'text-zinc-550 hover:text-zinc-300'}`}
          >
            Open Issues
          </button>
          <button
            onClick={() => setActiveTab('RESOLVED')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all
              ${activeTab === 'RESOLVED' 
                ? 'bg-zinc-900 text-white shadow-sm' 
                : 'text-zinc-550 hover:text-zinc-300'}`}
          >
            Resolved Issues
          </button>
        </div>

        {/* Filter inputs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search descriptions, rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-900 text-white rounded-xl text-xs h-9 focus:border-zinc-800"
            />
          </div>

          {/* Priority selector */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500 shrink-0" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-black border border-zinc-900 text-white rounded-xl text-xs h-9 px-3 focus:outline-none focus:border-zinc-800"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints List Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-zinc-900 rounded-2xl" />
          ))}
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="border border-zinc-900 rounded-2xl p-12 text-center bg-zinc-950/10">
          <Wrench className="h-10 w-10 text-zinc-650 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-400">No issues found.</p>
          <p className="text-xs text-zinc-550 mt-1">Hooray! No pending complaints in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComplaints.map((item) => {
            const isUrgent = item.priority === 'URGENT';
            const isHigh = item.priority === 'HIGH';

            return (
              <Card 
                key={item.id}
                onClick={() => {
                  setSelectedComplaintId(item.id);
                  setDeductionItemTitle(`${item.category} repair charge`);
                }}
                className={`border bg-zinc-950/20 hover:bg-zinc-950/40 hover:border-zinc-700 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between
                  ${selectedComplaintId === item.id ? 'border-primary shadow-lg shadow-primary/5' : 'border-zinc-900'}`}
              >
                <div className="p-5 space-y-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-550 uppercase font-black tracking-widest block">
                        Room {item.tenantProfile.bed?.room?.number || '-'} — Bed {item.tenantProfile.bed?.bedNumber || '-'}
                      </span>
                      <h4 className="text-base font-black text-zinc-200 group-hover:text-primary transition-colors mt-0.5">
                        {item.category}
                      </h4>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border 
                      ${isUrgent 
                        ? 'bg-red-500/10 border-red-500/25 text-red-400' 
                        : isHigh 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed font-semibold line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-900/60 flex items-center justify-between text-[11px] font-bold text-zinc-500 select-none">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{item.tenantProfile.globalTenant?.name || 'Resident'}</span>
                  </div>

                  {item.status === 'RESOLVED' ? (
                    <span className="flex items-center gap-1 text-green-400 font-extrabold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                    </span>
                  ) : (
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> 
                      Due {new Date(item.slaDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Complaint Details Drawer Sheet */}
      <Sheet open={!!selectedComplaintId && !isResolveOpen} onOpenChange={(open) => !open && setSelectedComplaintId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-black text-white border-zinc-900 flex flex-col p-0 overflow-y-auto">
          {selectedComplaint && (
            <div className="flex flex-col h-full divide-y divide-zinc-900">
              {/* Header */}
              <div className="p-6 space-y-3">
                <SheetHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded
                        ${selectedComplaint.priority === 'URGENT' 
                          ? 'bg-red-500/10 border-red-500/25 text-red-400' 
                          : selectedComplaint.priority === 'HIGH'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                        {selectedComplaint.priority} Priority
                      </span>
                      <SheetTitle className="text-2xl font-black text-white mt-2">
                        {selectedComplaint.category}
                      </SheetTitle>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              {/* Details & Description */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Description */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Issue Description</span>
                  <p className="text-xs text-zinc-250 leading-relaxed font-semibold bg-zinc-950/60 p-4 border border-zinc-900 rounded-xl">
                    {selectedComplaint.description}
                  </p>
                </div>

                {/* Complaint Image */}
                {selectedComplaint.imageUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> Attached Image
                    </span>
                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-900 bg-zinc-950 flex items-center justify-center relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={selectedComplaint.imageUrl} 
                        alt="Complaint context" 
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}

                {/* Resident profile association details */}
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 space-y-3 text-xs font-semibold">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Resident Context</span>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Resident Name:</span>
                    <button
                      onClick={() => {
                        setSelectedComplaintId(null);
                        openProfile(selectedComplaint.tenantProfile.id);
                      }}
                      className="font-extrabold text-zinc-300 hover:text-primary transition-all underline decoration-dashed decoration-zinc-800 hover:decoration-primary"
                    >
                      {selectedComplaint.tenantProfile.globalTenant?.name}
                    </button>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Location:</span>
                    <span className="text-zinc-300 font-extrabold">
                      Room {selectedComplaint.tenantProfile.bed?.room?.number || '-'} — Bed {selectedComplaint.tenantProfile.bed?.bedNumber || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                    <span className="text-zinc-500">Date Raised:</span>
                    <span className="text-zinc-305 font-mono">
                      {new Date(selectedComplaint.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-500">SLA Resolution Target:</span>
                    <span className="text-zinc-305 font-mono">
                      {new Date(selectedComplaint.slaDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Resolution Audit (If resolved) */}
                {selectedComplaint.status === 'RESOLVED' && (
                  <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-xl p-4 space-y-3.5 text-xs font-semibold">
                    <span className="text-[10px] font-black text-emerald-450 uppercase tracking-widest block flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Resolution Details
                    </span>
                    <div className="flex justify-between items-center py-1 border-b border-emerald-900/10">
                      <span className="text-emerald-500/80">Date Resolved:</span>
                      <span className="text-zinc-300 font-mono">
                        {selectedComplaint.resolvedAt ? new Date(selectedComplaint.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-emerald-900/10">
                      <span className="text-emerald-500/80">Repair Cost:</span>
                      <span className="text-zinc-200 font-extrabold">₹{selectedComplaint.repairCost || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-emerald-900/10">
                      <span className="text-emerald-500/80">Charged To:</span>
                      <span className="text-zinc-250 font-black">{selectedComplaint.responsibility || 'N/A'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-emerald-500/80 block">Resolution Notes:</span>
                      <p className="text-zinc-350 leading-relaxed italic mt-0.5">
                        "{selectedComplaint.resolutionNotes || 'No notes provided.'}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-zinc-950 flex gap-2">
                <Button
                  type="button"
                  onClick={() => setSelectedComplaintId(null)}
                  variant="outline"
                  className="flex-1 text-[11px] h-10 border-zinc-850 hover:bg-zinc-900 text-zinc-400 font-bold"
                >
                  Close
                </Button>
                
                {selectedComplaint.status !== 'RESOLVED' && (
                  <Button
                    type="button"
                    onClick={() => setIsResolveOpen(true)}
                    className="flex-1 text-[11px] h-10 font-bold bg-primary text-black"
                  >
                    Resolve Issue
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Resolve Action Form Overlay Drawer */}
      <Sheet open={isResolveOpen} onOpenChange={(open) => !open && setIsResolveOpen(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-black text-white border-zinc-900 flex flex-col p-0 overflow-y-auto">
          {selectedComplaint && (
            <div className="flex flex-col h-full divide-y divide-zinc-900">
              <div className="p-6">
                <SheetHeader>
                  <SheetTitle className="text-xl font-black text-zinc-100 flex items-center gap-1.5">
                    <Wrench className="h-5 w-5 text-primary" /> Resolve Issue
                  </SheetTitle>
                  <SheetDescription className="text-zinc-500 text-xs">
                    Mark complaint resolved and specify repair cost details.
                  </SheetDescription>
                </SheetHeader>
              </div>

              <form onSubmit={handleResolveSubmit} className="flex-1 p-6 space-y-4 text-xs font-semibold overflow-y-auto">
                {/* Cost */}
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Repair Cost (₹)</Label>
                  <Input 
                    type="number" 
                    value={repairCost} 
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="0.00"
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                  />
                </div>

                {/* Responsibility */}
                {parseFloat(repairCost) > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-450 uppercase tracking-wider block">Charged Responsibility</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['OWNER', 'SPECIFIC_RESIDENT', 'ENTIRE_ROOM'] as const).map(resp => (
                          <button
                            key={resp}
                            type="button"
                            onClick={() => setResponsibility(resp)}
                            className={`p-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all select-none
                              ${responsibility === resp 
                                ? 'border-primary bg-primary/5 text-primary' 
                                : 'border-zinc-900 bg-zinc-950/20 text-zinc-500 hover:border-zinc-800'}`}
                          >
                            {resp === 'OWNER' ? 'Owner' : resp === 'SPECIFIC_RESIDENT' ? 'Resident' : 'Split Room'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recovery Method (If charged to resident) */}
                    {responsibility !== 'OWNER' && (
                      <div className="space-y-1.5">
                        <Label className="text-zinc-450 uppercase tracking-wider block">Recovery Method</Label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['DEPOSIT', 'UPI', 'CASH', 'WAIVED'] as const).map(meth => (
                            <button
                              key={meth}
                              type="button"
                              onClick={() => setRecoveryMethod(meth)}
                              className={`py-2 px-1 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all select-none
                                ${recoveryMethod === meth 
                                  ? 'border-primary bg-primary/5 text-primary' 
                                  : 'border-zinc-900 bg-zinc-950/20 text-zinc-500 hover:border-zinc-800'}`}
                            >
                              {meth}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-semibold leading-relaxed mt-1">
                          {recoveryMethod === 'DEPOSIT' && 'Deducted directly from the resident\'s security deposit balance.'}
                          {recoveryMethod === 'UPI' && 'Raises a pending recovery charge invoice to collect via online payment links.'}
                          {recoveryMethod === 'CASH' && 'Marks recovery paid immediately via hand-to-hand cash.'}
                          {recoveryMethod === 'WAIVED' && 'Waives the cost and registers no outstanding dues for the tenant.'}
                        </p>
                      </div>
                    )}

                    {/* Deduction item title */}
                    {responsibility !== 'OWNER' && (
                      <div className="space-y-1">
                        <Label className="text-zinc-450 uppercase tracking-wider block">Charge Label / Item Title</Label>
                        <Input 
                          type="text" 
                          value={deductionItemTitle} 
                          onChange={(e) => setDeductionItemTitle(e.target.value)}
                          placeholder="e.g. Broken bathroom pipe repair"
                          className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Resolution Notes */}
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block font-bold">Resolution Notes *</Label>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    required
                    placeholder="Describe how the problem was resolved (e.g., Plumber replaced pipe under sink)."
                    className="w-full bg-zinc-900 border border-zinc-850 p-2.5 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResolveOpen(false)}
                    className="flex-1 border-zinc-850 hover:bg-zinc-900 text-zinc-400 font-bold"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={resolveMutation.isPending}
                    className="flex-1 bg-primary text-black font-extrabold"
                  >
                    {resolveMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
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
