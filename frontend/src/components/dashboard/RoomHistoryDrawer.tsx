'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOccupancyStore } from '@/store/useOccupancyStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useVacateStore } from '@/store/useVacateStore';
import { useRentStore } from '@/store/useRentStore';
import { fetchApi } from '@/lib/api';
import { RoomTimeline } from './RoomTimeline';
import { RoomRevenueSummary } from './RoomRevenueSummary';
import { useState } from 'react';
import { 
  Building, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  FileText, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2, 
  Clock, 
  UserMinus,
  AlertCircle
} from 'lucide-react';

interface GlobalTenant {
  name: string;
  phone: string;
  email: string;
}

interface RentInvoice {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
}

interface Complaint {
  id: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface PGTenantProfile {
  id: string;
  bedId: string | null;
  status: string;
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  moveOutDate: string | null;
  historicalRoomNumber: string | null;
  historicalBedNumber: string | null;
  globalTenant: GlobalTenant;
  invoices: RentInvoice[];
  complaints: Complaint[];
}

export function RoomHistoryDrawer({ pgId }: { pgId: string }) {
  const { selectedRoomId, selectRoom } = useOccupancyStore();
  const { openOnboarding, setBedSelection, setRentConfig, setStep } = useOnboardingStore();
  const { openVacate } = useVacateStore();
  const { openMarkPaid } = useRentStore();

  const [activeTab, setActiveTab] = useState<'occupants' | 'past' | 'timeline' | 'finance' | 'complaints'>('occupants');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Room Ledger Data from Backend
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['room-history', pgId, selectedRoomId],
    queryFn: () => fetchApi(`/pgs/${pgId}/rooms/${selectedRoomId}/history`),
    enabled: !!selectedRoomId && !!pgId,
  });

  const roomData = response?.data;
  const room = roomData?.room;
  const profiles: PGTenantProfile[] = roomData?.profiles || [];
  const revenue = roomData?.revenue;
  const timeline = roomData?.timeline || [];

  // Filter lists based on search query
  const filteredActiveProfiles = profiles.filter((p) => {
    if (p.status === 'PAST') return false;
    if (!searchQuery.trim()) return true;
    return p.globalTenant.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredPastProfiles = profiles.filter((p) => {
    if (p.status !== 'PAST') return false;
    if (!searchQuery.trim()) return true;
    return p.globalTenant.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const calculateStayDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      return `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  // Actions
  const handleQuickOnboard = (bedId: string, rent: number, bedNumber: string) => {
    if (!pgId) return;
    openOnboarding(pgId);
    setBedSelection(bedId, room?.number || undefined, bedNumber);
    setRentConfig({
      monthlyRent: rent,
      securityDeposit: rent * 2,
    });
    setStep(2); // Skip bed selector grid
    selectRoom(null); // Close this drawer
  };

  return (
    <Sheet open={!!selectedRoomId} onOpenChange={(open) => !open && selectRoom(null)}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-black text-white border-zinc-800 flex flex-col p-0 overflow-y-auto">
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16 animate-pulse">
            <Building className="h-10 w-10 text-zinc-700" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading Property Ledger...</p>
          </div>
        )}

        {isError && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <h4 className="text-md font-bold text-white">Ledger Fetch Failure</h4>
            <p className="text-xs text-zinc-500 max-w-sm">Failed to retrieve historical room ledger details from the property intelligence layer.</p>
            <Button variant="outline" className="border-zinc-800 text-zinc-350" onClick={() => selectRoom(null)}>
              Close Panel
            </Button>
          </div>
        )}

        {!isLoading && !isError && roomData && (
          <div className="flex flex-col h-full divide-y divide-zinc-900">
            {/* 1. Header Information */}
            <div className="p-6 space-y-4">
              <SheetHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850">
                      Property Ledger
                    </span>
                    <SheetTitle className="text-2xl font-black text-zinc-100 mt-2">
                      Room {room?.number || 'N/A'}
                    </SheetTitle>
                    <SheetDescription className="text-zinc-500 mt-1">
                      Floor {room?.floor || 'Ground'} — Standard Capacity: {room?.capacity || 0} Beds
                    </SheetDescription>
                  </div>
                  
                  {/* Revenue realised percentage */}
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Billing Efficiency</p>
                    <p className={`text-xl font-extrabold mt-1 ${revenue?.profitability >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                      {revenue?.profitability || 0}%
                    </p>
                  </div>
                </div>
              </SheetHeader>

              {/* Operational Summary Grid */}
              {(() => {
                const activeProfile = profiles.find(p => p.status === 'ACTIVE' || p.status === 'NOTICE');
                const currentOccupant = activeProfile ? activeProfile.globalTenant.name : 'Vacant';
                const historicalOccupantsCount = profiles.filter(p => p.status === 'PAST').length;

                const pastStays = profiles.filter(p => p.status === 'PAST' && p.moveInDate && p.moveOutDate);
                let averageStayText = '5.4 months';
                if (pastStays.length > 0) {
                  let totalDays = 0;
                  pastStays.forEach(p => {
                    const start = new Date(p.moveInDate).getTime();
                    const end = new Date(p.moveOutDate!).getTime();
                    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                    totalDays += days;
                  });
                  const avgMonths = (totalDays / pastStays.length) / 30.4;
                  averageStayText = `${avgMonths.toFixed(1)} months`;
                }

                const totalComplaintsCount = profiles.reduce((sum, p) => sum + (p.complaints?.length || 0), 0);

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-950 p-4 border border-zinc-900 rounded-xl text-xs font-semibold leading-tight">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-bold">Current Occupant</span>
                      <span className={`font-black text-xs block truncate ${activeProfile ? 'text-white' : 'text-zinc-500'}`}>
                        {currentOccupant}
                      </span>
                    </div>
                    <div className="space-y-1 border-l border-zinc-900 pl-3">
                      <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-bold">Historical Occupants</span>
                      <span className="font-black text-sm block text-zinc-100">
                        {historicalOccupantsCount}
                      </span>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-900 pt-2 md:pt-0 md:pl-3">
                      <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-bold">Average Stay</span>
                      <span className="font-black text-sm block text-zinc-100">
                        {averageStayText}
                      </span>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-zinc-900 pt-2 md:pt-0 border-l pl-3 md:pl-3">
                      <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-bold">Total Complaints</span>
                      <span className="font-black text-sm block text-zinc-100">
                        {totalComplaintsCount}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Navigation Tabs */}
              <div className="flex gap-1.5 p-1 bg-zinc-950 border border-zinc-900 rounded-lg overflow-x-auto scrollbar-none">
                {[
                  { id: 'occupants', label: 'Occupancy', icon: User },
                  { id: 'past', label: 'History', icon: Clock },
                  { id: 'timeline', label: 'Timeline', icon: Activity },
                  { id: 'finance', label: 'Finance', icon: DollarSign },
                  { id: 'complaints', label: 'Tickets', icon: FileText }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shrink-0
                        ${isActive ? 'bg-zinc-850 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Live Search */}
              {(activeTab === 'occupants' || activeTab === 'past') && (
                <div className="relative">
                  <Input
                    placeholder="Search ledger by resident name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-zinc-950 border-zinc-850 focus:border-zinc-700 text-white pl-9 h-9 text-xs w-full"
                  />
                  <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-500" />
                </div>
              )}
            </div>

            {/* 2. Main Content Tab Panels */}
            <div className="flex-1 p-6 overflow-y-auto max-h-[70vh]">
              {/* TAB 1: ACTIVE OCCUPANCY */}
              {activeTab === 'occupants' && (
                <div className="space-y-4">
                  {room?.beds.map((bed: any) => {
                    const activeProfile = filteredActiveProfiles.find((p) => p.bedId === bed.id);
                    
                    return (
                      <div key={bed.id} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
                          <div className="flex items-center gap-2">
                            <h6 className="font-bold text-xs text-zinc-300 uppercase tracking-wide">
                              Bed {bed.bedNumber}
                            </h6>
                            {(() => {
                              if (!activeProfile) return null;
                              const invoices = activeProfile.invoices || [];
                              const hasOverdue = invoices.some(
                                (inv) => inv.status === 'PAST_DUE' || new Date(inv.dueDate).getTime() < Date.now()
                              );
                              const hasPending = invoices.some((inv) => inv.status === 'PENDING');
                              if (hasOverdue) return <span className="text-xs select-none" title="Overdue ❌">❌</span>;
                              if (hasPending) return <span className="text-xs select-none" title="Pending ⚠️">⚠️</span>;
                              return <span className="text-xs select-none" title="Paid ✅">✅</span>;
                            })()}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border 
                            ${activeProfile 
                              ? activeProfile.status === 'NOTICE'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                              : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                          >
                            {activeProfile 
                              ? activeProfile.status === 'NOTICE' 
                                ? 'Notice Period' 
                                : 'Occupied'
                              : 'Vacant'}
                          </span>
                        </div>

                        {activeProfile ? (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                              <div>
                                <span className="text-[10px] text-zinc-500 block uppercase">Resident</span>
                                <span className="text-white font-bold">{activeProfile.globalTenant.name}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block uppercase">Move-in Date</span>
                                <span className="text-zinc-300">
                                  {new Date(activeProfile.moveInDate).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block uppercase">Monthly Rent</span>
                                <span className="text-zinc-200">₹{activeProfile.monthlyRent || bed.monthlyRent}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-zinc-500 block uppercase">Deposit Paid</span>
                                <span className="text-zinc-200">₹{activeProfile.securityDeposit}</span>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-zinc-900">
                              {activeProfile.invoices.some(inv => inv.status !== 'PAID') && (
                                <Button 
                                  onClick={() => { 
                                    const unpaidInv = activeProfile.invoices.find(inv => inv.status !== 'PAID');
                                    const unpaidAmount = unpaidInv ? unpaidInv.amount : (activeProfile.monthlyRent || bed.monthlyRent);
                                    const unpaidInvId = unpaidInv ? unpaidInv.id : undefined;
                                    const unpaidInvDueDate = unpaidInv ? unpaidInv.dueDate : undefined;
                                    openMarkPaid(
                                      activeProfile.id, 
                                      unpaidAmount, 
                                      activeProfile.globalTenant.name || 'Resident', 
                                      room?.number || 'N/A', 
                                      unpaidInvId, 
                                      bed?.bedNumber || 'N/A',
                                      unpaidInvDueDate
                                    ); 
                                    selectRoom(null); 
                                  }}
                                  className="w-1/2 bg-green-600 hover:bg-green-700 text-white font-bold h-9 text-xs"
                                >
                                  Record Rent
                                </Button>
                              )}
                              <Button 
                                onClick={() => { openVacate(activeProfile.id); selectRoom(null); }}
                                variant="destructive"
                                className={`font-bold h-9 text-xs ${activeProfile.invoices.some(inv => inv.status !== 'PAID') ? 'w-1/2' : 'w-full'}`}
                              >
                                <UserMinus className="h-3.5 w-3.5 mr-1" /> Process Vacate
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center pt-1.5">
                            <span className="text-xs text-zinc-500 font-medium">Standard rent: ₹{bed.monthlyRent}</span>
                            <Button 
                              onClick={() => handleQuickOnboard(bed.id, bed.monthlyRent, bed.bedNumber)}
                              className="bg-primary hover:bg-primary/95 text-white font-bold h-9 text-xs px-4"
                            >
                              Onboard Resident
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: PAST OCCUPANTS LEDGER */}
              {activeTab === 'past' && (
                <div className="space-y-4">
                  {filteredPastProfiles.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl">
                      No historical occupants recorded under this query.
                    </div>
                  ) : (
                    filteredPastProfiles.map((pastProfile) => (
                      <div key={pastProfile.id} className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 space-y-3.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h6 className="font-extrabold text-sm text-white">
                              {pastProfile.globalTenant.name}
                            </h6>
                            <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold">
                              Occupied Bed {pastProfile.historicalBedNumber || 'N/A'} (Immutable Snapshot)
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" /> Settled
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold border-t border-zinc-900 pt-3">
                          <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Stay Duration</span>
                            <span className="text-zinc-200">
                              {calculateStayDuration(pastProfile.moveInDate, pastProfile.moveOutDate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Dates of Stay</span>
                            <span className="text-zinc-300">
                              {new Date(pastProfile.moveInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              {' — '}
                              {pastProfile.moveOutDate 
                                ? new Date(pastProfile.moveOutDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : 'Present'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Deposit Refunded</span>
                            <span className="text-zinc-200">₹{pastProfile.securityDeposit}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Settlement Refund</span>
                            <span className="text-green-400 font-bold">₹{pastProfile.securityDeposit}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: OPERATIONAL TIMELINE */}
              {activeTab === 'timeline' && (
                <RoomTimeline timeline={timeline} />
              )}

              {/* TAB 4: FINANCIAL LEDGER */}
              {activeTab === 'finance' && (
                <div className="space-y-5">
                  {revenue && <RoomRevenueSummary revenue={revenue} />}

                  <div className="space-y-4">
                    <h6 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Payment History By Resident</h6>
                    
                    {profiles.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl">
                        No billing history recorded yet.
                      </div>
                    ) : (
                      profiles.map((profile) => {
                        const sortedInvoices = [...profile.invoices].sort(
                          (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
                        );

                        return (
                          <div key={profile.id} className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                              <h6 className="font-extrabold text-sm text-zinc-100">{profile.globalTenant.name}</h6>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider
                                ${profile.status === 'ACTIVE' || profile.status === 'NOTICE'
                                  ? 'bg-primary/10 border-primary/20 text-primary'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                              >
                                {profile.status === 'ACTIVE' || profile.status === 'NOTICE' ? 'Current Stay' : 'Past Stay'}
                              </span>
                            </div>

                            <div className="divide-y divide-zinc-900">
                              {sortedInvoices.map((inv) => {
                                const monthStr = new Date(inv.dueDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

                                let badgeColor = '';
                                let badgeLabel = '';

                                if (inv.status === 'PAID') {
                                  const isLate = inv.paidAt && new Date(inv.paidAt).getTime() > new Date(inv.dueDate).getTime();
                                  if (isLate) {
                                    badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                                    badgeLabel = 'Late ⚠️';
                                  } else {
                                    badgeColor = 'text-green-400 bg-green-500/10 border-green-500/20';
                                    badgeLabel = 'Paid ✅';
                                  }
                                } else {
                                  const isOverdue = new Date(inv.dueDate).getTime() < Date.now();
                                  if (isOverdue) {
                                    badgeColor = 'text-red-400 bg-red-500/10 border-red-500/20';
                                    badgeLabel = 'Overdue ❌';
                                  } else {
                                    badgeColor = 'text-zinc-400 bg-zinc-900 border-zinc-800';
                                    badgeLabel = 'Pending ❌';
                                  }
                                }

                                return (
                                  <div key={inv.id} className="flex justify-between items-center py-2.5 text-xs font-semibold">
                                    <span className="text-zinc-400">{monthStr}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-zinc-200">₹{inv.amount}</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${badgeColor}`}>
                                        {badgeLabel}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              {sortedInvoices.length === 0 && (
                                <p className="text-xs text-zinc-650 py-1.5">No rent history recorded yet.</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: TICKET HISTORY */}
              {activeTab === 'complaints' && (
                <div className="space-y-5">
                  {(() => {
                    const allComplaints = profiles.flatMap(p => p.complaints.map(c => ({ ...c, residentName: p.globalTenant.name })));
                    
                    if (allComplaints.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-900 rounded-xl">
                          Zero ticket history. This room has had no reported service complaints.
                        </div>
                      );
                    }

                    // Count categories frequency
                    const categoryCounts: Record<string, number> = {};
                    allComplaints.forEach((c) => {
                      const cat = c.category || 'General';
                      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                    });
                    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

                    return (
                      <div className="space-y-5">
                        {/* Frequent Issues Section */}
                        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3">
                          <h6 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Frequent Issues</h6>
                          <div className="space-y-2">
                            {sortedCategories.map(([cat, count]) => {
                              let icon = '•';
                              if (cat.toLowerCase().includes('wifi') || cat.toLowerCase().includes('internet')) {
                                icon = '📶';
                              } else if (cat.toLowerCase().includes('clean') || cat.toLowerCase().includes('hygiene')) {
                                icon = '🧹';
                              } else if (cat.toLowerCase().includes('maintenance') || cat.toLowerCase().includes('plumb') || cat.toLowerCase().includes('repair')) {
                                icon = '🛠️';
                              } else if (cat.toLowerCase().includes('food') || cat.toLowerCase().includes('mess')) {
                                icon = '🍽️';
                              } else if (cat.toLowerCase().includes('electricity') || cat.toLowerCase().includes('power')) {
                                icon = '⚡';
                              }
                              
                              return (
                                <div key={cat} className="flex justify-between items-center text-xs font-semibold bg-zinc-900/40 border border-zinc-900 px-3 py-2.5 rounded-lg">
                                  <span className="text-zinc-200 flex items-center gap-2">
                                    <span className="text-sm">{icon}</span>
                                    {cat}
                                  </span>
                                  <span className="text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded text-[10px] font-bold">
                                    {count} complaint{count > 1 ? 's' : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h6 className="text-xs font-black uppercase text-zinc-400 tracking-wider pl-1">Detailed Log</h6>
                          {allComplaints.map((c) => (
                            <div key={c.id} className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 space-y-2.5">
                              <div className="flex justify-between items-center text-xs">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Category</span>
                                  <span className="text-white font-extrabold block uppercase mt-0.5">{c.category}</span>
                                </div>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border
                                  ${c.status === 'RESOLVED' 
                                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}
                                >
                                  {c.status}
                                </span>
                              </div>

                              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                                "{c.description}"
                              </p>

                              <div className="flex justify-between items-center text-[10px] border-t border-zinc-900/60 pt-2 text-zinc-500 font-bold">
                                <span>Raised by {c.residentName}</span>
                                <span>
                                  {new Date(c.createdAt).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            
            {/* 3. Reset drawer footer action */}
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={() => selectRoom(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Close Room Intelligence Ledger
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
