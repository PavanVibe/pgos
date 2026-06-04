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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { 
  Building, 
  DoorOpen, 
  Bed as BedIcon, 
  Users, 
  Plus, 
  TrendingUp, 
  Edit3, 
  Trash2, 
  PowerOff,
  Sparkles,
  Clipboard,
  CheckCircle,
  MessageCircle,
  X,
  Megaphone,
  Check,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantProfile {
  id: string;
  status: string;
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  globalTenant?: {
    name: string;
    phone: string;
    email: string;
  };
}

interface Bed {
  id: string;
  bedNumber: string;
  monthlyRent: number;
  isActive: boolean;
  tenantProfile: TenantProfile | null;
}

interface Room {
  id: string;
  number: string;
  floor: string | null;
  capacity: number;
  isActive: boolean;
  beds: Bed[];
}

export default function RoomsManagementPage() {
  const { activePgId, availablePgs } = useOrganizationStore();
  const { openProfile } = useResidentProfileStore();
  const queryClient = useQueryClient();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Create Room Form State
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState('Ground Floor');
  const [newRoomCapacity, setNewRoomCapacity] = useState(2);
  const [newRoomRent, setNewRoomRent] = useState(6000);

  // Edit Room Form State
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editRoomFloor, setEditRoomFloor] = useState('');
  const [editRoomCapacity, setEditRoomCapacity] = useState(2);
  const [editRoomRent, setEditRoomRent] = useState(6000);

  // Listing Generator State
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);

  // 1. Fetch Rooms & Beds
  const { data: roomsResponse, isLoading: roomsLoading } = useQuery({
    queryKey: ['pg-rooms', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/rooms`),
    enabled: !!activePgId,
  });

  const rooms: Room[] = roomsResponse?.data || [];

  // Active PG details
  const activePgDetails = availablePgs.find(p => p.id === activePgId);

  // Mutation: Create Room
  const createRoomMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/pgs/${activePgId}/rooms`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      toast.success('Room created successfully');
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', activePgId] });
      setIsAddOpen(false);
      setNewRoomNumber('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create room.');
    }
  });

  // Mutation: Update Room (Rent, capacity, number, deactivation)
  const updateRoomMutation = useMutation({
    mutationFn: ({ roomId, payload }: { roomId: string; payload: any }) =>
      fetchApi(`/pgs/${activePgId}/rooms/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      toast.success('Room updated successfully');
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', activePgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update room.');
    }
  });

  // Mutation: Delete Room
  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) =>
      fetchApi(`/pgs/${activePgId}/rooms/${roomId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast.success('Room deleted successfully');
      setSelectedRoomId(null);
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', activePgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete room.');
    }
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber || !newRoomRent) {
      toast.error('Room number and rent are required.');
      return;
    }
    createRoomMutation.mutate({
      number: newRoomNumber,
      floor: newRoomFloor,
      capacity: newRoomCapacity,
      monthlyRent: newRoomRent
    });
  };

  const handleEditSubmit = (e: React.FormEvent, roomId: string) => {
    e.preventDefault();
    updateRoomMutation.mutate({
      roomId,
      payload: {
        number: editRoomNumber,
        floor: editRoomFloor,
        capacity: editRoomCapacity,
        monthlyRent: editRoomRent
      }
    });
  };

  const handleDeactivate = (roomId: string) => {
    updateRoomMutation.mutate({
      roomId,
      payload: { isActive: false }
    });
  };

  const handleGenerateListing = (room: Room) => {
    const rent = room.beds[0]?.monthlyRent || 6000;
    const pgName = activePgDetails?.name || 'Sunrise Residency';
    const draftText = `🏡 PREMIUM PG ROOM AVAILABLE IMMEDIATELY!

📍 Located at: ${pgName}
🛏 Room Number: Room ${room.number}
💰 Rent: ₹${rent.toLocaleString('en-IN')}/bed per month
⚡ Sharing Capacity: ${room.capacity} sharing room

✨ Amenities Included:
• High-speed unlimited Wi-Fi 📶
• Standard security CCTV cameras 📹
• Daily room cleaning & hygiene maintenance 🧹
• Pure RO drinking water & backup power supply ⚡
• Separate cupboards & comfortable bed mattress

Ideal for students and working professionals. Contact PG Management to book your site visit now!`;

    setGeneratedDraft(draftText);
  };

  const handleCopyListing = () => {
    if (generatedDraft) {
      navigator.clipboard.writeText(generatedDraft);
      toast.success('Listing copied to clipboard!');
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="space-y-6">
      {/* Header and Quick Add */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Rooms & Beds Grid</h1>
          <p className="text-zinc-400 text-xs mt-1">Configure floor layouts, sharing options, standard rents, and beds.</p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-black font-extrabold text-xs hover:opacity-90 active:scale-[0.98] transition-all shrink-0"
        >
          <Plus className="h-4 w-4 stroke-[3]" /> Add Room
        </button>
      </div>

      {/* Visual Room Grid */}
      {roomsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-zinc-900 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {rooms.map((room) => {
            const occupiedBeds = room.beds.filter(b => b.tenantProfile !== null).length;
            const vacantBeds = room.capacity - occupiedBeds;
            const isFull = vacantBeds === 0;

            return (
              <Card 
                key={room.id}
                onClick={() => {
                  setSelectedRoomId(room.id);
                  setEditRoomNumber(room.number);
                  setEditRoomFloor(room.floor || 'Ground Floor');
                  setEditRoomCapacity(room.capacity);
                  setEditRoomRent(room.beds[0]?.monthlyRent || 6000);
                  setGeneratedDraft(null);
                }}
                className={`border bg-zinc-950/20 hover:bg-zinc-950/40 hover:border-zinc-700 transition-all cursor-pointer group relative overflow-hidden
                  ${selectedRoomId === room.id ? 'border-primary shadow-lg shadow-primary/5' : 'border-zinc-900'}`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      {room.floor || 'Ground Floor'}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border 
                      ${isFull 
                        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                        : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                    >
                      {isFull ? 'Full' : `${vacantBeds} Empty`}
                    </span>
                  </div>

                  <h4 className="text-lg font-black text-zinc-200 group-hover:text-primary transition-colors">
                    Room {room.number}
                  </h4>

                  {/* Bed visual dot grid */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {room.beds.map((bed) => {
                      const occupied = !!bed.tenantProfile;
                      return (
                        <span 
                          key={bed.id}
                          className={`h-2.5 w-2.5 rounded-full border transition-all
                            ${occupied 
                              ? 'bg-red-500 border-red-600' 
                              : 'bg-green-500/10 border-green-500'}`}
                          title={`Bed ${bed.bedNumber}: ${occupied ? bed.tenantProfile?.globalTenant?.name : 'Vacant'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Room Details Drawer Sheet */}
      <Sheet open={!!selectedRoomId} onOpenChange={(open) => !open && setSelectedRoomId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-black text-white border-zinc-900 flex flex-col p-0 overflow-y-auto">
          {selectedRoom && (
            <div className="flex flex-col h-full divide-y divide-zinc-900">
              {/* Header Details */}
              <div className="p-6 space-y-3">
                <SheetHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-zinc-400">
                        {selectedRoom.floor || 'Ground Floor'} Layout
                      </span>
                      <SheetTitle className="text-2xl font-black text-white mt-2">
                        Room {selectedRoom.number} Details
                      </SheetTitle>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              {/* Room Occupancy information */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Room Occupants
                  </h5>

                  <div className="space-y-2.5">
                    {selectedRoom.beds.map((bed) => {
                      const occupied = !!bed.tenantProfile;

                      return (
                        <div key={bed.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-900 bg-zinc-950/60 text-xs font-semibold leading-tight">
                          <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">
                              Bed {bed.bedNumber}
                            </span>
                            {occupied ? (
                              <button
                                onClick={() => openProfile(bed.tenantProfile!.id)}
                                className="font-extrabold text-sm text-white hover:text-primary transition-all text-left mt-0.5 underline decoration-dashed decoration-zinc-700 hover:decoration-primary underline-offset-4"
                              >
                                {bed.tenantProfile?.globalTenant?.name}
                              </button>
                            ) : (
                              <span className="text-zinc-500 font-bold block mt-0.5">Vacant Bed</span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">Bed Rent</span>
                            <span className="text-xs font-extrabold text-zinc-350 block mt-0.5">
                              ₹{bed.monthlyRent.toLocaleString('en-IN')}/mo
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Listing Draft Marketing Generator */}
                <div className="space-y-3 pt-3 border-t border-zinc-900">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5 text-primary" /> Fill Vacant Beds Engine
                  </h5>

                  <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                    <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                      Generate listing advertisements with room pricing, amenities, and PG address to publish instantly.
                    </p>
                    <Button 
                      onClick={() => handleGenerateListing(selectedRoom)}
                      className="w-full bg-primary hover:bg-primary/95 text-black font-extrabold text-xs py-2 flex items-center justify-center gap-1.5 rounded-lg"
                    >
                      <Sparkles className="h-3.5 w-3.5 stroke-[2.5]" /> Fill Vacant Beds
                    </Button>

                    {generatedDraft && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <textarea
                          readOnly
                          value={generatedDraft}
                          rows={6}
                          className="w-full bg-black border border-zinc-850 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed text-zinc-300 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleCopyListing}
                            variant="outline" 
                            className="flex-1 text-[10px] h-9 border-zinc-850 hover:bg-zinc-900 font-bold"
                          >
                            <Clipboard className="h-3.5 w-3.5 mr-1" /> Copy Draft
                          </Button>
                          <a 
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generatedDraft)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/10 hover:border-transparent text-[10px] h-9 flex items-center justify-center font-bold rounded-lg transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1" /> Share Ad
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Room Form Settings */}
                <form 
                  onSubmit={(e) => handleEditSubmit(e, selectedRoom.id)} 
                  className="space-y-4 pt-4 border-t border-zinc-900 text-xs font-semibold"
                >
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Edit3 className="h-3.5 w-3.5" /> Edit Room Details
                  </h5>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-zinc-500 uppercase tracking-wider block">Room Number</Label>
                      <Input 
                        type="text" 
                        value={editRoomNumber} 
                        onChange={(e) => setEditRoomNumber(e.target.value)}
                        className="bg-zinc-900 border-zinc-850 text-white rounded-lg text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-zinc-500 uppercase tracking-wider block">Floor</Label>
                      <Input 
                        type="text" 
                        value={editRoomFloor} 
                        onChange={(e) => setEditRoomFloor(e.target.value)}
                        className="bg-zinc-900 border-zinc-850 text-white rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-zinc-500 uppercase tracking-wider block">Capacity (Sharing)</Label>
                      <Input 
                        type="number" 
                        value={editRoomCapacity} 
                        onChange={(e) => setEditRoomCapacity(Number(e.target.value))}
                        className="bg-zinc-900 border-zinc-850 text-white rounded-lg text-xs"
                        min={1}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-zinc-500 uppercase tracking-wider block">Rent per Bed (₹)</Label>
                      <Input 
                        type="number" 
                        value={editRoomRent} 
                        onChange={(e) => setEditRoomRent(Number(e.target.value))}
                        className="bg-zinc-900 border-zinc-850 text-white rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={updateRoomMutation.isPending}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-white font-extrabold text-xs h-9 rounded-lg"
                  >
                    Save Room Configuration
                  </Button>
                </form>
              </div>

              {/* Destructive Actions Footer */}
              <div className="p-4 bg-zinc-950 flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleDeactivate(selectedRoom.id)}
                  disabled={updateRoomMutation.isPending}
                  variant="outline"
                  className="flex-1 text-[11px] h-10 border-zinc-850 hover:bg-red-950/10 hover:border-red-900/20 text-zinc-400 hover:text-red-400 font-bold"
                >
                  <PowerOff className="h-3.5 w-3.5 mr-1" /> Deactivate Room
                </Button>
                
                <Button
                  type="button"
                  onClick={() => deleteRoomMutation.mutate(selectedRoom.id)}
                  disabled={deleteRoomMutation.isPending}
                  variant="destructive"
                  className="flex-1 text-[11px] h-10 font-bold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Empty Room
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Room Dialog Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 p-6 rounded-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-500 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl font-black text-zinc-150 flex items-center gap-2 mb-1">
              <Plus className="h-5 w-5 text-primary" /> Configure Room
            </h2>
            <p className="text-xs text-zinc-500 mb-5">Create a room and automatically generate bed records.</p>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Room Number *</Label>
                  <Input 
                    type="text" 
                    value={newRoomNumber} 
                    onChange={(e) => setNewRoomNumber(e.target.value)} 
                    required
                    placeholder="e.g. 101"
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Floor</Label>
                  <Input 
                    type="text" 
                    value={newRoomFloor} 
                    onChange={(e) => setNewRoomFloor(e.target.value)} 
                    placeholder="e.g. Ground Floor"
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Sharing Capacity *</Label>
                  <Input 
                    type="number" 
                    value={newRoomCapacity} 
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value))} 
                    required
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                    min={1}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-450 uppercase tracking-wider block">Rent per Bed (₹) *</Label>
                  <Input 
                    type="number" 
                    value={newRoomRent} 
                    onChange={(e) => setNewRoomRent(Number(e.target.value))} 
                    required
                    placeholder="e.g. 6000"
                    className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={createRoomMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                {createRoomMutation.isPending ? 'Generating Room...' : 'Create Room & Generate Beds'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
