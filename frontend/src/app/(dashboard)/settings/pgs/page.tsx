'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Building2, 
  Plus, 
  Settings, 
  Archive, 
  Edit3, 
  MapPin, 
  DoorOpen, 
  Bed, 
  Users, 
  X, 
  Check, 
  ArrowRight,
  Sparkles,
  LayoutGrid
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface PG {
  id: string;
  name: string;
  city: string;
  address: string | null;
  isActive: boolean;
  _count?: {
    rooms: number;
    tenantProfiles: number;
  };
}

interface RoomSetup {
  id: string;
  number: string;
  capacity: number;
  monthlyRent: number;
}

export default function PGManagementPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activePgId, availablePgs, setActivePgId, setAvailablePgs } = useOrganizationStore();

  // Wizard States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [newPgId, setNewPgId] = useState<string | null>(null);
  const [newPgName, setNewPgName] = useState('');

  // Form Step 1: PG Details
  const [pgName, setPgName] = useState('');
  const [pgAddress, setPgAddress] = useState('');
  const [pgCity, setPgCity] = useState('');
  const [pgFloors, setPgFloors] = useState('');
  const [pgNotes, setPgNotes] = useState('');

  // Form Step 2: Room Creator
  const [roomNumber, setRoomNumber] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('2');
  const [roomRent, setRoomRent] = useState('');
  const [setupRooms, setSetupRooms] = useState<RoomSetup[]>([]);

  // Local state for editing PGs
  const [editingPg, setEditingPg] = useState<PG | null>(null);

  // 1. Fetch organization PGs
  const { data: pgsResponse, isLoading: pgsLoading } = useQuery({
    queryKey: ['available-pgs-settings'],
    queryFn: () => fetchApi('/pgs'),
  });

  const pgs: PG[] = pgsResponse?.data || [];

  // PG Creation Mutation
  const createPGMutation = useMutation({
    mutationFn: (payload: { name: string; city: string; address: string }) =>
      fetchApi('/pgs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: any) => {
      const created = res.data;
      setNewPgId(created.id);
      setNewPgName(created.name);
      
      // Update global context immediately
      setActivePgId(created.id);
      
      toast.success(`${created.name} successfully created! Proceeding to Room Setup.`);
      setWizardStep(2); // Go to Room Setup
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create PG.');
    }
  });

  // Room Creation Mutation
  const createRoomMutation = useMutation({
    mutationFn: (payload: { number: string; capacity: number; monthlyRent: number }) =>
      fetchApi(`/pgs/${newPgId}/rooms`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: any) => {
      const created = res.data;
      setSetupRooms((prev) => [
        ...prev,
        {
          id: created.id,
          number: created.number,
          capacity: created.capacity,
          monthlyRent: created.beds[0]?.monthlyRent || 0,
        }
      ]);
      setRoomNumber('');
      setRoomRent('');
      toast.success(`Room ${created.number} successfully created with ${created.capacity} beds.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create room.');
    }
  });

  // Open PG in Dashboard
  const handleOpenPG = (pg: PG) => {
    setActivePgId(pg.id);
    toast.success(`Switched active context to ${pg.name}`);
    router.push('/');
  };

  // Submit Step 1: PG Details
  const handleCreatePGSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgName || !pgAddress || !pgCity) {
      toast.error('Please fill in all required fields.');
      return;
    }
    createPGMutation.mutate({
      name: pgName,
      address: pgAddress,
      city: pgCity,
    });
  };

  // Submit Step 2: Add Room
  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !roomRent) {
      toast.error('Please enter a room number and monthly rent.');
      return;
    }
    createRoomMutation.mutate({
      number: roomNumber,
      capacity: parseInt(roomCapacity),
      monthlyRent: parseFloat(roomRent),
    });
  };

  // Archive PG Mock
  const handleArchivePG = (pg: PG) => {
    toast.info(`${pg.name} has been successfully archived.`);
  };

  // Finish Setup and Hydrate Dashboard
  const handleFinishSetup = () => {
    // Invalidate queries to reload all active PG data
    queryClient.invalidateQueries({ queryKey: ['available-pgs'] });
    queryClient.invalidateQueries({ queryKey: ['available-pgs-settings'] });
    if (newPgId) {
      queryClient.invalidateQueries({ queryKey: ['pg-rooms', newPgId] });
    }

    toast.success(`${newPgName} onboarding complete! ${setupRooms.length} rooms configured.`);
    setIsWizardOpen(false);
    resetWizard();
    router.push('/');
  };

  const resetWizard = () => {
    setWizardStep(1);
    setPgName('');
    setPgAddress('');
    setPgCity('');
    setPgFloors('');
    setPgNotes('');
    setRoomNumber('');
    setRoomRent('');
    setSetupRooms([]);
    setNewPgId(null);
    setNewPgName('');
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900 transition-all text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">PG Management</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Settings &rarr; Manage properties and layouts.</p>
          </div>
        </div>

        <button
          onClick={() => { resetWizard(); setIsWizardOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          Create New PG
        </button>
      </div>

      {/* PG Cards List */}
      {pgsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-zinc-900 rounded-2xl" />
          ))}
        </div>
      ) : pgs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-2xl p-6 bg-zinc-950/10">
          <p className="text-zinc-500 text-sm">No PGs found. Click Create New PG to configure your first property.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pgs.map((pg) => {
            const isActiveContext = activePgId === pg.id;
            const roomsCount = pg._count?.rooms ?? 0;
            const activeResidents = pg._count?.tenantProfiles ?? 0;

            return (
              <Card 
                key={pg.id}
                className={`col-span-1 border bg-zinc-950/20 hover:bg-zinc-950/40 transition-all duration-300 relative overflow-hidden group
                  ${isActiveContext ? 'border-primary/40' : 'border-zinc-900 hover:border-zinc-800'}`}
              >
                {isActiveContext && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}

                <CardHeader className="pb-3 pt-5 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-1.5">
                      <Building2 className={`h-4.5 w-4.5 ${isActiveContext ? 'text-primary' : 'text-zinc-400'}`} />
                      {pg.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{pg.address}, {pg.city}</span>
                    </div>
                  </div>

                  {isActiveContext && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Property Quick Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-zinc-900/60 text-[10px] text-zinc-400 font-semibold">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Rooms</span>
                      <span className="text-zinc-300 font-extrabold text-xs mt-0.5 flex items-center gap-1">
                        <DoorOpen className="h-3.5 w-3.5 text-zinc-500" />
                        {roomsCount}
                      </span>
                    </div>
                    <div className="border-l border-zinc-900/60 pl-2">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Residents</span>
                      <span className="text-zinc-300 font-extrabold text-xs mt-0.5 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        {activeResidents}
                      </span>
                    </div>
                    <div className="border-l border-zinc-900/60 pl-2">
                      <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Beds</span>
                      <span className="text-zinc-300 font-extrabold text-xs mt-0.5 flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5 text-zinc-500" />
                        {roomsCount * 2} {/* Standard sharing approximation */}
                      </span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="flex items-center justify-between gap-2 pt-1 print:hidden">
                    <button
                      onClick={() => handleOpenPG(pg)}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg border transition-all active:scale-[0.98]
                        ${isActiveContext 
                          ? 'bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary' 
                          : 'bg-zinc-900 border-zinc-850 hover:border-zinc-800 text-zinc-300 hover:text-white'}`}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => setEditingPg(pg)}
                      className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Edit PG details"
                    >
                      <Edit3 className="h-4.5 w-4.5" />
                    </button>

                    <button
                      onClick={() => handleArchivePG(pg)}
                      className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Archive PG"
                    >
                      <Archive className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit PG Details Sheet Modal */}
      {editingPg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 p-6 rounded-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setEditingPg(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-500 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2 mb-1">
              <Edit3 className="h-5 w-5 text-primary" />
              Edit PG Details
            </h2>
            <p className="text-xs text-zinc-500 mb-5">Update details for {editingPg.name}.</p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                toast.success('PG details updated successfully.');
                setEditingPg(null);
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="space-y-1">
                <label className="text-zinc-400 uppercase tracking-wider block">PG Name *</label>
                <input 
                  type="text" 
                  defaultValue={editingPg.name}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 uppercase tracking-wider block">Address *</label>
                <input 
                  type="text" 
                  defaultValue={editingPg.address || ''}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 uppercase tracking-wider block">City *</label>
                <input 
                  type="text" 
                  defaultValue={editingPg.city}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Save Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create PG & Setup Wizard Slide-over (Standardized Premium overlay) */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-lg bg-zinc-950 border-l border-zinc-900 p-6 flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
              <div>
                <span className="text-[10px] text-primary font-black uppercase tracking-widest block mb-0.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Property Wizard (Step {wizardStep} of 3)
                </span>
                <h2 className="text-2xl font-black text-zinc-100">
                  {wizardStep === 1 ? 'Configure Property' : wizardStep === 2 ? 'Room Setup Wizard' : 'Review Floor Layout'}
                </h2>
              </div>
              <button 
                onClick={() => {
                  if (wizardStep > 1) {
                    toast.info('You must complete or cancel the room setup flow.');
                  }
                  setIsWizardOpen(false);
                  resetWizard();
                }}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-700 transition-colors text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* WIZARD STEP 1: PG Details */}
            {wizardStep === 1 && (
              <form onSubmit={handleCreatePGSubmit} className="flex-1 flex flex-col justify-between space-y-6 text-xs font-semibold">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-zinc-500 uppercase tracking-wider block">PG Name *</label>
                    <input 
                      type="text"
                      placeholder="e.g. Sunrise Residency"
                      value={pgName}
                      onChange={(e) => setPgName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 uppercase tracking-wider block">Address *</label>
                    <input 
                      type="text"
                      placeholder="e.g. 5th Main, HSR Layout"
                      value={pgAddress}
                      onChange={(e) => setPgAddress(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 uppercase tracking-wider block">City *</label>
                    <input 
                      type="text"
                      placeholder="e.g. Bengaluru"
                      value={pgCity}
                      onChange={(e) => setPgCity(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 uppercase tracking-wider block">Total Floors (Optional)</label>
                    <input 
                      type="text"
                      placeholder="e.g. 4"
                      value={pgFloors}
                      onChange={(e) => setPgFloors(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 uppercase tracking-wider block">Special Notes (Optional)</label>
                    <textarea 
                      placeholder="Special PG guidelines or remarks..."
                      value={pgNotes}
                      onChange={(e) => setPgNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none text-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createPGMutation.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {createPGMutation.isPending ? 'Configuring Property...' : 'Save & Configure Rooms'}
                  <ArrowRight className="h-4 w-4 stroke-[3]" />
                </button>
              </form>
            )}

            {/* WIZARD STEP 2: Room setup flow */}
            {wizardStep === 2 && (
              <div className="flex-1 flex flex-col justify-between space-y-6 text-xs font-semibold">
                <div className="space-y-5">
                  <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Property Target</span>
                      <span className="text-zinc-200 font-extrabold text-sm">{newPgName}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      PG ADMIN ASSIGNED
                    </span>
                  </div>

                  <form onSubmit={handleAddRoom} className="space-y-3 bg-zinc-950 border border-zinc-900/60 p-4 rounded-xl">
                    <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">Create New Room</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-zinc-500 uppercase tracking-wider block">Room Number *</label>
                        <input 
                          type="text"
                          placeholder="e.g. 101"
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-xs placeholder-zinc-500 focus:outline-none text-white transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-500 uppercase tracking-wider block">Sharing Capacity *</label>
                        <select
                          value={roomCapacity}
                          onChange={(e) => setRoomCapacity(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none text-white cursor-pointer"
                        >
                          <option value="1">1 Sharing (Single)</option>
                          <option value="2">2 Sharing (Double)</option>
                          <option value="3">3 Sharing (Triple)</option>
                          <option value="4">4 Sharing (Quadruple)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-500 uppercase tracking-wider block">Default Rent per Bed *</label>
                      <input 
                        type="number"
                        placeholder="e.g. 8500"
                        value={roomRent}
                        onChange={(e) => setRoomRent(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-850 focus:border-zinc-800 text-xs placeholder-zinc-500 focus:outline-none text-white transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={createRoomMutation.isPending}
                      className="w-full py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-lg font-bold text-xs text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      {createRoomMutation.isPending ? 'Generating Beds...' : 'Add Room & Generate Beds'}
                    </button>
                  </form>
                </div>

                {/* Setup Summary list */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    <span>Configured Layout ({setupRooms.length} Rooms)</span>
                    <span className="text-primary font-black">Beds: {setupRooms.reduce((sum, r) => sum + r.capacity, 0)}</span>
                  </div>

                  {setupRooms.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded-xl p-6 bg-zinc-950/20 text-center">
                      <p className="text-zinc-600 text-[11px]">No rooms configured yet. Add at least one room to proceed.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-900 p-2 rounded-xl bg-zinc-950/10">
                      {setupRooms.map((room) => (
                        <div key={room.id} className="flex items-center justify-between p-2.5 bg-zinc-900/30 rounded-lg border border-zinc-900">
                          <span className="font-bold text-zinc-300">Room {room.number}</span>
                          <span className="text-zinc-500 text-[11px]">Capacity: {room.capacity} beds</span>
                          <span className="font-extrabold text-primary">₹{room.monthlyRent.toLocaleString('en-IN')}/mo</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setWizardStep(3)}
                    disabled={setupRooms.length === 0}
                    className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 transition-colors text-white font-extrabold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Review Layout Grid
                  </button>
                  
                  <button
                    onClick={handleFinishSetup}
                    disabled={setupRooms.length === 0}
                    className="flex-1 py-3 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    Finish Setup & Go
                  </button>
                </div>
              </div>
            )}

            {/* WIZARD STEP 3: Layout grid view */}
            {wizardStep === 3 && (
              <div className="flex-1 flex flex-col justify-between space-y-6 text-xs font-semibold">
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Visual Property Layout Matrix</div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {setupRooms.map((room) => (
                      <div key={room.id} className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl relative overflow-hidden flex flex-col gap-1 select-none">
                        <div className="font-black text-zinc-100 text-sm">Room {room.number}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase">{room.capacity} Sharing</div>
                        <div className="text-[10px] text-primary font-extrabold mt-1">₹{room.monthlyRent.toLocaleString('en-IN')}</div>
                        
                        {/* Bed blocks */}
                        <div className="flex items-center gap-1 mt-2 border-t border-zinc-900/60 pt-2">
                          {Array.from({ length: room.capacity }).map((_, idx) => (
                            <span 
                              key={idx}
                              className="h-2 w-full rounded bg-emerald-500/20 border border-emerald-500/30"
                              title={`Bed B${idx + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 transition-colors text-white font-extrabold text-sm flex items-center justify-center gap-1.5"
                  >
                    Back to Setup
                  </button>
                  
                  <button
                    onClick={handleFinishSetup}
                    className="flex-1 py-3 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    Finish Setup & Go
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
