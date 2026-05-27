'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useComplaintStore } from '@/store/useComplaintStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CheckCircle, AlertTriangle, Phone, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

export default function ComplaintDrawer() {
  const { isViewOpen, closeViewComplaint, selectedComplaintId } = useComplaintStore();
  const { activePgId } = useOrganizationStore();
  const queryClient = useQueryClient();

  // 1. Fetch live complaint details
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['complaint', selectedComplaintId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/complaints/${selectedComplaintId}`),
    enabled: !!activePgId && !!selectedComplaintId && isViewOpen,
  });

  const complaint = response?.data;

  // 2. Resolve Complaint Mutation
  const resolveMutation = useMutation({
    mutationFn: () => 
      fetchApi(`/pgs/${activePgId}/complaints/${selectedComplaintId}/resolve`, {
        method: 'POST'
      }),
    onSuccess: () => {
      toast.success('Complaint marked as resolved successfully.');
      
      // Perform targeted dashboard query invalidations
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(activePgId) });
      }

      closeViewComplaint();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve complaint.');
    }
  });

  const handleResolve = () => {
    if (!activePgId || !selectedComplaintId) {
      toast.error('PG context or complaint ID is missing.');
      return;
    }
    resolveMutation.mutate();
  };

  const loading = resolveMutation.isPending;

  return (
    <Sheet open={isViewOpen} onOpenChange={(open) => !open && closeViewComplaint()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-black text-white border-zinc-800">
        {isLoading && (
          <div className="h-full flex items-center justify-center flex-col gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-zinc-500 text-xs font-semibold">Loading ticket details...</p>
          </div>
        )}

        {isError && (
          <div className="h-full flex items-center justify-center flex-col gap-2 text-center p-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="text-zinc-300 text-sm font-semibold">Failed to load complaint</p>
            <p className="text-zinc-500 text-xs mt-1">This ticket could not be fetched or does not exist.</p>
            <Button variant="outline" size="sm" className="mt-4 border-zinc-800" onClick={closeViewComplaint}>
              Close Drawer
            </Button>
          </div>
        )}

        {!isLoading && !isError && complaint && (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <Badge 
                  variant={complaint.priority === 'URGENT' || complaint.priority === 'HIGH' ? 'destructive' : 'secondary'} 
                  className="flex items-center gap-1 uppercase text-[10px] tracking-wider"
                >
                  <AlertTriangle className="h-3 w-3" /> {complaint.priority}
                </Badge>
                <span className="text-[10px] text-zinc-500 font-mono">#{complaint.id.slice(0, 8)}</span>
              </div>
              <SheetTitle className="text-xl pt-2 text-white">{complaint.category || 'Maintenance Issue'}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 text-zinc-400">
                <MapPin className="h-4 w-4 text-zinc-500" /> 
                {complaint.tenantProfile?.bed?.room?.number 
                  ? `Room ${complaint.tenantProfile.bed.room.number} — Bed ${complaint.tenantProfile.bed.bedNumber}` 
                  : 'Common Area'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Description</h4>
                <p className="text-sm text-zinc-300 bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl leading-relaxed font-medium">
                  {complaint.description}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Reported By</h4>
                <div className="flex items-center justify-between p-3.5 border border-zinc-900 rounded-xl bg-zinc-950/20">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {complaint.tenantProfile?.globalTenant?.name || 'Active Resident'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {complaint.tenantProfile?.globalTenant?.phone || 'No phone recorded'}
                    </p>
                  </div>
                  {complaint.tenantProfile?.globalTenant?.phone && (
                    <a 
                      href={`tel:${complaint.tenantProfile.globalTenant.phone}`}
                      className="h-8 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-bold rounded-lg px-3 flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Timeline</h4>
                <div className="border-l border-zinc-900 ml-2 pl-4 space-y-4">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-semibold text-zinc-300">Ticket Opened</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                {complaint.status !== 'RESOLVED' ? (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11 transition-all" 
                    onClick={handleResolve}
                    disabled={loading}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> 
                    {loading ? 'Processing...' : 'Mark Resolved'}
                  </Button>
                ) : (
                  <div className="w-full text-center border border-dashed border-zinc-850 p-4 rounded-xl text-xs text-zinc-500 font-semibold bg-zinc-950/20">
                    This ticket is already resolved.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
