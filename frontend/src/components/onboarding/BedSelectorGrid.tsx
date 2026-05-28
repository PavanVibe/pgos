'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { fetchApi } from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';

interface Bed {
  id: string;
  bedNumber: string;
  monthlyRent: number;
  tenantProfile: {
    id: string;
    status: string;
    globalTenant?: {
      name: string;
    };
  } | null;
}

interface Room {
  id: string;
  floor: string | null;
  number: string;
  capacity: number;
  beds: Bed[];
}

export function BedSelectorGrid() {
  const { pgId, bedId, setBedSelection, setStep, rentConfig, setRentConfig } = useOnboardingStore();
  const queryClient = useQueryClient();
  const [lockingBedId, setLockingBedId] = useState<string | null>(null);

  // 1. Fetch real rooms and beds for the active PG
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['pg-rooms', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/rooms`),
    enabled: !!pgId,
  });

  const rooms: Room[] = response?.data || [];

  // Group rooms by floor (dynamic grouping)
  const roomsByFloor: Record<string, Room[]> = {};
  rooms.forEach((room) => {
    const floorName = room.floor ? `${room.floor} Floor` : 'Ground Floor';
    if (!roomsByFloor[floorName]) {
      roomsByFloor[floorName] = [];
    }
    roomsByFloor[floorName].push(room);
  });

  // Sort floors
  const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => a.localeCompare(b));

  // 2. Lock Bed Mutation (Step 3: concurrency safety)
  const lockMutation = useMutation({
    mutationFn: (targetBedId: string) => 
      fetchApi(`/tenants/beds/${targetBedId}/lock`, { method: 'POST' }),
    onSuccess: (data, targetBedId) => {
      const targetRoom = rooms.find(r => r.beds.some(b => b.id === targetBedId));
      const targetBed = targetRoom?.beds.find(b => b.id === targetBedId);

      setBedSelection(targetBedId, targetRoom?.number, targetBed?.bedNumber);
      
      // Auto-fill Bed Monthly Rent if found
      if (targetBed) {
        setRentConfig({
          monthlyRent: targetBed.monthlyRent,
          securityDeposit: targetBed.monthlyRent * 2, // default standard 2 months deposit
        });
      }

      toast.success('Bed temporarily locked for onboarding (5 mins).');
      setStep(2);
    },
    onError: (error: any) => {
      toast.error(error.message || 'This bed is locked by another operator.');
    },
    onSettled: () => {
      setLockingBedId(null);
    }
  });

  const handleBedClick = async (clickedBed: Bed, isOccupied: boolean) => {
    if (isOccupied) {
      toast.error('This bed is already occupied.');
      return;
    }

    setLockingBedId(clickedBed.id);
    lockMutation.mutate(clickedBed.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Select a Bed</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-500/25 border border-green-500" />
            <span className="text-muted-foreground">Vacant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/25 border border-red-500" />
            <span className="text-muted-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500/25 border border-amber-500" />
            <span className="text-muted-foreground">Occupied (Notice)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-indigo-500/25 border border-indigo-500" />
            <span className="text-muted-foreground">Reserved</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center text-sm text-red-500 py-6 border border-dashed rounded-lg">
          Failed to load real bed configurations for this PG.
        </div>
      )}

      {!isLoading && !isError && rooms.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">
          No rooms configured in this PG.
        </div>
      )}

      {!isLoading && !isError && sortedFloors.map((floorName) => (
        <div key={floorName} className="space-y-2.5">
          <h4 className="text-sm font-semibold text-zinc-400 pl-1">{floorName}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {roomsByFloor[floorName].map((room) => (
              <div key={room.id} className="border border-zinc-800 rounded-lg p-2.5 space-y-2 bg-zinc-950/40">
                <div className="text-xs font-bold text-center border-b border-zinc-800 pb-1.5 text-zinc-300">
                  Room {room.number}
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  {room.beds.map((bed) => {
                    const isOccupied = !!bed.tenantProfile;
                    const status = bed.tenantProfile?.status;
                    const isSelected = bed.id === bedId;
                    const isProcessing = lockingBedId === bed.id;

                    // Determine visual styles and tooltips for each state
                    let statusClasses = 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:scale-105 cursor-pointer';
                    let bedTooltip = 'Vacant';

                    if (isOccupied) {
                      if (status === 'NOTICE') {
                        statusClasses = 'bg-amber-500/10 border border-amber-500/40 text-amber-400 opacity-80 cursor-not-allowed';
                        bedTooltip = `Occupied (Notice Period) — ${bed.tenantProfile?.globalTenant?.name || 'Resident'}`;
                      } else if (status === 'INCOMPLETE') {
                        statusClasses = 'bg-indigo-500/10 border border-indigo-500/40 text-indigo-400 opacity-80 cursor-not-allowed';
                        bedTooltip = `Reserved / Pending Onboarding — ${bed.tenantProfile?.globalTenant?.name || 'Resident'}`;
                      } else {
                        statusClasses = 'bg-red-500/10 border border-red-500/30 text-red-400 opacity-60 cursor-not-allowed';
                        bedTooltip = `Occupied — ${bed.tenantProfile?.globalTenant?.name || 'Resident'}`;
                      }
                    }

                    return (
                      <button
                        key={bed.id}
                        disabled={isProcessing || isOccupied}
                        onClick={() => handleBedClick(bed, isOccupied)}
                        className={`h-9 w-9 rounded-md flex flex-col items-center justify-center text-xs font-bold transition-all relative
                          ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}
                          ${statusClasses}
                        `}
                        title={bedTooltip}
                      >
                        {isProcessing ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          bed.bedNumber
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
