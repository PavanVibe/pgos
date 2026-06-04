'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationStore } from '@/store/useOrganizationStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Phone, 
  MessageSquare, 
  Calendar, 
  UserCheck, 
  Trash2, 
  Building2, 
  DollarSign, 
  Briefcase, 
  MapPin, 
  TrendingUp, 
  AlertCircle,
  X,
  Check,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Room {
  id: string;
  number: string;
  monthlyRent: number;
  beds: any[];
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  interestedRoomId: string | null;
  expectedMoveIn: string | null;
  status: string;
  interestedRoom?: {
    id: string;
    number: string;
    monthlyRent: number;
  } | null;
}

const pipelineStages = [
  { key: 'NEW_LEAD', label: 'New Lead', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { key: 'SITE_VISIT_SCHEDULED', label: 'Site Visit', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { key: 'NEGOTIATING', label: 'Negotiating', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { key: 'BOOKED', label: 'Booked', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { key: 'CHECKED_IN', label: 'Checked In', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { key: 'LOST', label: 'Lost', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

export default function LeadsPipelinePage() {
  const { activePgId } = useOrganizationStore();
  const { openOnboarding, setResidentDetails, setBedSelection, setStep, setRentConfig } = useOnboardingStore();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Google');
  const [roomId, setRoomId] = useState('');
  const [expectedMoveIn, setExpectedMoveIn] = useState('');

  // 1. Fetch leads
  const { data: leadsResponse, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/leads`),
    enabled: !!activePgId,
  });

  const leads: Lead[] = leadsResponse?.data || [];

  // 2. Fetch rooms to select interested room & compute vacancies
  const { data: roomsResponse } = useQuery({
    queryKey: ['pg-rooms', activePgId],
    queryFn: () => fetchApi(`/pgs/${activePgId}/rooms`),
    enabled: !!activePgId,
  });

  const rooms: Room[] = roomsResponse?.data || [];

  // Calculate Vacant Beds & Lost Revenue estimates
  const vacantBeds = rooms.flatMap(room => 
    room.beds.filter(bed => bed.isActive && !bed.tenantProfile)
  );
  const vacantBedsCount = vacantBeds.length;
  const estimatedLostRevenue = vacantBeds.reduce((sum, bed) => sum + (bed.monthlyRent || 0), 0);

  // Mutation: Create Lead
  const createLeadMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/pgs/${activePgId}/leads`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Lead created successfully');
      queryClient.invalidateQueries({ queryKey: ['leads', activePgId] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create lead.');
    }
  });

  // Mutation: Update Lead Status/Details
  const updateLeadMutation = useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: any }) =>
      fetchApi(`/pgs/${activePgId}/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Lead updated successfully');
      queryClient.invalidateQueries({ queryKey: ['leads', activePgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update lead.');
    }
  });

  // Mutation: Delete Lead
  const deleteLeadMutation = useMutation({
    mutationFn: (leadId: string) =>
      fetchApi(`/pgs/${activePgId}/leads/${leadId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries({ queryKey: ['leads', activePgId] });
    },
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setSource('Google');
    setRoomId('');
    setExpectedMoveIn('');
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error('Name and Phone are required.');
      return;
    }
    createLeadMutation.mutate({
      name,
      phone,
      source,
      interestedRoomId: roomId || null,
      expectedMoveIn: expectedMoveIn || null,
    });
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateLeadMutation.mutate({
      leadId,
      payload: { status: newStatus },
    });
  };

  const handleConvert = (lead: Lead) => {
    if (!activePgId) return;
    openOnboarding(activePgId);
    setResidentDetails({
      name: lead.name,
      phone: lead.phone,
      moveInDate: new Date(),
    });

    // If they have an interested room, try to find a vacant bed in it
    if (lead.interestedRoomId) {
      const room = rooms.find(r => r.id === lead.interestedRoomId);
      const vacantBedInRoom = room?.beds.find(b => !b.tenantProfile && b.isActive);
      if (vacantBedInRoom) {
        setBedSelection(vacantBedInRoom.id, room?.number, vacantBedInRoom.bedNumber);
        setRentConfig({
          monthlyRent: vacantBedInRoom.monthlyRent,
          securityDeposit: vacantBedInRoom.monthlyRent * 2,
        });
        setStep(2); // Jump directly to Review or Step 2 (skip bed grid selection)
      } else {
        setStep(1); // Keep on Step 1 to choose another bed
      }
    } else {
      setStep(1);
    }
    
    // Automatically update lead status to Checked In
    updateLeadMutation.mutate({
      leadId: lead.id,
      payload: { status: 'CHECKED_IN' },
    });
  };

  const getWhatsAppLink = (lead: Lead) => {
    let cleanPhone = lead.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const text = `Hi ${lead.name}, thank you for your interest in our PG. Let us know when you would like to visit or if you have any questions!`;
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Vacancy Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Leads & Vacancy Board</h1>
          <p className="text-zinc-400 text-xs mt-1">Track empty beds, generate leads, and fill vacancies faster.</p>
        </div>

        {/* Vacancy Widget */}
        <div className="flex gap-4 shrink-0">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-zinc-500" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Vacant Beds</span>
              <span className="text-sm font-extrabold text-white block mt-0.5">{vacantBedsCount} Beds Available</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-red-400" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Revenue Leak</span>
              <span className="text-sm font-extrabold text-red-400 block mt-0.5">₹{estimatedLostRevenue.toLocaleString('en-IN')}/mo</span>
            </div>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-black font-extrabold text-xs hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Add Lead
          </button>
        </div>
      </div>

      {/* Leads Pipeline Layout */}
      {leadsLoading ? (
        <div className="h-64 flex items-center justify-center animate-pulse">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading Leads Pipeline...</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {pipelineStages.map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage.key);

            return (
              <div 
                key={stage.key} 
                className="w-72 shrink-0 bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-3 flex flex-col h-[calc(100vh-280px)] min-h-[400px]"
              >
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    {stageLeads.length} Lead{stageLeads.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Lead cards scroll box */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {stageLeads.map((lead) => (
                    <Card key={lead.id} className="border border-zinc-900 bg-zinc-950 hover:border-zinc-800 transition-all select-none relative group">
                      <div className="p-3.5 space-y-2">
                        {/* Source & Name */}
                        <div className="flex items-start justify-between gap-2">
                          <h6 className="font-extrabold text-sm text-zinc-150 group-hover:text-primary transition-all truncate">
                            {lead.name}
                          </h6>
                          <span className="text-[9px] font-bold text-zinc-500 px-1.5 py-0.2 bg-zinc-900 border border-zinc-850 rounded uppercase shrink-0">
                            {lead.source}
                          </span>
                        </div>

                        {/* Phone & Details */}
                        <div className="text-[10px] text-zinc-400 space-y-1">
                          <p className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-zinc-500" /> {lead.phone}
                          </p>
                          {lead.interestedRoom && (
                            <p className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-zinc-500" /> Interested: Room {lead.interestedRoom.number}
                            </p>
                          )}
                          {lead.expectedMoveIn && (
                            <p className="flex items-center gap-1 text-zinc-400">
                              <Calendar className="h-3 w-3 text-zinc-500" /> Move-in: {new Date(lead.expectedMoveIn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>

                        {/* Pipeline Stage Transition Triggers */}
                        <div className="flex items-center gap-1 pt-1.5 border-t border-zinc-900/60">
                          {pipelineStages.map((st) => {
                            if (st.key === lead.status || st.key === 'CHECKED_IN') return null;
                            return (
                              <button
                                key={st.key}
                                onClick={() => handleStatusChange(lead.id, st.key)}
                                className="text-[9px] font-bold text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-850 hover:border-zinc-700 px-1 py-0.5 rounded transition-all"
                                title={`Move to ${st.label}`}
                              >
                                {st.label.split(' ')[0]}
                              </button>
                            );
                          })}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center justify-between gap-1 pt-2 border-t border-zinc-900/40">
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1.5 rounded bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors"
                              title="Call Lead"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={getWhatsAppLink(lead)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors"
                              title="WhatsApp Message"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                            </a>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleConvert(lead)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-black font-extrabold text-[9px] uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                              title="Convert to Resident Stay"
                            >
                              <UserCheck className="h-3 w-3 stroke-[2.5]" />
                              <span>Convert</span>
                            </button>
                            <button
                              onClick={() => deleteLeadMutation.mutate(lead.id)}
                              className="p-1.5 rounded bg-zinc-900 border border-zinc-850 hover:bg-red-950/20 hover:border-red-900/30 text-zinc-550 hover:text-red-400 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="h-24 flex items-center justify-center border border-dashed border-zinc-900 rounded-xl bg-zinc-950/5 text-center p-4">
                      <p className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">Empty Stage</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Lead Dialog Modal */}
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
              <Plus className="h-5 w-5 text-primary" /> Create Prospective Lead
            </h2>
            <p className="text-xs text-zinc-500 mb-5">Log details for a new tenant inquiry.</p>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <Label className="text-zinc-400 uppercase tracking-wider block">Lead Name *</Label>
                <Input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-400 uppercase tracking-wider block">Phone Number *</Label>
                <Input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  required
                  placeholder="10-digit mobile number"
                  className="bg-zinc-900 border-zinc-850 text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 uppercase tracking-wider block">Lead Source</Label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none text-white cursor-pointer h-10"
                  >
                    <option value="Google">Google</option>
                    <option value="Facebook">Facebook Marketplace</option>
                    <option value="MagicBricks">MagicBricks</option>
                    <option value="Housing">Housing.com</option>
                    <option value="Referral">Referral</option>
                    <option value="WalkIn">Walk-In</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-400 uppercase tracking-wider block">Interested Room</Label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none text-white cursor-pointer h-10"
                  >
                    <option value="">No preference</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} (₹{room.beds[0]?.monthlyRent || 0}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-400 uppercase tracking-wider block">Expected Move-in Date</Label>
                <Input 
                  type="date" 
                  value={expectedMoveIn} 
                  onChange={(e) => setExpectedMoveIn(e.target.value)}
                  className="bg-zinc-900 border-zinc-850 text-white rounded-xl [color-scheme:dark]"
                />
              </div>

              <Button
                type="submit"
                disabled={createLeadMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                {createLeadMutation.isPending ? 'Logging Lead...' : 'Log prospective Lead'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
