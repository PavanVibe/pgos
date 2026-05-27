'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useComplaintStore } from '@/store/useComplaintStore';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function RaiseComplaintSheet() {
  const { isRaiseOpen, closeRaiseComplaint } = useComplaintStore();
  const { activePgId } = useOrganizationStore();
  
  const [roomOrArea, setRoomOrArea] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('low');
  
  const queryClient = useQueryClient();

  // 1. Raise Complaint Mutation (Step 8 & 11: flexible complaint model)
  const raiseMutation = useMutation({
    mutationFn: () => 
      fetchApi(`/pgs/${activePgId}/complaints`, {
        method: 'POST',
        body: JSON.stringify({
          roomOrArea,
          description,
          priority,
          category: 'MAINTENANCE'
        })
      }),
    onSuccess: () => {
      toast.success('Complaint raised successfully.');
      
      // Scoped caches invalidation
      if (activePgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.tasks(activePgId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(activePgId) });
      }

      // Reset form fields
      setRoomOrArea('');
      setDescription('');
      setPriority('low');

      closeRaiseComplaint();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to raise complaint.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePgId) {
      toast.error('PG context is missing.');
      return;
    }
    raiseMutation.mutate();
  };

  const loading = raiseMutation.isPending;

  return (
    <Sheet open={isRaiseOpen} onOpenChange={(open) => !open && closeRaiseComplaint()}>
      <SheetContent side="bottom" className="sm:max-w-md mx-auto rounded-t-2xl bg-black text-white border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-zinc-100">Raise Complaint</SheetTitle>
          <SheetDescription className="text-zinc-550 text-zinc-500">
            Log a new room, bed, common area, or infra issue.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Room, Bed or Common Area</label>
            <Input 
              required 
              placeholder="e.g. A-102, Bed B1, Wi-Fi or Common Area" 
              value={roomOrArea}
              onChange={(e) => setRoomOrArea(e.target.value)}
              className="bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Issue Description</label>
            <Textarea 
              required 
              placeholder="Describe the issue in detail..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Priority</label>
            <Select value={priority} onValueChange={(val) => setPriority(val as any)}>
              <SelectTrigger className="w-full h-10 bg-zinc-950 border-zinc-900 rounded-xl focus:border-zinc-700 text-white font-medium">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border border-zinc-900 text-white shadow-xl rounded-xl">
                <SelectItem value="low" className="text-zinc-100 focus:bg-zinc-900 focus:text-white cursor-pointer py-2">Low</SelectItem>
                <SelectItem value="medium" className="text-zinc-100 focus:bg-zinc-900 focus:text-white cursor-pointer py-2">Medium</SelectItem>
                <SelectItem value="high" className="text-zinc-100 focus:bg-zinc-900 focus:text-white cursor-pointer py-2">High</SelectItem>
                <SelectItem value="urgent" className="text-zinc-100 focus:bg-zinc-900 focus:text-white cursor-pointer py-2">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full h-12" type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
