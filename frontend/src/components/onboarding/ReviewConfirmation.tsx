'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

export function ReviewConfirmation() {
  const { 
    pgId, bedId, roomNumber, bedLabel, residentDetails, rentConfig, isQuickAdd, 
    aadhaarFront, aadhaarBack, setStep, closeOnboarding, reset 
  } = useOnboardingStore();
  
  const queryClient = useQueryClient();

  // 1. Onboarding Mutation
  const onboardingMutation = useMutation({
    mutationFn: (payload: any) => 
      fetchApi(`/tenants/pgs/${pgId}/onboard`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onMutate: async () => {
      // Apply targeted optimistic update on bed state visually
      if (pgId && bedId) {
        queryClient.setQueryData(['pg-rooms', pgId], (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((room: any) => ({
              ...room,
              beds: room.beds.map((bed: any) => {
                if (bed.id === bedId) {
                  return {
                    ...bed,
                    tenantProfile: {
                      id: 'temp-profile',
                      status: 'ACTIVE',
                      globalTenant: { name: residentDetails?.name || 'Resident' }
                    }
                  };
                }
                return bed;
              })
            }))
          };
        });
      }
    },
    onSuccess: (data) => {
      toast.success('Resident onboarded successfully!');
      
      // 2. Perform targeted invalidations (Step 10: avoid storms)
      if (pgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(pgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.occupancy(pgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(pgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(pgId) });
        queryClient.invalidateQueries({ queryKey: ['pg-rooms', pgId] });
      }

      closeOnboarding();
      setTimeout(reset, 300);
    },
    onError: async (error: any) => {
      toast.error(error.message || 'Failed to onboard resident.');

      // Catch 409 conflict or occupancy error
      const isOccupiedConflict = 
        error.status === 409 || 
        (error.message && (
          error.message.includes('already occupied') || 
          error.message.includes('409') || 
          error.message.includes('occupancy')
        ));

      if (isOccupiedConflict) {
        if (pgId) {
          // Auto-refetch the fresh room grid data from backend
          await queryClient.refetchQueries({ queryKey: ['pg-rooms', pgId] });
          toast.info('Occupancy map refreshed to match live database.');
        }
        
        // Reopen bed selector step
        setStep(1);
      }
    }
  });

  const handleSubmit = () => {
    if (!pgId || !bedId || !residentDetails) {
      toast.error('Onboarding context missing.');
      return;
    }

    const kycDocUrl = !isQuickAdd && aadhaarFront && aadhaarBack
      ? `${aadhaarFront.name},${aadhaarBack.name}`
      : undefined;

    const payload = {
      bedId,
      phone: residentDetails.phone,
      name: residentDetails.name,
      email: residentDetails.email || undefined,
      moveInDate: residentDetails.moveInDate.toISOString(),
      monthlyRent: rentConfig?.monthlyRent || 0,
      securityDeposit: rentConfig?.securityDeposit || 0,
      isQuickAdd,
      kycDocUrl
    };

    onboardingMutation.mutate(payload);
  };

  const isSubmitting = onboardingMutation.isPending;

  return (
    <div className="space-y-6">
      <h3 className="font-extrabold text-lg text-white">Review & Confirm Details</h3>
      
      <div className="space-y-4 text-sm bg-zinc-900/90 p-5 border border-zinc-700 rounded-xl shadow-xl">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">Full Name</span>
            <span className="font-extrabold text-zinc-100 text-sm md:text-base">{residentDetails?.name}</span>
          </div>
          <div>
            <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">WhatsApp Phone</span>
            <span className="font-extrabold text-zinc-100 text-sm md:text-base">{residentDetails?.phone}</span>
          </div>
          <div>
            <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">Allocated Room & Bed</span>
            <span className="font-extrabold text-zinc-150 text-white text-sm md:text-base">
              {roomNumber && bedLabel ? `Room ${roomNumber} — Bed ${bedLabel}` : `Bed ${bedId}`}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">Move-in Date</span>
            <span className="font-extrabold text-zinc-100 text-sm md:text-base">
              {residentDetails?.moveInDate?.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
          
          {!isQuickAdd && (
            <>
              <div>
                <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">Monthly Rent</span>
                <span className="font-extrabold text-emerald-400 text-sm md:text-base">₹{rentConfig?.monthlyRent?.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-zinc-400 font-bold block text-[10px] uppercase tracking-wider">Security Deposit</span>
                <span className="font-extrabold text-emerald-400 text-sm md:text-base">₹{rentConfig?.securityDeposit?.toLocaleString('en-IN')}</span>
              </div>
            </>
          )}
        </div>

        {isQuickAdd && (
          <div className="mt-4 pt-4 border-t border-zinc-800 text-amber-400 bg-amber-500/10 p-3 rounded-lg text-xs font-bold leading-relaxed border border-amber-500/20">
            Note: Quick Add active. Rent structure and identity documents must be configured later.
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button 
          variant="outline" 
          className="w-1/2 border-zinc-800 hover:bg-zinc-900 text-zinc-300" 
          onClick={() => setStep(isQuickAdd ? 2 : 4)}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button 
          className="w-1/2 bg-primary hover:bg-primary/95 text-white font-extrabold" 
          onClick={handleSubmit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Onboarding...' : 'Confirm & Onboard'}
        </Button>
      </div>
    </div>
  );
}
