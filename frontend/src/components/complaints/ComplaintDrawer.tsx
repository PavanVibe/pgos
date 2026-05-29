'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useComplaintStore } from '@/store/useComplaintStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CheckCircle, AlertTriangle, Phone, Loader2, ExternalLink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { useState } from 'react';
import { useResidentProfileStore } from '@/store/useResidentProfileStore';

export default function ComplaintDrawer() {
  const { isViewOpen, closeViewComplaint } = useComplaintStore();
  const { openProfile } = useResidentProfileStore();
  const { activePgId } = useOrganizationStore();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // 1. Fetch live complaints list
  const { data: response, isLoading, isError } = useQuery({
    queryKey: queryKeys.complaints(activePgId || ''),
    queryFn: () => fetchApi(`/pgs/${activePgId}/complaints`),
    enabled: !!activePgId && isViewOpen,
  });

  const complaints: any[] = response?.data || [];
  const unresolved = complaints
    .filter((c: any) => c.status !== 'RESOLVED')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 2. Resolve Complaint Mutation
  const resolveMutation = useMutation({
    mutationFn: (complaintId: string) => {
      setResolvingId(complaintId);
      return fetchApi(`/pgs/${activePgId}/complaints/${complaintId}/resolve`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.success('Complaint marked as resolved successfully.');
      
      // Perform targeted dashboard query invalidations
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.complaints(activePgId) });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve complaint.');
    },
    onSettled: () => {
      setResolvingId(null);
    }
  });

  return (
    <Sheet open={isViewOpen} onOpenChange={(open) => !open && closeViewComplaint()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-black text-white border-zinc-800 flex flex-col p-0">
        <div className="p-6 border-b border-zinc-900">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-red-500/20 text-red-400 bg-red-500/10">
                Tickets Pending
              </span>
            </div>
            <SheetTitle className="text-xl font-black text-zinc-100 mt-2">PG Complaints View</SheetTitle>
            <SheetDescription className="text-zinc-500 text-xs">
              Review and coordinate active room maintenance, infra and food issues.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {isLoading && (
            <div className="h-48 flex items-center justify-center flex-col gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-zinc-500 text-xs font-semibold">Loading tickets...</p>
            </div>
          )}

          {isError && (
            <div className="h-48 flex items-center justify-center flex-col gap-2 text-center p-4">
              <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
              <p className="text-zinc-300 text-sm font-semibold">Failed to load complaints</p>
              <p className="text-zinc-500 text-xs mt-1">Please try again later or verify context.</p>
              <Button variant="outline" size="sm" className="mt-4 border-zinc-850" onClick={closeViewComplaint}>
                Close View
              </Button>
            </div>
          )}

          {!isLoading && !isError && unresolved.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="text-xs font-bold uppercase text-zinc-300">All caught up!</p>
              <p className="text-[11px] text-zinc-500 max-w-xs">
                There are no unresolved complaints pending for this PG property.
              </p>
            </div>
          )}

          {!isLoading && !isError && unresolved.length > 0 && (
            <div className="space-y-4">
              {unresolved.map((complaint: any) => {
                const isResolving = resolvingId === complaint.id;
                return (
                  <div key={complaint.id} className="border border-zinc-900 bg-zinc-950/40 p-4 rounded-xl space-y-3.5 hover:border-zinc-800/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={complaint.priority === 'URGENT' || complaint.priority === 'HIGH' ? 'destructive' : 'secondary'} 
                        className="flex items-center gap-1 uppercase text-[9px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full"
                      >
                        <AlertTriangle className="h-3 w-3" /> {complaint.priority}
                      </Badge>
                      <span className="text-[10px] text-zinc-500 font-mono font-medium">#{complaint.id.slice(0, 8)}</span>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-zinc-150 text-zinc-200">{complaint.category || 'Maintenance Issue'}</h4>
                      <p className="text-[10px] text-zinc-555 text-zinc-500 uppercase font-bold flex items-center gap-1 pt-0.5">
                        <MapPin className="h-3 w-3 text-zinc-500" />
                        {complaint.tenantProfile?.bed?.room?.number 
                          ? `Room ${complaint.tenantProfile.bed.room.number} — Bed ${complaint.tenantProfile.bed.bedNumber}` 
                          : 'Common Area'}
                      </p>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed font-medium bg-zinc-900/20 p-3 rounded-lg border border-zinc-900/60 leading-relaxed">
                      {complaint.description}
                    </p>

                    <div className="flex items-center justify-between text-xs p-3 rounded-xl border border-zinc-900 bg-zinc-950/20">
                      <div>
                        {complaint.tenantProfile?.id ? (
                          <button
                            onClick={() => {
                              console.log("[DIAGNOSTIC] Complaint tenant clicked in ComplaintDrawer for profileId:", complaint.tenantProfile.id);
                              openProfile(complaint.tenantProfile.id);
                            }}
                            className="font-extrabold text-white hover:text-primary hover:underline transition-colors text-left flex items-center gap-1 group/name cursor-pointer font-sans"
                          >
                            {complaint.tenantProfile.globalTenant?.name || 'Active Resident'}
                            <ExternalLink className="h-3 w-3 opacity-50 group-hover/name:opacity-100 transition-opacity shrink-0" />
                          </button>
                        ) : (
                          <p className="font-extrabold text-white">
                            {complaint.tenantProfile?.globalTenant?.name || 'Active Resident'}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                          {complaint.tenantProfile?.globalTenant?.phone || 'No phone recorded'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {complaint.tenantProfile?.globalTenant?.phone && (
                          <a 
                            href={`tel:${complaint.tenantProfile.globalTenant.phone}`}
                            className="h-8 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white text-[11px] font-bold rounded-lg px-3 flex items-center gap-1 transition-colors"
                          >
                            <Phone className="h-3 w-3" /> Call
                          </a>
                        )}
                        <Button
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-3 rounded-lg flex items-center gap-1 transition-all"
                          disabled={isResolving}
                          onClick={() => resolveMutation.mutate(complaint.id)}
                        >
                          {isResolving ? 'Resolving...' : 'Resolve'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 text-center border-t border-zinc-900 mt-auto">
          <button
            type="button"
            onClick={closeViewComplaint}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Close Complaints List
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
