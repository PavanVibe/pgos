'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, CheckSquare, Square, RotateCcw, ShieldCheck } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";

interface CleaningData {
  roomsCompleted: boolean;
  bathroomsCompleted: boolean;
  commonAreasCompleted: boolean;
  kitchenCompleted: boolean;
  waterTankCompleted: boolean;
}

export default function CleaningChecklistCard({ pgId }: { pgId: string }) {
  const queryClient = useQueryClient();

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['cleaning-checklist', pgId],
    queryFn: () => fetchApi(`/pgs/${pgId}/cleaning/checklist`),
    enabled: !!pgId,
  });

  const data: CleaningData = response?.data || {
    roomsCompleted: false,
    bathroomsCompleted: false,
    commonAreasCompleted: false,
    kitchenCompleted: false,
    waterTankCompleted: false,
  };

  const toggleMutation = useMutation({
    mutationFn: (field: string) => {
      return fetchApi(`/pgs/${pgId}/cleaning/checklist/toggle`, {
        method: 'POST',
        body: JSON.stringify({ field })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning-checklist', pgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update task.');
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => {
      return fetchApi(`/pgs/${pgId}/cleaning/checklist/reset`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.success('Checklist reset for the day.');
      queryClient.invalidateQueries({ queryKey: ['cleaning-checklist', pgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset checklist.');
    }
  });

  const items = [
    { key: 'roomsCompleted', label: 'Rooms Cleaning' },
    { key: 'bathroomsCompleted', label: 'Bathrooms & Showers' },
    { key: 'commonAreasCompleted', label: 'Corridors & Common Areas' },
    { key: 'kitchenCompleted', label: 'Kitchen & Dining Hall' },
    { key: 'waterTankCompleted', label: 'Water Tank & Supply Check' },
  ];

  const completedCount = Object.values(data).filter(Boolean).length;
  const isAllDone = completedCount === items.length;

  return (
    <Card className="border border-zinc-900 bg-zinc-950/20">
      <CardHeader className="pb-3 border-b border-zinc-900/60 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2 font-black text-white">
          <Sparkles className={`h-5 w-5 ${isAllDone ? 'text-emerald-400 animate-bounce' : 'text-cyan-400'}`} />
          Daily Operations
        </CardTitle>
        {completedCount > 0 && (
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:bg-zinc-900 text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-all select-none"
            title="Reset Checklist"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-9 bg-zinc-900 rounded-lg" />
            <div className="h-9 bg-zinc-900 rounded-lg" />
            <div className="h-9 bg-zinc-900 rounded-lg" />
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-500 font-semibold py-2">Failed to load operations checklist.</p>
        )}

        {!isLoading && !isError && (
          <>
            <div className="space-y-2">
              {items.map((item) => {
                const isChecked = (data as any)[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleMutation.mutate(item.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none group ${isChecked ? 'bg-emerald-950/10 border-emerald-950 text-emerald-400' : 'bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950/80 hover:text-white'}`}
                  >
                    <span className="text-xs font-extrabold">{item.label}</span>
                    <div>
                      {isChecked ? (
                        <CheckSquare className="h-4.5 w-4.5 text-emerald-500 fill-emerald-500/10 group-hover:scale-105 transition-transform" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-zinc-650 group-hover:text-white transition-colors" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-zinc-500">
              <span>Progress Summary</span>
              <span className={isAllDone ? 'text-emerald-400 flex items-center gap-1 font-black' : 'text-zinc-400'}>
                {isAllDone && <ShieldCheck className="h-3.5 w-3.5" />}
                {completedCount} / {items.length} COMPLETED
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
